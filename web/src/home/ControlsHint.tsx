import { useEffect, useState } from "react";
import { store } from "../state/store.ts";
import { Button } from "../ui/Button.tsx";
import { useSceneState } from "../universe/sceneState.ts";

const SEEN_KEY = "spacelog.controlsHintSeen";

function seen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** 오른쪽 위 비행 조작 안내 + [⌂ 조망]. 첫 방문엔 펼치고 이후엔 ? 로 접는다 (SPEC 1-4) */
export function ControlsHint() {
  const webgl = useSceneState((s) => s.webgl);
  const [open, setOpen] = useState(() => !seen());
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // 저장 못 하면 다음에도 펼쳐 보인다
    }
  }, []);
  if (!webgl) return null;
  return (
    <div className="hint card">
      {open && (
        <p className="hint__keys">
          <span><kbd>WASD</kbd>이동</span>
          <span><kbd>Space</kbd><kbd>Shift</kbd>상승·하강</span>
          <span><kbd>드래그</kbd>시점</span>
          <span><kbd>E</kbd>착륙</span>
          <span><kbd>Esc</kbd>뒤로</span>
        </p>
      )}
      <Button className="btn--icon" aria-label={open ? "조작 안내 접기" : "조작 안내 보기"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        ?
      </Button>
      <Button variant="primary" onClick={() => store.getState().returnToOverview()}>⌂ 조망</Button>
    </div>
  );
}
