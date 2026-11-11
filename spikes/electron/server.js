// ADR 0001 스파이크용 최소 서버. utilityProcess 안에서 실행된다.
// 실제 서버(개발 B)가 아니다. /api/health 와 받은 바이트 수만 확인하는 POST /api/stars 만 있다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const token = process.env.SPACELOG_TOKEN;
const basePort = Number(process.env.SPACELOG_PORT || 47800);
const vaultDir = process.env.SPACELOG_VAULT;
fs.mkdirSync(vaultDir, { recursive: true });

function deny(res, status, code) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: code }));
}

function handler(port) {
  return (req, res) => {
    // POLICY 1장 / SPEC 3-1: Host → Origin → 토큰 순서로 검사, CORS 헤더 없음
    const okHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!okHosts.includes(req.headers.host)) return deny(res, 403, 'FORBIDDEN_ORIGIN');
    const origin = req.headers.origin;
    if (origin && !okHosts.some((h) => origin === `http://${h}`)) return deny(res, 403, 'FORBIDDEN_ORIGIN');
    // 웹 정적 파일 자리 (토큰은 해시로 넘어오고 API 호출에만 쓴다, SPEC 3-3)
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end('<!doctype html><meta charset="utf-8"><title>SpaceLog 스파이크</title><p>수집 앱에서 열린 로컬 웹 자리입니다. 주소창의 해시: <code id="h"></code></p><script>h.textContent=location.hash.replace(/token=[^&]+/,"token=***")</script>');
    }
    if (req.headers.authorization !== `Bearer ${token}`) return deny(res, 401, 'UNAUTHORIZED');

    if (req.method === 'GET' && req.url === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, pid: process.pid }));
    }

    if (req.method === 'POST' && req.url === '/api/stars') {
      // 스파이크: multipart를 파싱하지 않고 통째로 보관함 tmp에 쓴 뒤 크기와 해시만 돌려준다.
      const file = path.join(vaultDir, `${Date.now()}-${crypto.randomUUID()}.bin`);
      const hash = crypto.createHash('sha256');
      const out = fs.createWriteStream(file);
      let bytes = 0;
      req.on('data', (c) => { bytes += c.length; hash.update(c); });
      req.pipe(out);
      out.on('finish', () => {
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ bytes, sha256: hash.digest('hex'), contentType: req.headers['content-type'] }));
      });
      out.on('error', () => deny(res, 500, 'VAULT_UNAVAILABLE'));
      return;
    }
    deny(res, 404, 'NOT_FOUND');
  };
}

// 기본 포트부터 +1씩 최대 10번 시도 (POLICY 1장)
function listen(attempt = 0) {
  const port = basePort + attempt;
  const server = http.createServer(handler(port));
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < 9) return listen(attempt + 1);
    process.parentPort.postMessage({ type: 'error', message: err.message });
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    process.parentPort.postMessage({ type: 'listening', port });
  });
}
listen();
