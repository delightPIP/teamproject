// 로컬 API fetch 래퍼 (SPEC 2-6, 3-3).
// - 모든 요청에 X-Session-Token 헤더
// - 오류는 ApiError(code, 화면 문구)로 던진다. 서버 문구가 있으면 그것을, 없으면 아래 기본 문구를 쓴다
// - 서버에 닿지 못하면(네트워크 실패) connection = "lost", 응답을 받으면 "ok"
import type { Star, Universe } from "../types";

const TOKEN_KEY = "space-archive.sessionToken";

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // 저장소를 못 쓰면 이번 페이지에서만 쓴다
    memoryToken = token;
  }
}
let memoryToken: string | null = null;
const currentToken = () => getToken() ?? memoryToken;

export const MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "수집 앱의 [우주 보기]로 다시 열어 주세요",
  FORBIDDEN_ORIGIN: "수집 앱의 [우주 보기]로 다시 열어 주세요",
  NETWORK: "수집 앱이 꺼져 있거나 응답하지 않아요",
  NOT_FOUND: "찾을 수 없어요",
  PLANET_NAME_INVALID: "행성 이름은 1~20자로 지어 주세요",
  PLANET_NAME_DUPLICATE: "같은 이름의 행성이 이미 있어요",
  PLANET_LIMIT: "행성은 50개까지 만들 수 있어요",
  PLANET_NOT_EMPTY: "별이 있는 행성은 지울 수 없어요",
  PLANET_SYSTEM: "미분류 행성은 바꾸거나 지울 수 없어요",
  ORIGINAL_MISSING: "원본을 찾을 수 없어요",
  VAULT_UNAVAILABLE: "보관함을 찾을 수 없어요",
  DISK_FULL: "디스크 공간이 부족해요",
  UNKNOWN: "문제가 생겼어요. 잠시 후 다시 시도해 주세요",
};

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Listeners = { onConnection(s: "ok" | "lost"): void; onUnauthorized(): void };
let listeners: Listeners = { onConnection() {}, onUnauthorized() {} };
export function setApiListeners(l: Listeners): void {
  listeners = l;
}

type Mock = (method: string, path: string, body?: unknown) => Promise<unknown>;
let mock: Mock | null = null;
/** 목업 모드(`npm run dev:mock`)에서 main.ts가 등록한다. */
export function setMock(m: Mock | null): void {
  mock = m;
}

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = currentToken();
  if (token) headers["X-Session-Token"] = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    listeners.onConnection("lost");
    throw new ApiError("NETWORK", MESSAGES.NETWORK, 0);
  }
  listeners.onConnection("ok");
  if (res.ok) return res;

  const err = await res.json().catch(() => null);
  const code: string = err?.error?.code ?? (res.status === 401 ? "UNAUTHORIZED" : "UNKNOWN");
  if (res.status === 401 || code === "UNAUTHORIZED") listeners.onUnauthorized();
  throw new ApiError(code, err?.error?.message ?? MESSAGES[code] ?? MESSAGES.UNKNOWN, res.status);
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (mock) {
    const data = await mock(method, path, body);
    listeners.onConnection("ok");
    return data as T;
  }
  const res = await send(method, path, body);
  return (res.status === 204 ? null : await res.json()) as T;
}

/** 이미지처럼 <img>가 헤더를 못 붙이는 바이트 응답. 다 쓰면 URL.revokeObjectURL 로 해제한다. */
export async function requestObjectUrl(path: string): Promise<string> {
  if (mock) throw new ApiError("NOT_FOUND", MESSAGES.NOT_FOUND, 404);
  const res = await send("GET", path);
  return URL.createObjectURL(await res.blob());
}

export const api = {
  universe: (from: string, to: string) =>
    request<Universe>("GET", `/api/universe?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  star: (id: string) => request<Star>("GET", `/api/stars/${encodeURIComponent(id)}`),
};
