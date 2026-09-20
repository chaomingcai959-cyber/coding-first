# AI 播单编排工作台

> 用自然语言对话编排电视播出单的全栈项目：前端 React 18 + TypeScript + Vite + Zustand，后端 NestJS + TypeORM + PostgreSQL，AI 能力经独立 LLM 网关接入 DeepSeek 推理模型。
>
> **下载即可运行**：`npm start` 一条命令打开界面（演示模式零外部依赖）；有 Docker 时可一键拉起全栈（PostgreSQL + 后端 + 前端）。

---

## 一、项目背景

### 1. 业务场景

电视台 / 频道运营方每天要把节目编排成播出单：按频道调性挑选节目、安排播出顺序与时间轴、校验排播规则（时段禁播、时长超限、频次限制等）、多人协作修改后留痕可追溯。

### 2. 现状痛点

| 痛点 | 具体表现 |
| --- | --- |
| 编排动作重 | 选节目、调顺序、改时间靠逐条手工操作，一版播单要反复点几十次 |
| 冲突靠人眼 | 节目时长、时段禁播、总时长超限等规则由人工核对，漏检即播出事故 |
| 协作易覆盖 | 多人同时编辑同一频道播单，后保存者覆盖前者，且无据可查 |
| AI 不敢直连 | 让大模型直接改业务数据风险极高，缺少"先预览、再确认、可回放"的机制 |

### 3. 方案设计

1. **对话式编排**：把"帮我排一版晚间电影档"这类自然语言指令解析为结构化播单操作，AI 只产出操作意图，不直接落库
2. **三栏工作台**：频道 / 播单时间轴 / AI 对话面板同屏，编排结果实时可见
3. **双模型分工**：对话用推理模型（保留思考过程，前端渲染为"思考块"），意图分类用轻量模型（保证语义解析 ≤2s 的 SLO）
4. **可靠性机制**：`request_id` 幂等、`confirm_token` 一次性确认、线性时间轴重算、编辑锁抢占与超时释放、操作日志只读不可改
5. **上下文规则体系**：播单快照、频道权限、排播规则注入模型上下文，约束 AI 只在允许范围内给建议
6. **规格驱动开发（SDD）**：先写规格再写代码，接口 / 数据模型 / AI 编排均有对应规格文档，实现与规格冲突时先改规格

### 4. 项目成果

工程交付口径（均为可验证的交付数据，非上线后业务效果数据）：

- 交付 **8 个后端服务模块**（频道 / 媒资 / 播单 / 会话 / 规则 / 编辑锁 / 日志 / LLM 网关）+ **20+ 前端组件**
- 编写并执行 **108 条测试用例**：端到端冒烟 **13/13** 通过、时间轴算法单测 **5/5** 通过、自动化用例 **35/35** 通过
- 沉淀 **5 份规格文档**（架构 / API 契约 / 数据模型 / AI 编排 / 前端）+ 测试用例集 + 测试执行报告
- 定义并验证 **5 项 SLO**（意图解析、流式首字、播单重算、锁抢占、日志落库）

---

## 二、快速开始

环境要求：**Node.js 18+**（推荐 22 LTS）。全栈模式可选 **Docker**。

### 轨道 A：30 秒看界面（零依赖）

```bash
git clone https://github.com/chaomingcai959-cyber/coding-first.git
cd coding-first
npm start -- --web-only
```

Windows 可直接双击 `start.bat`，macOS / Linux 执行 `bash start.sh`。

打开 **http://127.0.0.1:5173/playlist**

此模式不需要数据库、不需要后端、不需要模型密钥，前端使用本地 mock 数据（顶栏显示"演示模式"），适合快速看界面与交互。

### 轨道 B：一键全栈（推荐，需 Docker）

```bash
git clone https://github.com/chaomingcai959-cyber/coding-first.git
cd coding-first
npm start
```

脚本依次执行：安装前后端依赖 → 构建后端 → 用 Docker 拉起 PostgreSQL 15 → 并行启动后端(3000) 与前端(5173) → 自动建表并灌入 8 个频道的种子数据。

打开 **http://127.0.0.1:5173/playlist**（顶栏显示"API 已连接"即进入全栈模式）。

> 想接真实大模型：复制 `server/.env.example` 为 `server/.env`，填入 `DEEPSEEK_API_KEY` 后重启后端。**不填也能跑**——AI 会降级为占位回复，其余功能不受影响。

### 轨道 C：手动分步（已有本地 PostgreSQL）

```bash
# 1) 准备数据库：PostgreSQL 15+，库名/账号/密码均为 workbench（可在 server/.env 修改）
cp server/.env.example server/.env

# 2) 后端
cd server && npm install && npm run build && npm run start   # http://127.0.0.1:3000

# 3) 前端（新开终端）
cd .. && npm install && npm run dev                          # http://127.0.0.1:5173/playlist
```

> 首次启动需保持 `server/.env` 中 `TYPEORM_SYNC=1`（自动建表 + 种子数据）；建表完成后改为 `0`，后续结构变更走 migration。

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm start` | 一键启动（全栈，缺依赖自动安装） |
| `npm start -- --web-only` | 只启动前端演示模式 |
| `npm run setup` | 只安装依赖并构建，不启动 |
| `npm run db:up` / `npm run db:down` | 启动 / 停止 Docker 版 PostgreSQL |
| `npm test` | 后端时间轴算法单测（vitest） |
| `npm run smoke` | 13 项端到端冒烟（需后端已启动） |

---

## 三、功能一览

| 模块 | 能力 |
| --- | --- |
| 频道区 | 频道列表、频道信息条（租户 / 类型 / 调度规则 / 已编排节目数）、按权限区分为可编辑与只读 |
| 播单区 | 节目检索与批量加入、行拖拽调序、"移至第 N 位"、三种插入模式、线性时间轴自动重算、清空 / 覆盖需二次确认 |
| AI 面板 | 流式对话、推理过程以"思考块"呈现、历史会话上翻分页、操作确认卡片（`confirm_token` 一次性生效） |
| 规则中心 | 三类排播规则（禁播时段 / 时长限制 / 频次限制）的字段级增量配置与版本管理 |
| 协作 | 编辑锁抢占 + 心跳 + 30 分钟超时释放、WebSocket 实时广播版本变更 |
| 审计 | 操作日志追加写、可检索，不提供更新与删除接口 |

---

## 四、技术架构

```
┌────────────────────────────────────────────────────────┐
│ 前端  React 18 + TS + Vite + Zustand                    │
│   单页应用，路由 /playlist；后端不可用时降级本地 mock     │
└──────────────┬─────────────────────────────────────────┘
               │ REST（JSON）+ SSE（AI 流式）+ WebSocket（协作广播）
┌──────────────▼─────────────────────────────────────────┐
│ 后端  Node.js 22 + NestJS + TypeORM                     │
│  ┌─────────┬─────────┬─────────┬─────────┐             │
│  │ S1 频道  │ S2 媒资  │ S3 播单  │ S4 会话  │  业务服务   │
│  ├─────────┼─────────┼─────────┼─────────┤             │
│  │ S5 规则  │ S6 编辑锁│ S7 日志  │ S8 LLM网关│             │
│  └─────────┴─────────┴─────────┴─────────┘             │
│  横切：鉴权拦截器（X-User-Id → 频道权限）+ 统一 envelope   │
└──────────────┬─────────────────────────────────────────┘
               │ TypeORM
┌──────────────▼─────────────────────────────────────────┐
│ PostgreSQL 15+                                          │
└──────────────┬─────────────────────────────────────────┘
               │ 仅经 S8 网关访问
┌──────────────▼─────────────────────────────────────────┐
│ DeepSeek（对话推理模型 + 轻量分类模型）                   │
└────────────────────────────────────────────────────────┘
```

**模块边界约束**：服务间只允许经 NestJS 模块 exports 的公开 service 调用，禁止跨模块直接 import entity；所有写接口必须先过"鉴权 + 锁"两道前置。

---

## 五、关键工程机制

| 机制 | 解决的问题 |
| --- | --- |
| `request_id` 幂等 | 网络重试 / 用户连点导致的重复写入 |
| `confirm_token` 一次性确认 | 清空、覆盖等高危操作必须二次确认，令牌 5 分钟有效且用后即废 |
| 线性时间轴重算 | 任意插入 / 调序后自动重算起播时间，避免手工推算误差 |
| 编辑锁 + 心跳 + 超时释放 | 多人协作互斥，防死锁（30 分钟自动释放） |
| 会话按频道隔离 | 上下文不串台，切换频道不污染历史对话 |
| 双模型分工 + 超时降级 | 兼顾推理质量与响应速度，分类模型超 2s 自动降级为规则分类 |
| 敏感词护栏 | 指令进入模型前过滤，命中即拒绝执行 |

---

## 六、目录结构

```
.
├── scripts/start.mjs     # 一键启动脚本（依赖安装 / 构建 / 起库 / 并行启动 / 失败降级）
├── start.bat             # Windows 双击启动
├── start.sh              # macOS / Linux 启动
├── docs/                 # 配置与维护手册
├── specs/                # ★ 规格说明书（SDD）：01 架构 / 02 API 契约 / 03 数据模型 / 04 AI 编排 / 05 前端
├── src/                  # 前端
│   ├── api/              # client（鉴权+envelope）/ resources / sse / ws / mappers / health
│   ├── store/            # workbench.ts 单一状态源（apiMode 双通路：API 模式 ↔ 演示模式）
│   ├── components/       # 三栏组件 + 弹窗（组件不直接发请求，一律走 store action）
│   ├── mock/             # 演示模式数据源
│   └── styles/           # styles.css（设计体系）+ app.css（增量样式）
├── server/               # 后端 NestJS
│   ├── src/config.ts     # .env 加载 + 密钥纪律
│   ├── src/common/       # 鉴权 / envelope / 错误码 / 异常过滤
│   ├── src/database/     # entities.ts（全部实体）+ seed.ts（种子数据）
│   ├── src/infra/        # WebSocket 事件总线
│   ├── src/modules/      # 8 个业务服务模块
│   ├── test/             # 冒烟脚本 + 单测 + 用例集执行器
│   └── docker-compose.yml# PostgreSQL 15 一键起库
├── 测试用例集-v1.0.md     # 108 条测试用例
├── 测试执行报告-v1.0.md   # 执行结果
└── .env.example          # 前端环境变量示例
```

---

## 七、环境变量

**前端**（根目录 `.env`，可选，不配也能跑）

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `VITE_API_BASE` | 后端地址 | `http://127.0.0.1:3000` |
| `VITE_USER_ID` | 调试身份（`u-admin` 管理员 / `u-yang` 编辑 / `u-viewer` 只读） | `u-yang` |

**后端**（`server/.env`，复制自 `server/.env.example`）

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 模型密钥；**留空则 AI 降级为占位回复** | 空 |
| `DEEPSEEK_BASE_URL` | 接入端点 | `https://api.deepseek.com/v1` |
| `DEEPSEEK_MODEL` | 对话推理模型 | `deepseek-v4-pro` |
| `DEEPSEEK_CLASSIFY_MODEL` | 意图分类模型（须轻量模型） | `deepseek-chat` |
| `PG_HOST/PORT/USER/PASSWORD/DB` | 数据库连接 | `127.0.0.1 / 5432 / workbench / workbench / workbench` |
| `TYPEORM_SYNC` | 自动建表开关，首次为 `1`，之后改 `0` | — |
| `PORT` | 后端端口 | `3000` |

---

## 八、文档索引

| 文档 | 内容 |
| --- | --- |
| [docs/配置与维护手册.md](./docs/配置与维护手册.md) | 环境配置、维护任务、故障排查、密钥纪律 |
| [specs/README.md](./specs/README.md) | 规格总纲、SDD 流程约定、需求偏离登记总表 |
| [specs/01-architecture.md](./specs/01-architecture.md) | 系统分层、模块边界与依赖规则、目录结构 |
| [specs/02-api-contract.md](./specs/02-api-contract.md) | REST / WebSocket / SSE 全量接口契约、错误码、鉴权 |
| [specs/03-data-model.md](./specs/03-data-model.md) | PostgreSQL 表结构 DDL、索引与约束 |
| [specs/04-ai-orchestration.md](./specs/04-ai-orchestration.md) | 意图 / 工具映射、状态机、SSE 事件序列、记忆策略、护栏 |
| [specs/05-frontend.md](./specs/05-frontend.md) | 组件契约、store 规格、交互规则实现映射 |
| [测试用例集-v1.0.md](./测试用例集-v1.0.md) | 108 条测试用例 |
| [测试执行报告-v1.0.md](./测试执行报告-v1.0.md) | 冒烟 / 单测 / 自动化用例执行结果 |

---

## 九、二次开发替换点

| 想改什么 | 改哪里 |
| --- | --- |
| 接真实媒资库 | 只替换 `server/src/modules/program/program.module.ts` 的 `search / byIds`，接口不变 |
| 加调试用户 | `server/src/common/auth.ts` 的 `USER_DIRECTORY` + 频道权限种子 |
| 加敏感词 | `server/src/modules/ai/ai.module.ts` 顶部 `SENSITIVE_WORDS` |
| 换模型 | 改 `server/.env` 的 `DEEPSEEK_MODEL`；对话用推理模型、分类用轻量模型，不要反着配 |
| 改接口 | 先改 `specs/02-api-contract.md` → 再改后端 → 再改 `src/api/resources.ts`，同一提交内完成 |
| 改表结构 | 先改 `specs/03-data-model.md` → 写 migration（不要长期依赖 synchronize） |

---

## 十、一期边界与安全说明

**一期范围外**（已明确不实现）：正式登录认证（一期用 `X-User-Id` 标识调用方，**上线前必须接正式认证**）、多租户隔离强化、migration 体系、规则热更新配置化、媒资真实对接。

**密钥纪律**：

1. `DEEPSEEK_API_KEY` 只出现在 `server/.env` 或部署平台的环境变量中，禁止入库、入前端、入日志
2. 仓库 `.gitignore` 已排除 `.env`；提交前用 `git status` 确认无误
3. 若密钥疑似泄露：先在模型控制台吊销重置，再更新 `.env`

**故障速查**

| 现象 | 排查 |
| --- | --- |
| 顶栏显示"演示模式" | 后端 3000 未启动，或 PostgreSQL 未启动 |
| AI 回复 `[MOCK-AI] ...` | 未配置 `DEEPSEEK_API_KEY`，属正常降级 |
| 意图识别提示"降级为规则分类" | 分类模型超时（>2s）；确认 `DEEPSEEK_CLASSIFY_MODEL` 为轻量模型 |
| 清空 / 覆盖报错误码 1005 | `confirm_token` 过期（5 分钟）或已使用，重新确认即可 |
| 编辑锁解不开 | 等 30 分钟自动释放，或删除 `edit_lock` 表对应行 |
