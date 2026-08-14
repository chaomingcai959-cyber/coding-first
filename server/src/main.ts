import "reflect-metadata";
import { loadEnv } from "./config";
loadEnv(); // 最先加载 .env（密钥仅经环境变量注入，S8）
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { WsAdapter } from "@nestjs/platform-ws";
import { DataSource } from "typeorm";
import { AppModule } from "./app.module";
import { seed } from "./database/seed";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app)); // WS /ws（规格 02 §4）
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableCors({ origin: true }); // 一期本地联调放开；私有化部署时收敛为前端域名
  await app.init();
  await seed(app.get(DataSource)); // 预置账号/频道/权限（C2），复用应用内连接
  const port = parseInt(process.env.PORT || "3000", 10);
  await app.listen(port);
  console.log(`[workbench-server] listening on http://127.0.0.1:${port} (WS: /ws)`);
}
bootstrap();
