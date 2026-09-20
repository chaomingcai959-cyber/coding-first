#!/usr/bin/env node
/**
 * AI 播单编排工作台 · 一键启动脚本
 *
 * 设计目标：clone 下来执行一条命令即可看到项目。
 *   1) 自动安装前后端依赖（缺失时）
 *   2) 自动构建后端（dist 缺失时）
 *   3) 探测 PostgreSQL：不通则尝试用 docker compose 拉起（需本机已装 Docker）
 *   4) 并行拉起后端(3000) 与 前端(5173)
 *   5) 后端起不来时自动降级为「演示模式」，前端照样可看
 *
 * 用法：
 *   npm start                  # 全栈（缺 PG 时尝试 docker，失败则降级演示模式）
 *   npm start -- --web-only    # 只启动前端（零依赖，直接看界面）
 *   npm start -- --no-db       # 启动前后端，但不碰数据库/docker
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = path.join(ROOT, "server");
const IS_WIN = process.platform === "win32";
const NPM = IS_WIN ? "npm.cmd" : "npm";

const argv = process.argv.slice(2);
const WEB_ONLY = argv.includes("--web-only");
const NO_DB = argv.includes("--no-db");

const FRONTEND_URL = "http://127.0.0.1:5173/playlist";
const BACKEND_URL = "http://127.0.0.1:3000";

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};
const log = (msg = "", color = "") => console.log(`${color}${msg}${C.reset}`);

/** 执行命令，返回 { code, output }；silent=false 时继承 stdio */
function run(cmd, args, cwd, { silent = false, timeoutMs = 0 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: silent ? ["ignore", "pipe", "pipe"] : "inherit",
      shell: IS_WIN,
    });
    let output = "";
    if (silent) {
      child.stdout?.on("data", (d) => (output += d.toString()));
      child.stderr?.on("data", (d) => (output += d.toString()));
    }
    let timer;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
      }, timeoutMs);
    }
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? 0, output });
    });
    child.on("error", () => resolve({ code: 1, output }));
  });
}

/** TCP 端口探测 */
function portOpen(port, host = "127.0.0.1", timeoutMs = 800) {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port });
    let done = false;
    const finish = (v) => {
      if (!done) {
        done = true;
        resolve(v);
      }
      try {
        sock.destroy();
      } catch {}
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
  });
}

async function waitForPort(port, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function commandAvailable(cmd, args) {
  return run(cmd, args, ROOT, { silent: true, timeoutMs: 15000 }).then(
    (r) => r.code === 0,
  );
}

async function ensureDeps(dir, label) {
  if (existsSync(path.join(dir, "node_modules"))) {
    log(`  ✓ ${label} 依赖已就绪`, C.dim);
    return true;
  }
  log(`  → 正在安装 ${label} 依赖（首次较慢）…`, C.yellow);
  const r = await run(NPM, ["install", "--no-audit", "--no-fund"], dir);
  if (r.code !== 0) {
    log(`  ✗ ${label} 依赖安装失败，请手动执行：cd ${path.relative(ROOT, dir) || "."} && npm install`, C.red);
    return false;
  }
  log(`  ✓ ${label} 依赖安装完成`, C.green);
  return true;
}

async function buildServer() {
  const distEntry = path.join(SERVER, "dist", "main.js");
  if (existsSync(distEntry)) {
    log("  ✓ 后端构建产物已就绪", C.dim);
    return true;
  }
  log("  → 正在构建后端（TypeScript 编译）…", C.yellow);
  const r = await run(NPM, ["run", "build"], SERVER);
  if (r.code !== 0 || !existsSync(distEntry)) {
    log("  ✗ 后端构建失败，请手动执行：cd server && npm run build", C.red);
    return false;
  }
  log("  ✓ 后端构建完成", C.green);
  return true;
}

async function ensureDatabase() {
  if (await portOpen(5432)) {
    log("  ✓ PostgreSQL 已就绪（5432）", C.green);
    return true;
  }
  log("  ! 未检测到 PostgreSQL（5432），尝试用 Docker 拉起…", C.yellow);
  const hasDocker = await commandAvailable("docker", ["--version"]);
  if (!hasDocker) {
    log("  ! 本机未安装 Docker。跳过数据库，前端将以「演示模式」运行。", C.yellow);
    log("    如需全栈：安装 Docker 后重跑 npm start，或自行准备 PostgreSQL 15+ 并配置 server/.env", C.dim);
    return false;
  }
  const r = await run(
    "docker",
    ["compose", "-f", "server/docker-compose.yml", "up", "-d"],
    ROOT,
    { timeoutMs: 180000 },
  );
  if (r.code !== 0) {
    log("  ! docker compose 启动失败，前端将以「演示模式」运行。", C.yellow);
    return false;
  }
  const ok = await waitForPort(5432, 60000);
  if (ok) log("  ✓ PostgreSQL 已通过 Docker 启动（5432）", C.green);
  else log("  ! PostgreSQL 启动超时，前端将以「演示模式」运行。", C.yellow);
  return ok;
}

/** 后台常驻进程；返回 child */
function startDaemon(cmd, args, cwd, name) {
  const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], shell: IS_WIN });
  const prefix = name === "server" ? "[server] " : "[web]    ";
  const pipe = (stream) =>
    stream?.on("data", (d) => {
      d.toString()
        .split(/\r?\n/)
        .filter((l) => l.trim())
        .forEach((l) => log(`${C.dim}${prefix}${l}${C.reset}`));
    });
  pipe(child.stdout);
  pipe(child.stderr);
  return child;
}

const children = [];
function shutdown(code = 0) {
  for (const c of children) {
    try {
      if (IS_WIN) spawn("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
      else c.kill("SIGTERM");
    } catch {}
  }
  setTimeout(() => process.exit(code), 200);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main() {
  log(`\n${C.bold}AI 播单编排工作台 · 一键启动${C.reset}`);
  log("─".repeat(56), C.dim);

  const webOk = await ensureDeps(ROOT, "前端");
  if (!webOk) process.exit(1);

  let serverReady = false;
  if (!WEB_ONLY) {
    const serverDepsOk = await ensureDeps(SERVER, "后端");
    const buildOk = serverDepsOk && (await buildServer());
    const dbOk = buildOk && !NO_DB ? await ensureDatabase() : buildOk;

    if (buildOk) {
      if (!dbOk && !NO_DB) {
        log("  → 后端仍将启动，若数据库不可用会自行退出（前端降级演示模式）", C.dim);
      }
      log("  → 正在启动后端（3000）…", C.yellow);
      children.push(startDaemon(process.execPath, ["dist/main.js"], SERVER, "server"));
      serverReady = await waitForPort(3000, 30000);
      if (serverReady) log(`  ✓ 后端已就绪 ${BACKEND_URL}`, C.green);
      else log("  ! 后端未就绪（通常是数据库未启动），已进入「演示模式」", C.yellow);
    }
  }

  log("  → 正在启动前端（5173）…", C.yellow);
  children.push(startDaemon(NPM, ["run", "dev"], ROOT, "web"));
  const webReady = await waitForPort(5173, 40000);

  log("─".repeat(56), C.dim);
  if (webReady) {
    log(`\n${C.bold}${C.green}✓ 已启动${C.reset}  打开 ${C.cyan}${FRONTEND_URL}${C.reset}\n`);
  } else {
    log(`\n${C.red}✗ 前端启动异常，请手动执行 npm run dev 查看输出${C.reset}\n`);
  }
  log(`运行模式：${serverReady ? "全栈（后端 API + PostgreSQL）" : "演示模式（本地 mock 数据，无需任何外部依赖）"}`, C.dim);
  log("停止服务：Ctrl + C\n", C.dim);
}

main().catch((e) => {
  console.error(e);
  shutdown(1);
});
