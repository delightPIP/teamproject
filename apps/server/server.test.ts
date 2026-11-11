import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer, request, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { startServer } from "./app.ts";
import { configFromEnv, type ServerConfig } from "./config.ts";
import { resolveStaticPath } from "./static.ts";

const TOKEN = "test-token-1234";

function call(port: number, path: string, headers: Record<string, string> = {}, method = "GET") {
  return new Promise<{ status: number; headers: Record<string, unknown>; body: string }>((ok, fail) => {
    const req = request({ host: "127.0.0.1", port, path, method, headers: { host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => ok({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on("error", fail);
    req.end();
  });
}

describe("서버 보안·정적 파일", () => {
  let server: Server;
  let port: number;
  const webDir = mkdtempSync(join(tmpdir(), "spacelog-web-"));
  mkdirSync(join(webDir, "assets"));
  writeFileSync(join(webDir, "index.html"), "<!doctype html><title>SpaceLog</title>");
  writeFileSync(join(webDir, "assets", "app-abc123.js"), "console.log(1)");

  before(async () => {
    const config: ServerConfig = { token: TOKEN, basePort: 0, webDir, devOrigin: "http://localhost:5173" };
    ({ server, port } = await startServer(config));
  });
  after(() => server.close());

  const auth = { "x-session-token": TOKEN };

  it("토큰이 맞으면 health 200", async () => {
    const r = await call(port, "/api/health", auth);
    assert.equal(r.status, 200);
    assert.deepEqual(JSON.parse(r.body), { ok: true });
  });

  it("토큰이 없거나 틀리면 401 UNAUTHORIZED", async () => {
    const cases: Record<string, string>[] = [{}, { "x-session-token": "wrong" }, { "x-session-token": TOKEN + "x" }];
    for (const h of cases) {
      const r = await call(port, "/api/health", h);
      assert.equal(r.status, 401);
      assert.equal(JSON.parse(r.body).error.code, "UNAUTHORIZED");
    }
  });

  it("다른 Host는 403 (DNS 리바인딩 방어)", async () => {
    const r = await call(port, "/api/health", { ...auth, host: `evil.example:${port}` });
    assert.equal(r.status, 403);
    assert.equal(JSON.parse(r.body).error.code, "FORBIDDEN_ORIGIN");
    assert.equal((await call(port, "/api/health", { ...auth, host: `127.0.0.1:${port + 1}` })).status, 403);
  });

  it("다른 Origin은 403, 자기 Origin·localhost·개발 Origin은 통과", async () => {
    assert.equal((await call(port, "/api/health", { ...auth, origin: "https://evil.example" })).status, 403);
    assert.equal((await call(port, "/api/health", { ...auth, origin: "null" })).status, 403);
    assert.equal((await call(port, "/api/health", { ...auth, origin: `http://127.0.0.1:${port}` })).status, 200);
    assert.equal((await call(port, "/api/health", { ...auth, host: `localhost:${port}`, origin: `http://localhost:${port}` })).status, 200);
    assert.equal((await call(port, "/api/health", { ...auth, origin: "http://localhost:5173" })).status, 200);
  });

  it("다른 Origin은 토큰이 맞아도, 정적 파일이어도 막는다", async () => {
    assert.equal((await call(port, "/", { origin: "https://evil.example" })).status, 403);
  });

  it("CORS 헤더를 보내지 않는다", async () => {
    const r = await call(port, "/api/health", { ...auth, origin: "http://localhost:5173" });
    assert.equal(r.headers["access-control-allow-origin"], undefined);
    assert.equal(r.headers["x-frame-options"], "DENY");
  });

  it("없는 API는 404 NOT_FOUND", async () => {
    const r = await call(port, "/api/nope", auth);
    assert.equal(r.status, 404);
    assert.equal(JSON.parse(r.body).error.code, "NOT_FOUND");
  });

  it("정적 파일은 토큰 없이, index.html은 no-cache, assets는 오래 캐시", async () => {
    const index = await call(port, "/");
    assert.equal(index.status, 200);
    assert.match(String(index.headers["content-type"]), /text\/html/);
    assert.equal(index.headers["cache-control"], "no-cache");
    const js = await call(port, "/assets/app-abc123.js");
    assert.equal(js.status, 200);
    assert.match(String(js.headers["cache-control"]), /immutable/);
  });

  it("보관함 밖 파일은 내려주지 않는다", async () => {
    for (const p of ["/../package.json", "/%2e%2e/package.json", "/assets/%2e%2e%2f%2e%2e%2fpackage.json", "/nope.js"]) {
      assert.equal((await call(port, p)).status, 404, p);
    }
    assert.equal(resolveStaticPath(webDir, "/%00"), null);
    assert.equal(resolveStaticPath(webDir, "/%E0%A4%A"), null);
  });
});

describe("설정·포트", () => {
  it("토큰이 없으면 시작을 거부한다", () => {
    assert.throws(() => configFromEnv({}), /SPACELOG_TOKEN/);
    assert.throws(() => configFromEnv({ SPACELOG_TOKEN: "t", SPACELOG_PORT: "abc" }), /SPACELOG_PORT/);
    assert.deepEqual(configFromEnv({ SPACELOG_TOKEN: "t" }), { token: "t", basePort: 47800, webDir: null, devOrigin: null });
  });

  it("개발 Origin이 없으면 Vite 주소도 막는다", async () => {
    const { server, port } = await startServer({ token: TOKEN, basePort: 0, webDir: null, devOrigin: null });
    try {
      assert.equal((await call(port, "/api/health", { "x-session-token": TOKEN, origin: "http://localhost:5173" })).status, 403);
    } finally {
      server.close();
    }
  });

  it("포트가 사용 중이면 다음 포트로", async () => {
    const blocker = createServer();
    await new Promise<void>((ok) => blocker.listen(0, "127.0.0.1", ok));
    const taken = (blocker.address() as { port: number }).port;
    try {
      const { server, port } = await startServer({ token: TOKEN, basePort: taken, webDir: null, devOrigin: null });
      try {
        assert.ok(port > taken && port < taken + 10, `${port}`);
        assert.equal((await call(port, "/api/health", { "x-session-token": TOKEN })).status, 200);
      } finally {
        server.close();
      }
    } finally {
      blocker.close();
    }
  });
});
