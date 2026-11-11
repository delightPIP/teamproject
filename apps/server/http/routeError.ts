// 라우트가 던지는 요청 오류. app.ts가 받아 응답으로 바꾼다.
// - code가 있으면 SPEC 2-6 오류 형식({"error":{code,message}})과 그 코드의 상태
// - code가 없으면(17종에 없는 잘못된 요청) 본문 없이 status만. 웹은 UNKNOWN으로 처리한다
import { ERROR_STATUS, type ErrorCode } from "@spacelog/shared/errors";

export class RouteError extends Error {
  readonly status: number;
  readonly code: ErrorCode | null;

  constructor(status: number, code: ErrorCode | null = null, message: string = code ?? `HTTP ${status}`) {
    super(message);
    this.status = status;
    this.code = code;
  }

  static of(code: ErrorCode): RouteError {
    return new RouteError(ERROR_STATUS[code], code);
  }

  /** 본문 형식이 틀림 (17종에 해당 코드 없음) */
  static badRequest(reason: string): RouteError {
    return new RouteError(400, null, reason);
  }
}
