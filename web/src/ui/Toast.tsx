import { useEffect } from "react";
import { store, useStore, type ToastItem } from "../state/store.ts";

const DURATION_MS = 4000;

/** 화면 아래 토스트. 띄우기는 store.getState().showToast(문구, 종류) */
export function ToastHost() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => <Toast key={t.id} toast={t} />)}
    </div>
  );
}

function Toast({ toast }: { toast: ToastItem }) {
  useEffect(() => {
    const id = setTimeout(() => store.getState().dismissToast(toast.id), DURATION_MS);
    return () => clearTimeout(id);
  }, [toast.id]);
  return (
    <div className={`toast card toast--${toast.kind}`} onClick={() => store.getState().dismissToast(toast.id)}>
      {toast.message}
    </div>
  );
}
