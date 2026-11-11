// 개발 전용 자가검증 (SPACELOG_SELFTEST=1). 사람 손 없이 확인할 수 있는 것만 돈다:
// 서버 보안, 파일(경로·바이트)·폴더·21개·링크·텍스트·빈 텍스트 넣기, 확인 카드 PATCH, 클립보드 단축키 경로.
// 탐색기 → 드롭존 드래그, 알림 클릭, 창 모양은 사람이 봐야 한다. 클립보드 내용을 덮어쓴다.
import { app, clipboard } from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import path from "node:path";
import type { Ingest } from "./ingest.ts";
import { localDateOf } from "./notifySchedule.ts";
import type { ServerProcess } from "./serverProcess.ts";

function raw(port: number, headers: Record<string, string>): Promise<number | string> {
  return new Promise((resolve) => {
    const req = request({ host: "127.0.0.1", port, path: "/api/health", method: "GET", headers, setHost: false }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode ?? 0));
    });
    req.on("error", (e) => resolve(`ERR ${(e as NodeJS.ErrnoException).code}`));
    req.end();
  });
}

/** 토큰을 붙여 서버에서 JSON을 읽는다 (자가검증용) */
async function getJson(port: number, token: string, p: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${p}`, { headers: { "x-session-token": token } });
    return res.ok ? ((await res.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function runSelfTest(server: ServerProcess, ingest: Ingest): Promise<Record<string, unknown>> {
  const port = server.port!;
  const host = `127.0.0.1:${port}`;
  const auth = { "x-session-token": server.token };
  const security = {
    noToken: await raw(port, { host }), // 401
    wrongToken: await raw(port, { host, "x-session-token": "nope" }), // 401
    wrongHost: await raw(port, { host: "evil.example", ...auth }), // 403
    foreignOrigin: await raw(port, { host, origin: "http://evil.example", ...auth }), // 403
    good: await raw(port, { host, ...auth }), // 200
  };
  const secPass = security.noToken === 401 && security.wrongToken === 401 && security.wrongHost === 403 && security.foreignOrigin === 403 && security.good === 200;

  const dir = path.join(app.getPath("temp"), `spacelog-selftest-${Date.now()}`);
  mkdirSync(path.join(dir, "folder"), { recursive: true });
  const file = path.join(dir, "메모.pdf");
  writeFileSync(file, `selftest ${Date.now()}`);
  const t = (n: string) => ({ name: n, type: "text/plain", size: 5, isDirectory: false, bytes: new TextEncoder().encode(`${n}-${Date.now()}`) });

  const results: Record<string, unknown> = { security, secPass };
  const files = await ingest.saveFiles(
    [
      { name: "메모.pdf", type: "application/pdf", size: 0, isDirectory: false, path: file },
      { name: "folder", type: "", size: 0, isDirectory: false, path: path.join(dir, "folder") }, // 렌더러가 폴더를 놓쳐도 main이 잡는지
      { name: "inline.png", type: "image/png", size: 4, isDirectory: false, bytes: new Uint8Array([137, 80, 78, Date.now() % 256]) },
    ],
    "drop",
  );
  results.files = { created: files.stars.length, lines: files.lines, error: files.error, pass: files.stars.length === 2 && files.lines.some((l) => l.includes("폴더")) };
  const dup = await ingest.saveFiles([{ name: "메모.pdf", type: "application/pdf", size: 0, isDirectory: false, path: file }], "drop");
  results.duplicate = { lines: dup.lines, pass: dup.stars.length === 0 && dup.lines.some((l) => l.includes("이미")) };
  const many = await ingest.saveFiles(Array.from({ length: 21 }, (_, i) => t(`f${i}.txt`)), "drop");
  results.many = { created: many.stars.length, lines: many.lines, pass: many.stars.length === 20 && many.lines.length === 1 && many.lines[0].startsWith("f20.txt") };
  const link = await ingest.saveText("https://example.com/selftest\r\n", "https://example.com/selftest", "drop");
  results.link = { kind: link.stars[0]?.kind, title: link.stars[0]?.title, pass: link.stars[0]?.kind === "link" };
  const text = await ingest.saveText("", "자가검증 텍스트", "paste");
  results.text = { kind: text.stars[0]?.kind, pass: text.stars[0]?.kind === "text" };
  const empty = await ingest.saveText("", "   ", "paste");
  results.empty = { lines: empty.lines, pass: empty.stars.length === 0 && empty.lines[0] === "클립보드가 비어 있어요" };
  // 행성 id는 서버에서 읽어 쓴다. 전에는 가짜 서버에만 있는 "p-idea"를 보내 실서버에서 늘 NOT_FOUND였다
  const ymd = localDateOf(new Date());
  const universe = await getJson(port, server.token, `/api/universe?from=${ymd}&to=${ymd}`);
  const planets = (universe?.planets as { id: string }[] | undefined) ?? [];
  const current = text.stars[0]?.planetId;
  const target = planets.find((p) => p.id !== current)?.id ?? current;
  const conf = target
    ? await ingest.confirm({ ids: [text.stars[0]?.id ?? "x"], planetId: target, memo: "메모\n두 줄" + "가".repeat(200) })
    : { ok: false, error: "행성을 읽지 못했어요" };
  results.confirm = { ...conf, planetId: target ?? null, pass: conf.ok };
  clipboard.writeText("단축키 자가검증");
  const sc = await ingest.saveClipboard();
  results.shortcut = { kind: sc.stars[0]?.kind, error: sc.error, lines: sc.lines, pass: sc.stars[0]?.kind === "text" };
  clipboard.clear();
  const scEmpty = await ingest.saveClipboard();
  results.shortcutEmpty = { lines: scEmpty.lines, pass: scEmpty.lines[0] === "클립보드가 비어 있어요" };
  results.allPass = Object.values(results).every((v) => typeof v !== "object" || v === null || (v as { pass?: boolean }).pass !== false) && secPass;
  return results;
}
