// 启动期配置加载：读取 server/.env（若存在）注入 process.env
// 密钥纪律（PRD §10 S8）：DEEPSEEK_API_KEY 仅存在于此 .env / 部署环境变量，严禁入库、入前端、入 Git
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

export function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2];
    }
  }
}

export const config = {
  deepseek: {
    get key() { return process.env.DEEPSEEK_API_KEY || ""; },
    get baseUrl() { return process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1"; },
    get model() { return process.env.DEEPSEEK_MODEL || "deepseek-v4-pro"; },
  },
};
