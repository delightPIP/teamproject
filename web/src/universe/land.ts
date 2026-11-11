import { store } from "../state/store.ts";

/** 행성에 착륙 → 패널 (SPEC 3-5). E 키와 착륙 안내 버튼이 같이 쓴다 */
export function landOn(planetId: string): void {
  const s = store.getState();
  s.openPanel(planetId);
  s.setCamera("landed");
}
