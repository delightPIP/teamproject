import type { DaysAgo, Star } from "@spacelog/shared/types";
import { Button } from "../ui/Button.tsx";
import { Thumbnail } from "../ui/Thumbnail.tsx";
import { starTitle } from "../ui/starTitle.ts";

type Props = {
  star: Star;
  daysAgo: DaysAgo;
  planetName: string;
  /** [보러 가기]. 기간 바꾸기·이동·opened 이벤트는 개발 A(#7)가 연결 */
  onOpen(): void;
  /** [닫기]. 그날 다시 띄우지 않기·dismissed 이벤트는 개발 A(#7)가 연결 */
  onDismiss(): void;
};

/**
 * "N일 전 오늘의 별" 카드 껍데기 (SPEC 1-4). 화면만 그리고 데이터·이벤트는 props 로 받는다.
 * 후보가 없으면 부모가 렌더링하지 않는다.
 */
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
