// 수집 앱 설정 (SPEC 1-2, 2-4).
// SPEC 2-4는 서버와 설정을 공유하지만 서버의 GET/PATCH /api/settings는 아직 없다 (#33 범위 밖).
// 그래서 수집 앱이 userData/settings.json에 직접 두고, 서버에는 보관함 위치만 환경 변수로 넘긴다.
import type { Settings } from "@spacelog/shared/types";
import { app } from "electron";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const DEFAULT_SHORTCUT = "CommandOrControl+Shift+Space"; // SPEC 6장 S2 확정
export const DEFAULT_NOTIFICATION_TIME = "15:00"; // POLICY 2-2 (잠정)

export function defaultSettings(): Settings {
  return {
    vaultPath: path.join(app.getPath("documents"), "SpaceLog"),
    shortcut: DEFAULT_SHORTCUT,
    rediscoveryNotification: true,
    notificationTime: DEFAULT_NOTIFICATION_TIME,
    launchAtLogin: true,
    lastNotifiedLocalDate: null,
    onboardingDone: false,
  };
}

export class SettingsStore {
  private file = path.join(app.getPath("userData"), "settings.json");
  private value: Settings;

  constructor() {
    let saved: Partial<Settings> = {};
    try {
      saved = JSON.parse(readFileSync(this.file, "utf8"));
    } catch {
      /* 첫 실행 또는 깨진 파일 → 기본값 */
    }
    this.value = { ...defaultSettings(), ...saved };
  }

  get(): Settings {
    return { ...this.value };
  }

  update(patch: Partial<Settings>): Settings {
    this.value = { ...this.value, ...patch };
    mkdirSync(path.dirname(this.file), { recursive: true });
    // 쓰다가 꺼져도 파일이 깨지지 않게 임시 파일 → 이름 바꾸기
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.value, null, 2));
    renameSync(tmp, this.file);
    return this.get();
  }

  /**
   * 알림 시각. 개발 전용 SPACELOG_NOTIFY_AT="HH:MM"이 있으면 덮어쓴다 (SPEC 1-2, DEMO 1장).
   * 배포 빌드(app.isPackaged)에서는 읽지 않는다.
   */
  notificationTime(): string {
    const env = process.env.SPACELOG_NOTIFY_AT;
    if (!app.isPackaged && env && /^([01]\d|2[0-3]):[0-5]\d$/.test(env)) return env;
    return this.value.notificationTime;
  }
}
