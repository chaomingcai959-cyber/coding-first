# AI 播单编排工作台 · 配置与维护手册

> 一期技术栈：前端 React18+TS+Vite+Zustand（`workbench/`）｜后端 NestJS+TypeORM（`workbench/server/`）｜PostgreSQL 15（`D:\Application\sql`）｜DeepSeek-V4-Pro（经 S8 LLM 网关）  
> 规格文档：`workbench/specs/`（SDD：改代码前先改规格）

---

## 一、环境配置（新机器一次性）

### 1. PostgreSQL

```bash
# 启动 / 停止（已安装于 D:\Application\sql）
D:\Application\sql\pgsql\bin\pg_ctl.exe -D D:\Application\sql\data start
D:\Application\sql\pgsql\bin\pg_ctl.exe -D D:\Application\sql\data stop
# 连接参数：127.0.0.1:5432  账号/密码/库名均为 workbench
```

### 2. 后端配置（`server/.env`，已入 .gitignore）

| 变量                              | 说明          | 备注                                                           |
| ------------------------------- | ----------- | ------------------------------------------------------------ |
| `DEEPSEEK_API_KEY`              | DeepSeek 密钥 | **严禁入库/入前端/入 Git**；换 Key 只改这里                                |
| `DEEPSEEK_BASE_URL`             | 接入端点        | 默认 `https://api.deepseek.com/v1`                             |
| `DEEPSEEK_MODEL`                | 对话模型        | `deepseek-v4-pro`（推理模型，思考过程映射到前端"思考块"）                       |
| `DEEPSEEK_CLASSIFY_MODEL`       | 意图分类模型      | 默认 `deepseek-chat`（v4-flash，满足语义解析 ≤2s SLO；勿用 pro，推理耗时会超时降级） |
| `PG_HOST/PORT/USER/PASSWORD/DB` | 数据库连接       | 私有化部署时改为客户环境值                                                |
| `TYPEORM_SYNC`                  | 自动建表开关      | **仅首次启动为 1**；之后必须改 0，结构变更走 migration                         |
| `PORT`                          | 后端端口        | 默认 3000                                                      |

### 3. 前端配置（环境变量或 `.env`）

| 变量              | 说明             | 默认                                  |
| --------------- | -------------- | ----------------------------------- |
| `VITE_API_BASE` | 后端地址           | `http://127.0.0.1:3000`             |
| `VITE_USER_ID`  | 调试身份（C2：一期无认证） | `u-yang`（u-viewer 只读 / u-admin 管理员） |

### 4. 启动顺序

```bash
# 1) PG（见上）
# 2) 后端
cd workbench/server && npm install && npm run build && node dist/main.js
# 3) 前端
cd workbench && npm install && npm run dev   # http://127.0.0.1:5173/playlist
```

---

## 二、日常维护指引

### 代码结构速查

```
workbench/
├── specs/            # SDD 规格（01 架构 / 02 API / 03 数据模型 / 04 AI 编排 / 05 前端）
├── src/
│   ├── api/          # client(鉴权+envelope) resources(接口) sse ws mappers health
│   ├── store/        # workbench.ts 单一状态源（apiMode 双通路）
│   ├── components/   # 三栏组件 + 弹窗（组件不直接发请求，一律走 store action）
│   └── styles/       # styles.css（原型设计体系，勿改）+ app.css（增量样式）
└── server/src/
    ├── config.ts     # .env 加载 + 密钥纪律
    ├── common/       # 鉴权(X-User-Id) / envelope / 错误码
    ├── database/     # entities.ts（全部实体）+ seed.ts
    ├── infra/        # WS 事件总线
    └── modules/      # channel program playlist session rule lock oplog ai（8 服务）
```

### 常见维护任务

| 任务                 | 怎么做                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| **换 DeepSeek Key** | 改 `server/.env` 的 `DEEPSEEK_API_KEY`，重启后端。不要改代码                                                    |
| **换模型**            | 改 `DEEPSEEK_MODEL`；注意推理模型（pro）与轻量模型（chat/flash）的用途分工：对话用 pro（要思考过程），分类用 flash（要速度）                 |
| **改接口**            | 先改 `specs/02-api-contract.md` → 再改后端模块 → 再改 `src/api/resources.ts`，一次提交内完成                         |
| **改表结构**           | 先改 `specs/03-data-model.md` → 写 migration（禁止长期依赖 synchronize）                                      |
| **加敏感词**           | `server/src/modules/ai/ai.module.ts` 顶部 `SENSITIVE_WORDS`（一期内置；后续可迁移到网关配置表热更新）                     |
| **接真实媒资库**         | 只替换 `server/src/modules/program/program.module.ts` 的 `ProgramService.search/byIds` 实现，接口不变（C4 替换点） |
| **加调试用户**          | `server/src/common/auth.ts` 的 `USER_DIRECTORY` + 种子 `channel_permission`（二期接正式认证后移除）               |

### 验证手段

```bash
cd workbench/server
npm test              # C1 时间轴算法单测（vitest）
bash test/smoke.sh    # 13 项端到端冒烟（鉴权/锁/幂等/confirm_token/规则/日志/SSE）
```

### 故障排查

| 现象              | 排查                                             |
| --------------- | ---------------------------------------------- |
| 前端显示"演示模式"      | 后端 3000 未启动，或 PG 未启动                           |
| AI 回复"当前网络不好"   | 检查 Key 余额/网络；后端日志看 llm http 状态码                |
| 意图识别"降级为规则分类" | 分类模型超时（>2s）； `DEEPSEEK_CLASSIFY_MODEL` 为轻量模型 |
| 清空/覆盖报 1005     | confirm_token 过期（5 分钟）或已用，属正常安全机制，重新确认即可       |
| 编辑锁占用解不开        | 等 30 分钟自动释放，或删 `edit_lock` 表对应行                |



---

## 三、密钥与安全纪律（红线）

1. `DEEPSEEK_API_KEY` 只能出现在 `server/.env` 或部署平台的环境变量里
2. `server/.gitignore` 已含 `.env`；提交前可用 `git status` 确认 .env 不在暂存区
3. 若 Key 疑似泄露：先到 DeepSeek 控制台吊销重置，再更新 .env
4. 一期 `X-User-Id` 为调试身份机制，**上线前必须接正式认证**（二期范围，见 PRD 附录 C2）
