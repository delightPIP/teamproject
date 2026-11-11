// 로컬 서버: 요청 처리와 포트 열기. 실행 진입점은 index.ts.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { apiError, ERROR_STATUS, type ErrorCode } from "@spacelog/shared/errors";
import type { ServerConfig } from "./config.ts";
import { RouteError } from "./http/routeError.ts";
import { checkRequest } from "./security.ts";
import { serveStatic } from "./static.ts";

export type RouteHandler = (req: IncomingMessage) => unknown | Promise<unknown>;

/** "METHOD /path" → 핸들러. 반환값을 200 JSON으로 보낸다 */
export const routes = new Map<string, RouteHandler>([["GET /api/health", () => ({ ok: true })]]);

export const MAX_PORT_ATTEMPTS = 10;

const BASE_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY", // 다른 페이지가 이 화면을 iframe에 넣어 클릭을 유도하지 못하게
  "referrer-policy": "no-referrer",
};

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(text), "cache-control": "no-store" });
  res.end(text);
}

export function sendError(res: ServerResponse, code: ErrorCode): void {
  sendJson(res, ERROR_STATUS[code], apiError(code));
}

export function createHandler(config: ServerConfig, getPort: () => number) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    for (const [k, v] of Object.entries(BASE_HEADERS)) res.setHeader(k, v);
    const method = req.method ?? "GET";
    const path = (req.url ?? "/").split("?")[0];
    const isApi = path === "/api" || path.startsWith("/api/");

    const denied = checkRequest(req, { port: getPort(), token: config.token, devOrigin: config.devOrigin, isApi });
    if (denied) return sendError(res, denied);

    try {
      if (isApi) {
        const route = routes.get(`${method} ${path}`);
        if (!route) return sendError(res, "NOT_FOUND");
        return sendJson(res, 200, await route(req));
      }
      if ((method === "GET" || method === "HEAD") && config.webDir && (await serveStatic(config.webDir, path, method, res))) return;
      sendError(res, "NOT_FOUND");
    } catch (err) {
      if (err instanceof RouteError && !res.headersSent) {
        if (err.code) return sendError(res, err.code);
        res.writeHead(err.status).end(); // 17종에 없는 잘못된 요청: 본문 없이 상태만
        return;
      }
      console.error("[server]", method, path, err);
      // 17종 코드에 없는 실패라 본문 없이 500. 웹은 "UNKNOWN"으로 처리한다 (web/src/api/client.ts)
      if (!res.headersSent) res.writeHead(500).end();
      else res.destroy();
    }
  };
}

/** 127.0.0.1에만 연다. 포트가 사용 중이면 +1씩 최대 10번 (POLICY 1-3) */
export async function startServer(config: ServerConfig): Promise<{ server: Server; port: number }> {
  let port = config.basePort;
  const server = createServer(createHandler(config, () => port));
  for (let attempt = 0; ; attempt++) {
    try {
      await new Promise<void>((ok, fail) => {
        server.once("error", fail);
        server.listen(config.basePort === 0 ? 0 : config.basePort + attempt, "127.0.0.1", () => {
          server.off("error", fail);
          ok();
        });
      });
      const addr = server.address();
      port = typeof addr === "object" && addr ? addr.port : port;
      return { server, port };
    } catch (err) {
      const inUse = (err as NodeJS.ErrnoException).code === "EADDRINUSE";
      if (!inUse || attempt + 1 >= MAX_PORT_ATTEMPTS || config.basePort === 0) throw err;
    }
  }
}
