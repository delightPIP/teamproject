// 전역 단축키 → 클립보드 1건 저장 (SPEC 1-2). 기본값 CommandOrControl+Shift+Space (S2 확정).
import { globalShortcut } from "electron";

export class Shortcut {
  private current: string | null = null;

  private onPress: () => void;
  constructor(onPress: () => void) {
    this.onPress = onPress;
  }

  /** 등록에 실패하면(다른 앱이 이미 씀 등) 이전 단축키를 되살리고 false */
  register(accelerator: string): boolean {
    const prev = this.current;
    if (prev) globalShortcut.unregister(prev);
    let ok = false;
    try {
      ok = globalShortcut.register(accelerator, this.onPress);
    } catch {
      ok = false; // 형식이 틀린 accelerator
    }
    if (ok) {
      this.current = accelerator;
      return true;
    }
    if (prev) globalShortcut.register(prev, this.onPress);
    return false;
  }

  get registered(): boolean {
    return this.current !== null && globalShortcut.isRegistered(this.current);
  }

  dispose(): void {
    globalShortcut.unregisterAll();
  }
}

export { shortcutLabel } from "./shortcutLabel.ts";
