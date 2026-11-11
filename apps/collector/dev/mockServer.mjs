// 개발 전용 가짜 로컬 서버. 서버 2/4(#33: 기록 넣기·기간 조회)가 머지되기 전에 수집 앱을 끝까지 돌려 보려고 둔다.
// 실제 서버(apps/server)와 같은 진입 계약: SPACELOG_TOKEN 필수, SPACELOG_PORT부터 +1씩 10번, listening 메시지,
// Host·Origin·X-Session-Token 검사. 기록은 메모리에만 둔다 (파일 저장 안 함).
// 사용: SPACELOG_SERVER_ENTRY=dev/mockServer.mjs npm start   (배포 빌드에서는 읽지 않는다)
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";

const token = process.env.SPACELOG_TOKEN;
const report = (m) => (process.parentPort ? process.parentPort.postMessage(m) : console.log(JSON.stringify(m)));
if (!token) {
  report({ type: "error", message: "SPACELOG_TOKEN이 없어요" });
  process.exit(1);
}

const planets = [
  { id: "p-uncat", name: "미분류" },
  { id: "p-study", name: "공부" },
  { id: "p-work", name: "일" },
  { id: "p-idea", name: "아이디어" },
];
const stars = [];
const hashes = new Map();
const err = (res, status, code, message) => send(res, status, { error: { code, message } });
function send(res, status, body) {
  const t = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" }).end(t);
}
const today = () => new Date().toLocaleDateString("sv-SE");

function makeStar(kind, extra) {
  const now = new Date().toISOString();
  const star = {
    id: randomUUID(), kind, planetId: kind === "link" ? "p-study" : "p-uncat", createdAtUtc: now, updatedAtUtc: now, tzOffsetMin: -new Date().getTimezoneOffset(),
    storagePath: null, originalName: null, mimeType: null, sizeBytes: null, sha256: null, url: null, linkTitle: null, linkDomain: null, textBody: null,
    thumbnailPath: null, thumbnailStatus: "fallback", linkFetchStatus: "none", memo: null, localDate: today(), ...extra,
  };
  stars.push(star);
  return star;
}

let port = Number(process.env.SPACELOG_PORT || 47800);
const server = createServer(async (req, res) => {
  const okHost = req.headers.host === `127.0.0.1:${port}` || req.headers.host === `localhost:${port}`;
  if (!okHost || (req.headers.origin && req.headers.origin !== `http://127.0.0.1:${port}`)) return err(res, 403, "FORBIDDEN_ORIGIN", "허용되지 않은 곳에서 온 요청이에요");
  if (req.headers["x-session-token"] !== token) return err(res, 401, "UNAUTHORIZED", "수집 앱의 [우주 보기]로 다시 열어 주세요");
  const url = new URL(req.url, "http://x");
  const route = `${req.method} ${url.pathname}`;
  if (route === "GET /api/health") return send(res, 200, { ok: true });
  if (route === "GET /api/universe") return send(res, 200, { stars: stars.filter((s) => s.localDate >= url.searchParams.get("from") && s.localDate <= url.searchParams.get("to")), planets });
  if (route === "GET /api/rediscovery/today") return send(res, 200, stars[0] ? { star: stars[0], daysAgo: 7 } : null);
  if (route === "POST /api/rediscovery/events") return send(res, 200, { ok: true });
  if (route === "PATCH /api/stars") {
    const body = await new Response(req).json();
    const changed = stars.filter((s) => body.ids.includes(s.id));
    for (const s of changed) {
      if (body.planetId) s.planetId = body.planetId;
      if (body.memo !== undefined) s.memo = body.memo;
    }
    return send(res, 200, { stars: changed });
  }
  if (route === "POST /api/stars") {
    const r = new Request("http://x", { method: "POST", headers: req.headers, body: req, duplex: "half" });
    const out = { created: [], duplicates: [], rejected: [] };
    if ((req.headers["content-type"] || "").startsWith("multipart/form-data")) {
      for (const f of (await r.formData()).getAll("files")) {
        const buf = Buffer.from(await f.arrayBuffer());
        const sha = createHash("sha256").update(buf).digest("hex");
        if (hashes.has(sha)) {
          const ex = hashes.get(sha);
          out.duplicates.push({ name: f.name, existingStarId: ex.id, planetId: ex.planetId, planetName: planets.find((p) => p.id === ex.planetId).name });
          continue;
        }
        const s = makeStar(f.type.startsWith("image/") ? "image" : "file", { originalName: f.name, mimeType: f.type, sizeBytes: buf.length, sha256: sha });
        hashes.set(sha, s);
        out.created.push(s);
      }
    } else {
      const body = await r.json();
      if (body.kind === "link") out.created.push(makeStar("link", { url: body.url, linkDomain: new URL(body.url).hostname }));
      else if (!body.text?.trim()) out.rejected.push({ name: null, code: "TEXT_EMPTY", message: "클립보드가 비어 있어요" });
      else out.created.push(makeStar("text", { textBody: body.text }));
    }
    return send(res, 200, out);
  }
  err(res, 404, "NOT_FOUND", "찾는 기록이 없어요");
});

for (let i = 0; i < 10; i++) {
  try {
    await new Promise((ok, fail) => server.once("error", fail).listen(port + i, "127.0.0.1", ok));
    port = server.address().port;
    report({ type: "listening", port });
    break;
  } catch (e) {
    if (e.code !== "EADDRINUSE" || i === 9) {
      report({ type: "error", message: e.message });
      process.exit(1);
    }
  }
}
