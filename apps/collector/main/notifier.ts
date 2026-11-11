// 재발견 알림 (SPEC 1-3, 3-6 알림 보내기, POLICY 2-2). 별 고르기는 서버(개발 A)가 한다.
// 알려진 문제: 윈도우 개발 모드에서 알림 클릭 이벤트가 오지 않았다 (ADR 0001 4-1).
// 데모 대안 경로는 웹의 재발견 카드와 트레이 "오늘의 별 보기".
import type { Planet, RediscoveryEventRequest, RediscoveryTodayResponse, UniverseResponse } from "@spacelog/shared/types";
import { Notification } from "electron";
import { starTitle } from "../dropzone/precheck.ts";
import type { Api } from "./api.ts";
import { localDateOf, notificationTitle, shouldNotify } from "./notifySchedule.ts";
import type { SettingsStore } from "./settingsStore.ts";

const CHECK_EVERY_MS = 60_000;

export class Notifier {
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  // 알림 객체를 붙잡아 두지 않으면 GC로 사라져 click 이벤트가 오지 않는다 (스파이크에서 확인)
  private live = new Set<Notification>();

  private api: Api;
  private settings: SettingsStore;
  private openStar: (starId: string) => void;

  constructor(api: Api, settings: SettingsStore, openStar: (starId: string) => void) {
    this.api = api;
    this.settings = settings;
    this.openStar = openStar;
  }

  start(): void {
    this.timer = setInterval(() => void this.tick(), CHECK_EVERY_MS);
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<void> {
    if (this.busy || !Notification.isSupported()) return;
    const s = this.settings.get();
    if (!shouldNotify({ enabled: s.rediscoveryNotification, time: this.settings.notificationTime(), lastNotifiedLocalDate: s.lastNotifiedLocalDate, now })) return;
    this.busy = true;
    try {
      const today = localDateOf(now);
      const res = await this.api.request<RediscoveryTodayResponse>("GET", "/api/rediscovery/today");
      // 서버가 꺼졌거나 API가 아직 없으면 다음 분에 다시 본다 (오늘을 보낸 것으로 치지 않음)
      if (!res.ok) return;
      if (res.data === null) {
        this.settings.update({ lastNotifiedLocalDate: today }); // 후보 없음 → 오늘은 보내지 않는다
        return;
      }
      const { star, daysAgo } = res.data;
      const planet = await this.planetName(star.planetId, star.localDate ?? today);
      this.show(star.id, notificationTitle(daysAgo), planet ? `${starTitle(star)} · ${planet}` : starTitle(star));
      this.settings.update({ lastNotifiedLocalDate: today });
    } finally {
      this.busy = false;
    }
  }

  private show(starId: string, title: string, body: string): void {
    const n = new Notification({ title, body });
    this.live.add(n);
    n.on("show", () => void this.event(starId, "shown"));
    n.on("close", () => this.live.delete(n));
    n.on("click", () => {
      this.live.delete(n);
      void this.event(starId, "opened");
      this.openStar(starId);
    });
    n.show();
  }

  private async event(starId: string, type: RediscoveryEventRequest["type"]): Promise<void> {
    const body: RediscoveryEventRequest = { starId, channel: "notification", type };
    await this.api.request("POST", "/api/rediscovery/events", body);
  }

  /** 행성 이름은 별에 없어서 기간 조회로 찾는다. 실패하면 이름 없이 보낸다 */
  private async planetName(planetId: string, date: string): Promise<string | null> {
    const res = await this.api.request<UniverseResponse>("GET", `/api/universe?from=${date}&to=${date}`);
    if (!res.ok) return null;
    return res.data.planets.find((p: Planet) => p.id === planetId)?.name ?? null;
  }
}
