// 鉴权（附录 C2）：一期无认证体系，以 X-User-Id 标识调用方 + 频道权限校验（G2）
import {
  CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { authRequired } from "./errors";

export interface RequestUser {
  id: string;
  nickname: string;
  role: "editor" | "viewer" | "admin";
}

// 一期用户目录（账号预置，正式认证体系二期接入）
export const USER_DIRECTORY: Record<string, RequestUser> = {
  "u-yang": { id: "u-yang", nickname: "杨经理", role: "editor" },
  "u-viewer": { id: "u-viewer", nickname: "李观察", role: "viewer" },
  "u-admin": { id: "u-admin", nickname: "王管理员", role: "admin" },
};

export const CurrentUser = createParamDecorator((_d, ctx: ExecutionContext): RequestUser => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
});

export const IS_PUBLIC = Symbol("IS_PUBLIC");
export const Public = () => SetMetadata(IS_PUBLIC as never, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC as never, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest();
    const uid = req.headers["x-user-id"] as string | undefined;
    const user = uid ? USER_DIRECTORY[uid] : undefined;
    if (!user) throw authRequired();
    req.user = user;
    return true;
  }
}
