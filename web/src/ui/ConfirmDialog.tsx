import type { ReactNode } from "react";
import { Button } from "./Button.tsx";
import { Modal } from "./Modal.tsx";

type Props = {
  open: boolean;
  title: ReactNode;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm(): void;
  onCancel(): void;
};

/** 합치기·삭제 확인창 (SPEC 1-5, 1-6) */
export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel = "취소", danger, busy, onConfirm, onCancel }: Props) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>{confirmLabel}</Button>
        </>
      }
    >
      {message}
    </Modal>
  );
}
