import { useState } from "react";
import { customPeriod, todayPeriod, weekPeriod } from "@spacelog/shared/period";
import type { Period } from "@spacelog/shared/types";
import { store, useStore } from "../state/store.ts";
import { Button } from "../ui/Button.tsx";

const dot = (d: string) => d.replaceAll("-", ".");

/** 오늘 / 이번 주 / 직접 지정(최대 1년) (POLICY 2-1, SPEC 1-4) */
export function PeriodPicker() {
  const period = useStore((s) => s.period);
  const [editing, setEditing] = useState(false);
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const set = (p: Period) => void store.getState().setPeriod(p);

  const apply = () => {
    if (!from || !to) return;
    const p = customPeriod(from, to);
    const wantedTo = from > to ? from : to;
    if (p.to !== wantedTo) store.getState().showToast(`최대 1년까지 볼 수 있어 ${dot(p.to)}까지로 맞췄어요`);
    set(p);
    setEditing(false);
  };

  const preset = (key: Period["preset"], label: string, onClick: () => void) => (
    <button type="button" className={`seg__item${period.preset === key ? " is-on" : ""}`} aria-pressed={period.preset === key} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <div className="period">
      <div className="seg" role="group" aria-label="기간">
        {preset("today", "오늘", () => set(todayPeriod()))}
        {preset("week", "이번 주", () => set(weekPeriod()))}
        {preset("custom", "직접 지정", () => {
          setFrom(period.from);
          setTo(period.to);
          setEditing((v) => !v);
        })}
      </div>
      {period.preset === "custom" && !editing && (
        <span className="period__range">
          {dot(period.from)} ~ {dot(period.to)}
        </span>
      )}
      {editing && (
        <form
          className="period__form"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <input type="date" aria-label="시작일" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} required />
          <span aria-hidden="true">~</span>
          <input type="date" aria-label="종료일" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} required />
          <Button type="submit" variant="primary">보기</Button>
        </form>
      )}
    </div>
  );
}
