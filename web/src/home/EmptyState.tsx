import { useStore } from "../state/store.ts";

/** 빈 우주 안내 (POLICY 3-2). 전체 0건이면 첫 실행 안내 */
export function EmptyState() {
  const show = useStore((s) => s.lastSyncedAt !== null && !s.loading && s.stars.length === 0);
  const total = useStore((s) => s.planets.reduce((n, p) => n + (p.starCountTotal ?? 0), 0));
  const custom = useStore((s) => s.period.preset === "custom");
  if (!show) return null;
  if (total === 0)
    return (
      <div className="empty card" role="status">
        <h2>첫 별을 띄워 보세요 ✦</h2>
        <p>화면 가장자리의 드롭존에 파일·링크·글을 끌어다 놓으면 별이 돼요.</p>
        <p>
          클립보드는 <kbd>⌘⇧Space</kbd> (윈도우 <kbd>Ctrl+Shift+Space</kbd>)로 바로 넣을 수 있어요.
        </p>
      </div>
    );
  return (
    <div className="empty card" role="status">
      <p>{custom ? "이 기간에는 별이 없어요. 기간을 넓혀 보세요" : "드롭존에 첫 별을 끌어다 놓아 보세요"}</p>
    </div>
  );
}
