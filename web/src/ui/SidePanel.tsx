import type { ReactNode } from "react";
import { Button } from "./Button.tsx";

type Props = { title: ReactNode; onClose(): void; children: ReactNode; footer?: ReactNode; headerExtra?: ReactNode };

/** 오른쪽 사이드 패널 (행성 패널, 별 상세). 헤더 · 본문 · 하단 고정 영역 */
export function SidePanel({ title, onClose, children, footer, headerExtra }: Props) {
  return (
    <aside className="side-panel card" aria-label={typeof title === "string" ? title : undefined}>
      <header className="side-panel__header">
        <h2 className="side-panel__title">{title}</h2>
        {headerExtra}
        <Button className="btn--icon" onClick={onClose} aria-label="닫기">✕</Button>
      </header>
      <div className="side-panel__body">{children}</div>
      {footer && <footer className="side-panel__footer">{footer}</footer>}
    </aside>
  );
}
