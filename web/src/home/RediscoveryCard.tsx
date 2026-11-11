import type { DaysAgo, Star } from "@spacelog/shared/types";
import { useRediscoveryCard } from "../rediscovery/rediscovery.ts";
import { useStore } from "../state/store.ts";
import { Button } from "../ui/Button.tsx";
import { Thumbnail } from "../ui/Thumbnail.tsx";
import { starTitle } from "../ui/starTitle.ts";

type Props = {
  star: Star;
  daysAgo: DaysAgo;
  planetName: string;
  /** [보러 가기] */
  onOpen(): void;
  /** [닫기] */
  onDismiss(): void;
};

/**
 * 우주 홈의 재발견 카드 (SPEC 1-4). 오늘의 별·이벤트 기록·별 열기는 개발 A의 useRediscoveryCard()(#7)가 맡는다.
 * 후보가 없거나 오늘 닫았으면 그리지 않는다.
 */
export function RediscoverySlot() {
  const { today, open, dismiss } = useRediscoveryCard();
  const planetName = useStore((s) => s.planets.find((p) => p.id === today?.star.planetId)?.name);
  if (!today) return null;
  return <RediscoveryCard star={today.star} daysAgo={today.daysAgo} planetName={planetName ?? "행성"} onOpen={open} onDismiss={dismiss} />;
}

/** "N일 전 오늘의 별" 카드 화면. 데이터·이벤트는 props 로 받는다 */
export function RediscoveryCard({ star, daysAgo, planetName, onOpen, onDismiss }: Props) {
  const title = starTitle(star);
  return (
    <aside className="rediscovery card" aria-label={`${daysAgo}일 전 오늘의 별`}>
      <div className="rediscovery__eyebrow">{daysAgo}일 전 오늘의 별 ✦</div>
      <div className="rediscovery__body">
        <Thumbnail star={star} size={56} />
        <div className="rediscovery__text">
          <strong className="rediscovery__title" title={title}>{title}</strong>
          <span className="rediscovery__planet">{planetName}</span>
        </div>
      </div>
      <div className="rediscovery__actions">
        <Button variant="secondary" onClick={onDismiss}>닫기</Button>
        <Button variant="primary" onClick={onOpen}>보러 가기</Button>
      </div>
    </aside>
  );
}
