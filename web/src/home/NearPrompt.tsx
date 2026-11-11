import { useStore } from "../state/store.ts";
import { landOn } from "../universe/land.ts";
import { useSceneState } from "../universe/sceneState.ts";

/** 행성 표면 8 안에 들어오면 "E 'OO' 행성 열기" 안내. 눌러도 착륙한다 (DESIGN W-01) */
export function NearPrompt() {
  const id = useSceneState((s) => s.nearPlanetId);
  const name = useStore((s) => s.planets.find((p) => p.id === id)?.name);
  if (!id || !name) return null;
  return (
    <button
      type="button"
      className="btn btn--primary near"
      onClick={() => landOn(id)}
    >
      <kbd>E</kbd> '{name}' 행성 열기
    </button>
  );
}
