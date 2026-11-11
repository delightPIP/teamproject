// 로컬 서버 보안 — POLICY 1-3, SPEC 3-1.
// 순서: Host → Origin → (API만) 세션 토큰. 하나라도 틀리면 403/401. CORS 헤더는 보내지 않는다.
import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { ErrorCode } from "@spacelog/shared/errors";

export const TOKEN_HEADER = "x-session-token";

/** DNS 리바인딩 방어: Host가 이 PC의 이 포트가 아니면 거부 */
export function hostAllowed(host: string | undefined, port: number): boolean {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

/** 다른 웹페이지의 호출 차단. Origin이 없으면(직접 주소 입력·수집 앱) 통과 */
export function originAllowed(origin: string | undefined, port: number, devOrigin: string | null): boolean {
  if (origin === undefined) return true;
  return origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}` || (devOrigin !== null && origin === devOrigin);
}

export function tokenMatches(given: string | string[] | undefined, token: string): boolean {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 요청을 통과시키면 null, 막으면 오류 코드 */
export function checkRequest(
  req: IncomingMessage,
  opts: { port: number; token: string; devOrigin: string | null; isApi: boolean },
): ErrorCode | null {
  if (!hostAllowed(req.headers.host, opts.port)) return "FORBIDDEN_ORIGIN";
  if (!originAllowed(req.headers.origin, opts.port, opts.devOrigin)) return "FORBIDDEN_ORIGIN";
  // 정적 파일은 토큰 없이: 토큰은 페이지가 열린 뒤 해시에서 읽히고, 정적 파일에는 기록 데이터가 없다 (ADR 0002 5-1)
  if (opts.isApi && !tokenMatches(req.headers[TOKEN_HEADER], opts.token)) return "UNAUTHORIZED";
  return null;
}
