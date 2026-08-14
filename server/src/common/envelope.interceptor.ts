// 统一响应 envelope（规格 02 §1）：成功 {code:0,data}，异常经过滤器输出 {code,message,trace_id}
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { map, Observable } from "rxjs";

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => ({ code: 0, data: data ?? null })));
  }
}
