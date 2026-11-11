// main ↔ preload ↔ 렌더러(드롭존·설정) 사이의 계약. 타입만 둔다.
import type { Settings, StarKind } from "@spacelog/shared/types";
import type { ServerState } from "./serverProcess.ts";

export interface DropFileItem {
  name: string;
  type: string;
  size: number;
  isDirectory: boolean;
  path?: string; // 탐색기·Finder에서 끌어온 파일
  bytes?: Uint8Array; // 경로가 없는 파일 (브라우저에서 끌어온 이미지, 붙여넣은 캡처)
}

export type DropInput = { files: DropFileItem[] } | { uriList: string; text: string };

export interface SavedStar {
  id: string;
  kind: StarKind;
  title: string;
  planetId: string;
}

export interface SaveResult {
  source: "drop" | "paste" | "shortcut";
  stars: SavedStar[];
  /** 중복·거부된 항목의 이유 (파일 이름: 이유) */
  lines: string[];
  /** 전체 실패 문구. 별이 하나도 안 생기고 lines도 없으면 이 문구를 보인다 */
  error: string | null;
  /** main이 서버 응답을 받기까지 걸린 시간 */
  serverMs: number;
}

export interface PlanetOption {
  id: string;
  name: string;
}

export interface DropzoneStatus {
  server: ServerState;
  todayCount: number | null;
  planets: PlanetOption[];
  freeBytes: number | null;
  shortcut: string;
}

export interface ConfirmInput {
  ids: string[];
  planetId?: string;
  memo?: string | null;
}

export interface StorageInfo {
  vaultPath: string;
  usedBytes: number | null;
  freeBytes: number | null;
}

export interface SettingsView extends Settings {
  shortcutRegistered: boolean;
  notificationTimeEffective: string;
  isPackaged: boolean;
}

export type DropzoneMode = "collapsed" | "expanded" | "confirm";

export interface CollectorBridge {
  /** dirs[i]: 렌더러가 webkitGetAsEntry로 본 폴더 여부 (File 객체에 속성을 붙이면 contextBridge에서 사라진다) */
  saveFiles(files: File[], dirs: boolean[], source: "drop" | "paste"): Promise<SaveResult>;
  saveText(input: { uriList: string; text: string }, source: "drop" | "paste"): Promise<SaveResult>;
  confirm(input: ConfirmInput): Promise<{ ok: boolean; error: string | null }>;
  status(): Promise<DropzoneStatus>;
  setMode(mode: DropzoneMode, height?: number): void;
  openUniverse(): void;
  openSettings(): void;
  metric(entry: Record<string, unknown>): void;
  onShortcutResult(cb: (r: SaveResult) => void): void;
  onStatus(cb: (s: DropzoneStatus) => void): void;
  onSaving(cb: () => void): void;
}

export interface SettingsBridge {
  get(): Promise<SettingsView>;
  update(patch: Partial<Settings>): Promise<{ settings: SettingsView; error: string | null }>;
  storage(): Promise<StorageInfo>;
  openVault(): void;
  chooseVault(): Promise<{ settings: SettingsView; error: string | null } | null>;
}
