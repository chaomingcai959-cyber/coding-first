// 错误码（规格 02 §2）
import { HttpException, HttpStatus } from "@nestjs/common";

export const ERR = {
  AUTH_REQUIRED: 1001,
  AUTH_FORBIDDEN: 1002,
  LOCK_OCCUPIED: 1003,
  LOCK_NOT_HELD: 1004,
  CONFIRM_TOKEN_INVALID: 1005,
  VERSION_CONFLICT: 1006,
  VALIDATION_FAILED: 2001,
  CONTENT_REJECTED: 3001,
  AI_TIMEOUT: 3002,
  INTERNAL_ERROR: 9000,
} as const;

export class BizException extends HttpException {
  constructor(public readonly bizCode: number, message: string, status: HttpStatus = HttpStatus.OK) {
    super({ code: bizCode, message }, status);
  }
}

export const authRequired = () => new BizException(ERR.AUTH_REQUIRED, "缺少用户标识，请重新进入", HttpStatus.UNAUTHORIZED);
export const authForbidden = () => new BizException(ERR.AUTH_FORBIDDEN, "您没有该频道的操作权限", HttpStatus.FORBIDDEN);
export const lockOccupied = (holder: string) =>
  new BizException(ERR.LOCK_OCCUPIED, `频道正在被 ${holder} 占用，暂无法编辑生成播单`);
export const lockNotHeld = () => new BizException(ERR.LOCK_NOT_HELD, "编辑锁已失效，请刷新后重试");
export const confirmTokenInvalid = () => new BizException(ERR.CONFIRM_TOKEN_INVALID, "确认已过期，请重新确认操作");
export const contentRejected = () => new BizException(ERR.CONTENT_REJECTED, "输入内容包含违规信息，请调整后重试");
