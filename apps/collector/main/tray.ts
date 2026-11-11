// 트레이·메뉴바 아이콘과 메뉴 (SPEC 1-2). 상태 점 3종: 정상 / 서버 오류(빨강) / 보관함 오류(노랑).
// 아이콘 파일은 디자이너 2 시안 전까지 코드로 그린다.
import { Menu, Tray, nativeImage, type NativeImage } from "electron";

export type TrayStatus = "ok" | "serverError" | "vaultError";

const SIZE = 16;

/** 보라 원 + (오류면) 오른쪽 아래 점. BGRA 비트맵 */
function drawIcon(status: TrayStatus): NativeImage {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  const c = (SIZE - 1) / 2;
  const dot = status === "serverError" ? [0x3a, 0x3a, 0xe8] : status === "vaultError" ? [0x2a, 0xc8, 0xf0] : null; // BGR
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const inPlanet = Math.hypot(x - c, y - c) <= 6.5;
      const inDot = dot && Math.hypot(x - 12, y - 12) <= 3.5;
      if (inDot) buf.set([dot[0], dot[1], dot[2], 0xff], i);
      else if (inPlanet) buf.set([0xe0, 0x8a, 0x9a, 0xff], i);
    }
  }
  return nativeImage.createFromBitmap(buf, { width: SIZE, height: SIZE });
}

const TOOLTIP: Record<TrayStatus, string> = {
  ok: "SpaceLog",
  serverError: "SpaceLog · 로컬 서버를 켜지 못했어요",
  vaultError: "SpaceLog · 보관함을 찾을 수 없어요",
};

export interface TrayActions {
  openUniverse(): void;
  toggleDropzone(): void;
  showDropzone(): void;
  saveClipboard(): void;
  openRediscovery(): void;
  openSettings(): void;
  restartServer(): void;
  quit(): void;
  shortcutLabel(): string;
}

export class AppTray {
  private tray: Tray;
  private status: TrayStatus = "ok";

  private actions: TrayActions;

  constructor(actions: TrayActions) {
    this.actions = actions;
    this.tray = new Tray(drawIcon("ok"));
    this.tray.setToolTip(TOOLTIP.ok);
    // 윈도우: 왼쪽 클릭 → 드롭존 펼침 (SPEC 1-1 expanded 진입 조건). 맥은 클릭하면 메뉴가 뜬다
    this.tray.on("click", () => actions.showDropzone());
    this.rebuildMenu();
  }

  setStatus(status: TrayStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.tray.setImage(drawIcon(status));
    this.tray.setToolTip(TOOLTIP[status]);
    this.rebuildMenu();
  }

  rebuildMenu(): void {
    const a = this.actions;
    const items: Electron.MenuItemConstructorOptions[] = [
      { label: "우주 보기", click: a.openUniverse },
      { label: "드롭존 보이기/숨기기", click: a.toggleDropzone },
      { label: `클립보드 넣기\t${a.shortcutLabel()}`, click: a.saveClipboard },
      // 알림 클릭이 윈도우 개발 모드에서 오지 않는 문제의 대안 경로 (ADR 0001 4장)
      { label: "오늘의 별 보기", click: a.openRediscovery },
      { type: "separator" },
      { label: "설정", click: a.openSettings },
    ];
    if (this.status === "serverError") items.push({ label: "로컬 서버 다시 켜기", click: a.restartServer });
    items.push({ type: "separator" }, { label: "종료", click: a.quit });
    this.tray.setContextMenu(Menu.buildFromTemplate(items));
  }

  destroy(): void {
    this.tray.destroy();
  }
}
