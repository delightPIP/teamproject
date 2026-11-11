// 수집 앱 → 로컬 서버 호출. 렌더러는 서버를 직접 부르지 않는다:
// 드롭존 페이지의 Origin(file://)은 서버 Origin 검사에 걸리고, 토큰을 렌더러에 둘 이유도 없다.
import { isApiError, type ErrorCode } from "@spacelog/shared/errors";
import type { ServerProcess } from "./serverProcess.ts";

export type ApiFailure = { ok: false; code: ErrorCode | "UNKNOWN" | "SERVER_DOWN"; message: string | null; status: number | null };
export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

export class Api {
  private server: ServerProcess;
  constructor(server: ServerProcess) {
    this.server = server;
  }

  async request<T>(method: string, path: string, body?: BodyInit | object, timeoutMs = 15_000): Promise<ApiResult<T>> {
    const base = this.server.baseUrl;
    if (!base) return { ok: false, code: "SERVER_DOWN", message: null, status: null };
    const headers: Record<string, string> = { "x-session-token": this.server.token };
    let payload: BodyInit | undefined;
    if (body instanceof FormData || typeof body === "string" || body === undefined) payload = body as BodyInit | undefined;
    else {
      payload = JSON.stringify(body);
      headers["content-type"] = "application/json";
    }
    try {
      const res = await fetch(base + path, { method, headers, body: payload, signal: AbortSignal.timeout(timeoutMs) });
      const text = await res.text();
      const json: unknown = text ? JSON.parse(text) : null;
      if (res.ok) return { ok: true, data: json as T };
      if (isApiError(json)) return { ok: false, code: json.error.code, message: json.error.message, status: res.status };
      return { ok: false, code: "UNKNOWN", message: null, status: res.status };
    } catch (err) {
      console.error("[collector] API", method, path, err);
      return { ok: false, code: "UNKNOWN", message: null, status: null };
    }
  }
}
