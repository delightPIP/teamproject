// 공통 데이터 모델 — docs/SPEC.md 2-1 ~ 2-6 기준. 전원 공용이므로 바꿀 때는 개발 A·B·C, PO 합의.
import type { ErrorCode } from "./errors.ts";

// ── 2-1. Star (기록 / 별) ────────────────────────────────────────────
export type StarKind = "image" | "file" | "link" | "text";

export interface Star {
  id: string; // ULID (넣은 순서로 정렬 가능)
  kind: StarKind;
  planetId: string;

  // 시각 (P 1-4): UTC + 넣을 때의 시간대 오프셋
  createdAtUtc: string; // ISO 8601, 예 "2026-11-11T06:12:03Z"
  tzOffsetMin: number; // 예 540 (KST). 기록용 — 화면 계산은 지금 PC 시간대 기준 (period.ts)
  updatedAtUtc: string;

  // 원본 (image·file, 그리고 100,000자 초과 text → .txt 파일)
  storagePath: string | null; // 보관함 기준 상대 경로, 예 "originals/2026/11/01J...png"
  originalName: string | null; // 없으면 화면에 "이름 없는 기록"
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null; // 중복 검사 (P 2-6)

  // 링크
  url: string | null;
  linkTitle: string | null; // 없으면 화면에 도메인
  linkDomain: string | null; // 예 "youtube.com"

  // 텍스트 (100,000자 이하)
  textBody: string | null;

  // 썸네일 (P 1-5)
  thumbnailPath: string | null;
  thumbnailStatus: "pending" | "ready" | "fallback"; // fallback = 유형 아이콘

  // 링크 정보 가져오기 (P 1-5, 3-1)
  linkFetchStatus: "none" | "pending" | "done" | "failed";

  memo: string | null; // 수집 앱 140자 / 웹 1,000자

  // 서버가 조회 시 계산해 내려주는 값 (저장 안 함)
  originalMissing?: boolean; // 보관함에서 원본이 사라짐 ⚠ (P 3-4)
  localDate?: string; // "2026-11-11", 지금 PC 시간대 기준
}

// ── 2-2. Planet (행성) ──────────────────────────────────────────────
export interface Planet {
  id: string; // ULID. 시스템 행성은 고정 id
  name: string; // 1~20자, 대소문자 무시 유니크
  system: "uncategorized" | null; // "미분류"만 값이 있음 → 이름 변경·삭제 불가
  defaultFor: StarKind | "other" | null; // 자동 배정용 기본 행성 (P 2-3, 잠정)
  colorToken: string; // 디자이너 1의 행성 테마 토큰 이름, 예 "planet-3"
  createdAtUtc: string;

  // 조회 시 계산
  starCountInPeriod?: number;
  starCountTotal?: number;
}

export const PLANET_NAME_MAX = 20;
export const PLANET_LIMIT = 50; // 미분류 포함 (P 2-4, 잠정)

// ── 2-3. 재발견 (개발 A) ────────────────────────────────────────────
export type DaysAgo = 7 | 14 | 30;

export interface RediscoveryPick {
  localDate: string; // "2026-11-11" (PK)
  starId: string | null; // 후보가 없으면 null → 그날은 알림·카드 없음
  daysAgo: DaysAgo | null;
  pickedAtUtc: string;
}

export interface RediscoveryEvent {
  id: string;
  localDate: string;
  starId: string;
  channel: "notification" | "card";
  type: "shown" | "opened" | "dismissed";
  atUtc: string;
}

// ── 2-4. Settings (수집 앱과 서버가 공유) ────────────────────────────
export interface Settings {
  vaultPath: string;
  shortcut: string; // 예 "CommandOrControl+Shift+Space"
  rediscoveryNotification: boolean; // 기본 true
  notificationTime: string; // "HH:mm", 기본 "15:00" (잠정, P 2-2)
  launchAtLogin: boolean; // 기본 true
  lastNotifiedLocalDate: string | null; // 몰아 보내기 방지
  onboardingDone: boolean;
}

// ── 2-5. 웹 클라이언트 상태 (웹 화면 계약, 개발 A·B·C 합의 대상) ────
export type PeriodPreset = "today" | "week" | "custom";
export interface Period {
  preset: PeriodPreset;
  from: string; // 현지 날짜 "YYYY-MM-DD" (포함)
  to: string; // 현지 날짜 "YYYY-MM-DD" (포함)
}

export type CargoItem =
  | { type: "star"; starId: string }
  | { type: "planet"; planetId: string; period: Period }
  | { type: "universe"; period: Period };

export type ExportFormat = "claude" | "mcp";

export interface WebState {
  period: Period;
  periodAutoExpanded: boolean; // 오늘 0건 → 이번 주로 넓힘
  stars: Star[];
  planets: Planet[];
  connection: "ok" | "lost";
  lastSyncedAt: string | null;

  camera: "overview" | "flight" | "flyingTo" | "landed";
  selectedPlanetId: string | null;
  selectedStarId: string | null;

  cargo: CargoItem[];
  exportFormat: ExportFormat;
}

// ── 2-6. 로컬 API 요청·응답 (개발 B 제안, 1일 차 리뷰 대상) ────────────
// 모든 요청에 X-Session-Token 헤더. 오류 응답은 errors.ts의 ApiError.

/** GET /api/health */
export interface HealthResponse {
  ok: true;
}

/** GET /api/universe?from=YYYY-MM-DD&to=YYYY-MM-DD — 기간 안의 별 + 모든 행성 */
export interface UniverseResponse {
  stars: Star[];
  planets: Planet[]; // starCountInPeriod·starCountTotal 포함
}

/** GET /api/stars/:id — 별 1개 (textBody 포함) */
export type StarResponse = Star;

/** POST /api/stars (JSON 본문일 때). 파일은 multipart 필드 "files"로 최대 20개 */
export type CreateTextOrLinkRequest =
  | { kind: "text"; text: string }
  | { kind: "link"; url: string };

/** POST /api/stars 응답 — 일부만 실패해도 나머지는 저장 (P 3-3) */
export interface CreateStarsResponse {
  created: Star[];
  duplicates: {
    name: string | null; // 넣은 파일 이름 (없으면 null)
    existingStarId: string;
    planetId: string;
    planetName: string; // "이미 [행성]에 있는 별이에요"
  }[];
  rejected: {
    name: string | null;
    code: Extract<
      ErrorCode,
      "FOLDER_NOT_ALLOWED" | "FILE_TOO_LARGE" | "TOO_MANY_FILES" | "UNSUPPORTED_CLIPBOARD" | "TEXT_EMPTY" | "DISK_FULL"
    >;
    message: string;
  }[];
}

/** PATCH /api/stars — 넣은 직후 확인 카드 일괄 적용 */
export interface BulkUpdateStarsRequest {
  ids: string[];
  planetId?: string;
  memo?: string | null; // 최대 140자
}

/** PATCH /api/stars/:id */
export interface UpdateStarRequest {
  memo?: string | null; // 최대 1,000자
  planetId?: string;
}

/** POST /api/stars/move */
export interface MoveStarsRequest {
  ids: string[];
  planetId: string;
}

/** POST /api/stars/:id/open */
export interface OpenStarRequest {
  mode: "file" | "folder";
}

/** PATCH 계열 응답 — 바뀐 별들 */
export interface StarsResponse {
  stars: Star[];
}

/** POST /api/planets · PATCH /api/planets/:id */
export interface PlanetNameRequest {
  name: string;
}

/** POST /api/planets/:id/merge — :id 를 targetId 에 합치고 :id 삭제 */
export interface MergePlanetRequest {
  targetId: string;
}

/** GET /api/rediscovery/today — 후보가 없으면 null */
export type RediscoveryTodayResponse = { star: Star; daysAgo: DaysAgo } | null;

/** POST /api/rediscovery/events */
export type RediscoveryEventRequest = Omit<RediscoveryEvent, "id" | "atUtc" | "localDate">;

/** POST /api/export */
export interface ExportRequest {
  items: CargoItem[];
  format: ExportFormat;
}
export interface ExportResponse {
  content: string;
  charCount: number;
  overLimit: boolean; // 50,000자 초과 → 경고만, 복사는 허용 (P 2-8)
}

/** GET /api/settings → Settings, PATCH /api/settings */
export type UpdateSettingsRequest = Partial<Omit<Settings, "lastNotifiedLocalDate">>; // 알림 기록은 서버만 씀

/** GET /api/storage — 보관함 크기·남은 공간 */
export interface StorageResponse {
  vaultPath: string;
  usedBytes: number; // 보관함 전체 (DB + 원본 + 썸네일)
  freeBytes: number; // 보관함이 있는 디스크의 남은 공간
  lowDisk: boolean; // freeBytes < 1GB → 드롭존 경고 (P 3-1)
}
