// 넣은 직후 확인 카드의 일괄 수정 (SPEC 2-6, 3-2). 수집 앱이 부른다.
//   PATCH /api/stars  { ids: string[], planetId?: string, memo?: string | null } → StarsResponse
// 웹용 PATCH /api/stars/:id (별 상세 메모 1,000자)는 여기 없다. 이번 범위 밖이다 (PRD 3장).
//
// 이 파일은 db.ts·stars.ts를 고치지 않고 vault.db에서 직접 문장을 만든다 (같은 파일을 두 사람이 고치지 않으려고).
import type { Star, StarsResponse } from "@spacelog/shared/types";
import type { RouteHandler } from "../app.ts";
import { isObject, readJson } from "../http/body.ts";
import { RouteError } from "../http/routeError.ts";
import type { Vault } from "../vault/db.ts";

/** 수집 앱 메모 상한 (packages/shared/types.ts BulkUpdateStarsRequest) */
export const MEMO_MAX = 140;
/** 확인 카드는 한 번에 최대 20개까지 넣는다 (P 2-6 파일 20개) */
export const MAX_IDS = 20;

export interface BulkUpdate {
  ids: string[];
  planetId?: string;
  memo?: string | null;
}

/** 본문 검사. 틀리면 400, 없는 별·행성이면 NOT_FOUND */
export function parseBulkUpdate(body: unknown): BulkUpdate {
  if (!isObject(body)) throw RouteError.badRequest("본문이 객체가 아니에요");
  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((v) => typeof v !== "string" || !v)) {
    throw RouteError.badRequest("ids는 비어 있지 않은 문자열 배열이어야 해요");
  }
  if (ids.length > MAX_IDS) throw RouteError.badRequest(`한 번에 ${MAX_IDS}개까지 바꿀 수 있어요`);
  const out: BulkUpdate = { ids: ids as string[] };
  if (body.planetId !== undefined) {
    if (typeof body.planetId !== "string" || !body.planetId) throw RouteError.badRequest("planetId가 올바르지 않아요");
    out.planetId = body.planetId;
  }
  if (body.memo !== undefined) {
    if (body.memo === null) out.memo = null;
    else if (typeof body.memo !== "string") throw RouteError.badRequest("memo는 문자열이거나 null이어야 해요");
    else {
      const memo = body.memo.trim();
      if (memo.length > MEMO_MAX) throw RouteError.badRequest(`메모는 ${MEMO_MAX}자까지 쓸 수 있어요`);
      out.memo = memo === "" ? null : memo;
    }
  }
  return out;
}

export function updateStars(vault: Vault, body: unknown, now: Date): StarsResponse {
  const patch = parseBulkUpdate(body);
  if (patch.planetId === undefined && patch.memo === undefined) {
    // 바꿀 게 없으면 지금 값을 그대로 돌려준다 (수집 앱은 이 경우 호출하지 않지만 방어)
    return { stars: patch.ids.map((id) => mustGet(vault, id)) };
  }

  if (patch.planetId !== undefined) {
    const planet = vault.db.prepare("SELECT 1 FROM planets WHERE id = ?").get(patch.planetId);
    if (!planet) throw RouteError.of("NOT_FOUND");
  }
  for (const id of patch.ids) mustGet(vault, id);

  const at = now.toISOString();
  const setPlanet = vault.db.prepare("UPDATE stars SET planetId = ?, updatedAtUtc = ? WHERE id = ?");
  const setMemo = vault.db.prepare("UPDATE stars SET memo = ?, updatedAtUtc = ? WHERE id = ?");
  vault.db.exec("BEGIN");
  try {
    for (const id of patch.ids) {
      if (patch.planetId !== undefined) setPlanet.run(patch.planetId, at, id);
      if (patch.memo !== undefined) setMemo.run(patch.memo, at, id);
    }
    vault.db.exec("COMMIT");
  } catch (err) {
    vault.db.exec("ROLLBACK");
    throw err;
  }
  return { stars: patch.ids.map((id) => mustGet(vault, id)) };
}

function mustGet(vault: Vault, id: string): Star {
  const star = vault.getStar(id);
  if (!star) throw RouteError.of("NOT_FOUND");
  return star;
}

export function starUpdateRoutes(vault: Vault, deps: { now?: () => Date } = {}): Record<string, RouteHandler> {
  const now = deps.now ?? (() => new Date());
  return { "PATCH /api/stars": async (req) => updateStars(vault, await readJson(req), now()) };
}
