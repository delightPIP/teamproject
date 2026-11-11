import { store, useStore } from "../state/store.ts";
import { useSceneState } from "../universe/sceneState.ts";

/** 행성 표면 3r 안에 들어오면 "E 착륙" 안내. 눌러도 착륙한다 (SPEC 3-5) */
export function NearPrompt() {
  const id = useSceneState((s) => s.nearPlanetId);
  const name = useStore((s) => s.planets.find((p) => p.id === id)?.name);
  if (!id || !name) return null;
  return (
    <button
      type="button"
      className="btn btn--primary near"
      onClick={() => {
        store.getState().openPanel(id);
        store.getState().setCamera("landed");
      }}
    >
      <kbd>E</kbd> '{name}'에 착륙
    </button>
  );
}
