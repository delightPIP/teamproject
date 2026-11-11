// 탐사선 (W-04, SPEC 1-7·3-8, 이슈 #8). 고른 기록만 Claude가 읽기 좋은 형식으로 만들어 복사한다.
import { useEffect, useRef, useState } from "react";
import type { ExportFormat, ExportResponse } from "@spacelog/shared/types";
import { api, RequestError } from "../api/client.ts";
import { store, useStore } from "../state/store.ts";
import { Banner } from "../ui/Banner.tsx";
import { Button } from "../ui/Button.tsx";
import { Modal } from "../ui/Modal.tsx";
import { cargoRow, hasUniverse, periodText } from "./cargoLabel.ts";
import "./probe.css";

const PREVIEW_DELAY_MS = 250;
const FORMATS: { value: ExportFormat; label: string; hint: string }[] = [
  { value: "claude", label: "Claude 프롬프트", hint: "정리된 텍스트" },
  { value: "mcp", label: "MCP 리소스", hint: "JSON" },
];

type Preview =
  | { state: "empty" }
  | { state: "loading" }
  | { state: "ready"; result: ExportResponse }
  | { state: "error"; message: string };

export function ProbeModal() {
  const open = useStore((s) => s.route.name === "probe");
  const cargo = useStore((s) => s.cargo);
  const format = useStore((s) => s.exportFormat);
  const preview = useExportPreview(open, format);
  const [manualCopy, setManualCopy] = useState(false);

  useEffect(() => setManualCopy(false), [cargo, format, open]);

  const content = preview.state === "ready" ? preview.result.content : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      store.getState().showToast("복사했어요. Claude에 붙여넣으세요", "success");
    } catch {
      setManualCopy(true); // 클립보드가 막히면 직접 선택해 복사 (AC-탐사선-7)
    }
  };

  return (
    <Modal
      open={open}
      wide
      title="🚀 탐사선"
      onClose={() => store.getState().goBack()}
      footer={
        <>
          <p className="probe__privacy">고른 것만 복사돼요. 자동으로 보내지 않아요.</p>
          <Button variant="primary" onClick={() => void copy()} disabled={preview.state !== "ready" || cargo.length === 0}>
            복사하기
          </Button>
        </>
      }
    >
      <div className="probe">
        <CargoList />
        <section className="probe__output" aria-label="내보내기">
          <FormatPicker format={format} />
          <ExportPreview preview={preview} manualCopy={manualCopy} />
        </section>
      </div>
    </Modal>
  );
}

function CargoList() {
  const cargo = useStore((s) => s.cargo);
  const stars = useStore((s) => s.stars);
  const planets = useStore((s) => s.planets);
  const period = useStore((s) => s.period);
  const universeLoaded = hasUniverse(cargo, period);

  return (
    <section className="probe__cargo" aria-label="실은 목록">
      <div className="probe__cargo-head">
        <h3>실은 것 {cargo.length}</h3>
        <Button
          variant="accent"
          disabled={universeLoaded || stars.length === 0}
          onClick={() => store.getState().addToCargo({ type: "universe", period })}
        >
          이 기간 우주 전체 싣기
        </Button>
      </div>
      {cargo.length === 0 ? (
        <p className="probe__empty">
          아직 실은 게 없어요. 행성 패널이나 별 상세에서 [싣기]를 누르거나, 위 버튼으로 {periodText(period)} 우주 전체를 실어 보세요.
        </p>
      ) : (
        <ul className="probe__list">
          {cargo.map((item, i) => {
            const row = cargoRow(item, i, { stars, planets });
            return (
              <li key={row.key} className={`probe__item probe__item--${row.kind}`}>
                <span className="probe__item-title">{row.title}</span>
                <span className="probe__item-detail">{row.detail}</span>
                <Button
                  variant="ghost"
                  className="btn--icon"
                  aria-label={`${row.title} 빼기`}
                  onClick={() => store.getState().removeFromCargo(i)}
                >
                  ✕
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FormatPicker({ format }: { format: ExportFormat }) {
  return (
    <fieldset className="probe__formats">
      <legend>형식</legend>
      {FORMATS.map((f) => (
        <label key={f.value} className={`probe__format${format === f.value ? " is-selected" : ""}`}>
          <input
            type="radio"
            name="export-format"
            value={f.value}
            checked={format === f.value}
            onChange={() => store.getState().setExportFormat(f.value)}
          />
          {f.label} <small>{f.hint}</small>
        </label>
      ))}
    </fieldset>
  );
}

function ExportPreview({ preview, manualCopy }: { preview: Preview; manualCopy: boolean }) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (manualCopy) textRef.current?.select();
  }, [manualCopy]);

  if (preview.state === "empty") return <p className="probe__empty">실은 것이 있으면 여기에 복사될 내용이 그대로 보여요.</p>;
  if (preview.state === "loading") return <p className="probe__empty" aria-busy="true">만드는 중…</p>;
  if (preview.state === "error") return <Banner tone="error">{preview.message}</Banner>;

  const { result } = preview;
  return (
    <>
      {manualCopy && <Banner tone="warning">클립보드를 쓸 수 없어요. 직접 선택해 복사해 주세요</Banner>}
      {result.overLimit && (
        <Banner tone="warning">내용이 길어요 ({result.charCount.toLocaleString()}자). 복사는 할 수 있어요</Banner>
      )}
      <textarea
        ref={textRef}
        className="probe__preview"
        readOnly
        value={result.content}
        aria-label="복사될 내용 미리보기"
        onFocus={(e) => manualCopy && e.currentTarget.select()}
      />
      <p className="probe__count">{result.charCount.toLocaleString()}자</p>
    </>
  );
}

/** 실은 목록·형식이 바뀌면 서버에 내보내기 결과를 다시 받는다. 늦게 온 이전 응답은 버린다 */
function useExportPreview(open: boolean, format: ExportFormat): Preview {
  const cargo = useStore((s) => s.cargo);
  const [preview, setPreview] = useState<Preview>({ state: "empty" });

  useEffect(() => {
    if (!open) return;
    if (cargo.length === 0) {
      setPreview({ state: "empty" });
      return;
    }
    let stale = false;
    setPreview({ state: "loading" });
    const timer = setTimeout(() => {
      api
        .exportCargo({ items: cargo, format })
        .then((result) => !stale && setPreview({ state: "ready", result }))
        .catch((e: unknown) => {
          if (stale) return;
          const message = e instanceof RequestError ? e.message : "내보낼 내용을 만들지 못했어요";
          setPreview({ state: "error", message });
        });
    }, PREVIEW_DELAY_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [open, cargo, format]);

  return preview;
}
