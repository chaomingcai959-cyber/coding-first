// 独立 DataSource（migration 与 seed 共用；与 app.module 的 forRoot 配置保持一致）
import { DataSource } from "typeorm";
import { ALL_ENTITIES } from "./entities";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.PG_HOST || "127.0.0.1",
  port: parseInt(process.env.PG_PORT || "5432", 10),
  username: process.env.PG_USER || "workbench",
  password: process.env.PG_PASSWORD || "workbench",
  database: process.env.PG_DB || "workbench",
  entities: ALL_ENTITIES,
  synchronize: process.env.TYPEORM_SYNC === "1",
});
