import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

type Props = { open: boolean; title: ReactNode; onClose(): void; children: ReactNode; footer?: ReactNode; wide?: boolean };

/** 브라우저 기본 <dialog>로 포커스 가두기와 Esc 닫기를 맡긴다. */
export function Modal({ open, title, onClose, children, footer, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal${wide ? " modal--wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open && (
        <>
          <header className="modal__header">
            <h2 className="modal__title">{title}</h2>
            <Button variant="ghost" onClick={onClose} aria-label="닫기">✕</Button>
          </header>
          <div className="modal__body">{children}</div>
          {footer && <footer className="modal__footer">{footer}</footer>}
        </>
      )}
    </dialog>
  );
}
