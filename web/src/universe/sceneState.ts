// 3D 장면이 우주 홈 화면(#3)에 알려주는 값. 화면 계약(WebState)에는 넣지 않는 3D 전용 상태라 따로 둔다.
import { createStore, useStore } from "zustand";

export interface SceneState {
  /** null = 아직 확인 전 */
  webgl: boolean | null;
  /** 착륙할 수 있을 만큼 가까운 행성 ("E 착륙" 안내) */
  nearPlanetId: string | null;
  /** 기간 안 별이 상한을 넘어 별을 그리지 않음 (POLICY 3-4) */
  starsHidden: boolean;
}

export const sceneState = createStore<SceneState>()(() => ({ webgl: null, nearPlanetId: null, starsHidden: false }));

export function useSceneState<T>(selector: (s: SceneState) => T): T {
  return useStore(sceneState, selector);
}
