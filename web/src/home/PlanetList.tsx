import { store, useStore } from "../state/store.ts";
import { useSceneState } from "../universe/sceneState.ts";

/**
 * 왼쪽 "행성으로 바로 날아가기" (SPEC 1-4, POLICY 2-5)
 * 기간 안 별 수 내림차순, 미분류는 맨 아래. 0개 행성은 흐리게, 누르면 날아가지 않고 패널만 연다.
 */
export function PlanetList() {
  const planets = useStore((s) => s.planets);
  const selected = useStore((s) => s.selectedPlanetId);
  const near = useSceneState((s) => s.nearPlanetId);
  const sorted = [...planets].sort(
    (a, b) => Number(!!a.system) - Number(!!b.system) || (b.starCountInPeriod ?? 0) - (a.starCountInPeriod ?? 0),
  );
  return (
    <nav className="dock" aria-label="행성으로 바로 날아가기">
      <div className="dock__label">행성으로 바로 날아가기</div>
      <ul>
        {sorted.map((p) => {
          const n = p.starCountInPeriod ?? 0;
          const here = p.id === near || p.id === selected;
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`dock__item${here ? " is-here" : ""}${n === 0 ? " is-empty" : ""}`}
                aria-current={p.id === selected ? "true" : undefined}
                onClick={() => (n > 0 ? store.getState().flyToPlanet(p.id, "openPanel") : store.getState().openPanel(p.id))}
              >
                <span className="dock__dot" style={{ background: `var(--${p.colorToken})` }} />
                <span className="dock__name">{p.name}</span>
                <span className="dock__n">{n}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
