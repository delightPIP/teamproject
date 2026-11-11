import { useEffect } from "react";
import { MESSAGES } from "./api/client";
import { store, useStore } from "./state/store";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { SidePanel } from "./ui/SidePanel";
import { ToastHost } from "./ui/Toast";

/**
 * 웹 껍데기. 화면 자리만 잡는다.
 * - 우주 홈(TopBar, PlanetList, UniverseCanvas …): 개발 C, 이슈 #3
 * - 행성 패널·별 상세: 개발 B, 이슈 #5
 * - 탐사선: 개발 A, 이슈 #8
 * 각자 화면이 나오면 아래 "자리 표시" 컴포넌트를 바꿔 끼운다.
 */
export function App() {
  const auth = useStore((s) => s.auth);
  useEscape();

  if (auth === "required") return <AuthRequired />;
  return (
    <div className="app">
      <ConnectionBanner />
      <main className="app__main">
        <HomePlaceholder />
      </main>
      <PanelPlaceholder />
      <ProbePlaceholder />
      <ToastHost />
    </div>
  );
}

function AuthRequired() {
  return (
    <div className="auth-required" role="alert">
      <h1>{MESSAGES.UNAUTHORIZED}</h1>
      <p>이 창은 보안을 위해 수집 앱에서 열어야 볼 수 있어요.</p>
    </div>
  );
}

/** 서버 끊김 배너 (SPEC 3-4). 다른 배너와의 우선순위는 우주 홈(#3)에서 합친다 */
function ConnectionBanner() {
  const lost = useStore((s) => s.connection === "lost");
  const loading = useStore((s) => s.loading);
  if (!lost) return null;
  return (
    <Banner tone="error" action={{ label: "다시 시도", onClick: () => void store.getState().refresh(), disabled: loading }}>
      {MESSAGES.NETWORK}
    </Banner>
  );
}

/** Esc: 탐사선 → 상세 → 패널 → 조망 (SPEC 3-5). 입력 중이거나 대화상자가 열려 있으면 무시 */
function useEscape() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (document.querySelector("dialog[open]")) return; // 대화상자는 스스로 닫힌다
      store.getState().goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

// ───────── 자리 표시 (각 담당 이슈에서 교체) ─────────

function HomePlaceholder() {
  const planets = useStore((s) => s.planets);
  const period = useStore((s) => s.period);
  const stars = useStore((s) => s.stars.length);
  const cargo = useStore((s) => s.cargo.length);
  const auto = useStore((s) => s.periodAutoExpanded);
  return (
    <>
      <p className="placeholder">
        우주 홈 자리 (이슈 #3) · 기간 {period.from} ~ {period.to} · 별 {stars} · 행성 {planets.length}
        {auto && " · 오늘은 별이 없어 이번 주 우주를 보여드려요"}
      </p>
      <Button onClick={() => store.getState().openProbe()}>🚀 탐사선 {cargo}</Button>
      <ul className="placeholder-list">
        {planets.map((p) => (
          <li key={p.id}>
            <Button
              variant="ghost"
              className={p.starCountInPeriod ? undefined : "is-empty"}
              onClick={() => (p.starCountInPeriod ? store.getState().flyToPlanet(p.id, "openPanel") : store.getState().openPanel(p.id))}
            >
              ● {p.name} {p.starCountInPeriod ?? 0}
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}

function PanelPlaceholder() {
  const planetId = useStore((s) => s.selectedPlanetId);
  const starId = useStore((s) => s.selectedStarId);
  const planet = useStore((s) => s.planets.find((p) => p.id === planetId));
  const stars = useStore((s) => s.stars);
  if (!planetId && !starId) return null;
  const close = () => store.getState().closePanel();

  if (starId) {
    return (
      <SidePanel title="별 상세 자리 (이슈 #5)" onClose={close}>
        <Button variant="ghost" onClick={() => planetId && store.getState().openPanel(planetId)} disabled={!planetId}>← 행성으로</Button>
        <p className="placeholder">별 {starId}</p>
        <Button onClick={() => store.getState().addToCargo({ type: "star", starId }) || store.getState().showToast("이미 실은 별이에요")}>🚀 싣기</Button>
      </SidePanel>
    );
  }
  const own = stars.filter((s) => s.planetId === planetId);
  return (
    <SidePanel title={planet?.name ?? "행성"} onClose={close}>
      <p className="placeholder">행성 패널 자리 (이슈 #5)</p>
      <ul className="placeholder-list">
        {own.map((s) => (
          <li key={s.id}>
            <Button variant="ghost" onClick={() => store.getState().openStar(s.id)}>
              {s.linkTitle ?? s.originalName ?? s.textBody?.slice(0, 30) ?? s.id}
            </Button>
          </li>
        ))}
      </ul>
    </SidePanel>
  );
}

function ProbePlaceholder() {
  const open = useStore((s) => s.route.name === "probe");
  const cargo = useStore((s) => s.cargo);
  return (
    <Modal open={open} title="🚀 탐사선" onClose={() => store.getState().goBack()} wide>
      <p className="placeholder">탐사선 자리 (이슈 #8) · 실은 것 {cargo.length}개</p>
    </Modal>
  );
}
