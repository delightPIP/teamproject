// 넣은 직후 확인 카드 (SPEC 1-1, POLICY 2-3·2-6).
// 행성·메모는 이번에 넣은 모든 별에 같이 적용. 입력이 없으면 10초 후 지금 값으로 확정하고 접힌다.
import { useEffect, useRef, useState } from "react";
import type { PlanetOption, SaveResult } from "../main/ipcTypes.ts";
import { MEMO_MAX, cleanMemo } from "./precheck.ts";

export interface Preview {
  name: string;
  url: string | null; // 이미지면 미리보기 object URL
}

export const AUTO_CONFIRM_MS = 10_000; // SPEC 6장 S2 확정

const KIND_ICON = { image: "🖼", file: "📄", link: "🔗", text: "✎" } as const;

export function ConfirmCard({ result, previews, planets, onDone }: { result: SaveResult; previews: Preview[]; planets: PlanetOption[]; onDone(): void }) {
  const stars = result.stars;
  const assigned = stars[0].planetId;
  const samePlanet = stars.every((s) => s.planetId === assigned);
  const [planetId, setPlanetId] = useState<string>(samePlanet ? assigned : "");
  const [memo, setMemo] = useState("");
  const [touched, setTouched] = useState(false);
  const [left, setLeft] = useState(AUTO_CONFIRM_MS / 1000);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const memoRef = useRef<HTMLInputElement>(null);

  // 서버가 준 행성이 목록에 없으면(목록을 아직 못 받음 등) 그 행성을 "자동 배정"으로 보인다
  const options = planets.some((p) => p.id === assigned) || !samePlanet ? planets : [{ id: assigned, name: "자동 배정" }, ...planets];

  async function commit(apply: boolean) {
    if (saving) return;
    if (!apply) return onDone(); // 건너뛰기: 기본 배정 그대로
    const patch: { ids: string[]; planetId?: string; memo?: string | null } = { ids: stars.map((s) => s.id) };
    if (planetId && (!samePlanet || planetId !== assigned)) patch.planetId = planetId;
    if (memo.trim()) patch.memo = cleanMemo(memo.trim());
    if (!patch.planetId && patch.memo === undefined) return onDone();
    setSaving(true);
    const r = await window.collector.confirm(patch);
    setSaving(false);
    if (r.ok) onDone();
    else {
      setError(r.error);
      setTouched(true); // 오류를 읽을 수 있게 자동 접힘을 멈춘다
    }
  }

  // 자동 확정: 입력·드롭다운을 건드리면 멈춘다
  useEffect(() => {
    if (touched) return;
    if (left <= 0) {
      void commit(true);
      return;
    }
    const t = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, touched]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return; // 한글 조합 중 Enter는 확정이 아니다
      if (e.key === "Enter" && (e.target as HTMLElement)?.tagName === "BUTTON") return; // 버튼 위 Enter는 그 버튼대로
      if (e.key === "Enter") {
        e.preventDefault();
        void commit(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        void commit(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planetId, memo, saving]);

  // 오류 문구가 생기면 창 높이를 다시 맞춘다 (body는 overflow:hidden)
  useEffect(() => {
    window.collector.setMode("confirm", document.getElementById("card")?.scrollHeight);
  }, [error]);

  const one = stars.length === 1 ? stars[0] : null;
  return (
    <div className="card" id="card" role="dialog" aria-label="넣은 직후 확인">
      <p className="card-head">{one ? "별을 넣었어요 ✦" : `별 ${stars.length}개를 넣었어요 ✦`}</p>
      <div className="thumbs">
        {(previews.length > 0 ? previews : stars.slice(0, 4).map((s) => ({ name: s.title, url: null }))).slice(0, 4).map((p, i) => (
          <div className="thumb" key={i} title={p.name}>
            {p.url ? <img src={p.url} alt="" /> : <span aria-hidden>{KIND_ICON[stars[i]?.kind ?? "file"]}</span>}
          </div>
        ))}
      </div>
      {one && <p className="card-title">{one.title}</p>}
      {result.lines.length > 0 && (
        <ul className="card-lines">
          {result.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
      <label className="field">
        <span>배정된 행성</span>
        <select
          value={planetId}
          onChange={(e) => {
            setPlanetId(e.target.value);
            setTouched(true);
          }}
          onFocus={() => setTouched(true)}
        >
          {!samePlanet && <option value="">행성별 자동 배정 유지</option>}
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>
          한 줄 메모 <em className="count">{memo.length}/{MEMO_MAX}</em>
        </span>
        <input
          ref={memoRef}
          value={memo}
          maxLength={MEMO_MAX}
          placeholder="나중에 알아볼 한 마디"
          onChange={(e) => {
            setMemo(e.target.value.replace(/[\r\n]+/g, " "));
            setTouched(true);
          }}
          onFocus={() => setTouched(true)}
        />
      </label>
      {error && (
        <p className="card-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="button" onClick={() => void commit(true)} disabled={saving}>
          완료
        </button>
        <button type="button" className="ghost" onClick={() => void commit(false)} disabled={saving}>
          건너뛰기
        </button>
        {!touched && <span className="auto">{left}초 후 접혀요</span>}
      </div>
    </div>
  );
}
