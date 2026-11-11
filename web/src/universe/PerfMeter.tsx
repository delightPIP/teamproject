import { useStore } from "../state/store.ts";
import { useSceneState } from "./sceneState.ts";

/** 개발 모드에서 `#/?token=dev&perf` 로 열면 별 개수와 초당 프레임 수를 보여준다 (성능 측정) */
export function PerfMeter() {
  const fps = useSceneState((s) => s.fps);
  const stars = useStore((s) => s.stars.length);
  const hidden = useSceneState((s) => s.starsHidden);
  if (!import.meta.env.DEV || !new URLSearchParams(location.hash.split("?")[1]).has("perf")) return null;
  return (
    <output className="perf card" aria-live="off">
      별 {stars}개{hidden ? " (안 그림)" : ""} · {fps} fps
    </output>
  );
}
