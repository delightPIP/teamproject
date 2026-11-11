import type { ReactNode } from "react";
import { Button } from "./Button.tsx";

type Props = { tone?: "info" | "warning" | "error"; children: ReactNode; action?: { label: string; onClick(): void; disabled?: boolean } };

/** 상단 경고 띠 + 액션 버튼 (서버 끊김, 기간 확장 등). 우선순위 고르기는 우주 홈(이슈 #3)이 한다 */
export function Banner({ tone = "info", children, action }: Props) {
  return (
    <div className={`banner banner--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span className="banner__message">{children}</span>
      {action && <Button onClick={action.onClick} disabled={action.disabled}>{action.label}</Button>}
    </div>
  );
}
