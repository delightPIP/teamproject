// SPEC 2-1, 2-2, 2-5를 옮긴 타입.
// shortcut: packages/shared(이슈 #1)가 아직 없어 웹에 임시로 둔다. #1이 머지되면 이 파일을 지우고 shared에서 가져온다.

export type StarKind = "image" | "file" | "link" | "text";

export interface Star {
  id: string;
  kind: StarKind;
  planetId: string;
  createdAtUtc: string;
  tzOffsetMin: number;
  updatedAtUtc: string;
  storagePath: string | null;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  url: string | null;
  linkTitle: string | null;
  linkDomain: string | null;
  textBody: string | null;
  thumbnailPath: string | null;
  thumbnailStatus: "pending" | "ready" | "fallback";
  linkFetchStatus: "none" | "pending" | "done" | "failed";
  memo: string | null;
  originalMissing?: boolean;
  localDate?: string;
}

export interface Planet {
  id: string;
  name: string;
  system: "uncategorized" | null;
  defaultFor: StarKind | "other" | null;
  colorToken: string;
  createdAtUtc: string;
  starCountInPeriod?: number;
  starCountTotal?: number;
}

export interface Period {
  preset: "today" | "week" | "custom";
  from: string; // 현지 날짜 "YYYY-MM-DD"
  to: string;
}

export type CargoItem =
  | { type: "star"; starId: string }
  | { type: "planet"; planetId: string; period: Period }
  | { type: "universe"; period: Period };

export type Camera = "overview" | "flight" | "flyingTo" | "landed";

export interface WebState {
  period: Period;
  periodAutoExpanded: boolean;
  stars: Star[];
  planets: Planet[];
  connection: "ok" | "lost";
  lastSyncedAt: string | null;
  camera: Camera;
  selectedPlanetId: string | null;
  selectedStarId: string | null;
  cargo: CargoItem[];
  exportFormat: "claude" | "mcp";
}

export interface Universe {
  stars: Star[];
  planets: Planet[];
}
