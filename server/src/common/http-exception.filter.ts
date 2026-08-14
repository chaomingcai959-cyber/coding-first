// 异常 → 统一错误 envelope（规格 02 §1/§2）
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { Response } from "express";
import { randomUUID } from "crypto";
import { ERR } from "./errors";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const traceId = randomUUID();

    if (exception instanceof HttpException) {
      const body = exception.getResponse() as { code?: number; message?: string | string[] };
      const code = typeof body?.code === "number" ? body.code : ERR.INTERNAL_ERROR;
      const message = Array.isArray(body?.message)
        ? body.message.join("；")
        : body?.message || "系统繁忙，请稍后重试";
      res.status(exception.getStatus()).json({ code, message, trace_id: traceId });
      return;
    }
    res.status(500).json({ code: ERR.INTERNAL_ERROR, message: "系统繁忙，请稍后重试", trace_id: traceId });
  }
}
