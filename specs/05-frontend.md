# 05 · 前端规格

> 依据：PRD §3/§4、附录 B、开发提示词 §4-§6。现状：workbench/src 原型已按本规格组件边界实现（mock 驱动），规范开发阶段任务为 **API 层替换 + 缺口补齐**。

## 1. 组件契约

| 组件 | 职责 | 输入（store 切片） | 输出（action） |
|---|---|---|---|
| Sidebar / Topbar | 静态布局 | — | — |
| LeftPanel | 筛选 + 频道卡片 + 选中 | filters/applied/channels/selectedId | setFilter/applyFilters/resetFilters/selectChannel |
| RuleDrawer | 三类规则配置（三 Tab） | ruleDrawerFor | closeRule/saveRules（待接 PUT rules） |
| MiddlePanel | 播单表格/分页/拖拽/头部操作 | selectedId/playlist/page/version | deleteItem/clearPlaylist/moveItem/setAddModal |
| AIPanel | 对话流/工具区/快捷指令/输入 | messages/aiPhase/candidates/... | sendMessage/newRule/continueByRule/applyCandidates |
| AddProgramModal | 5 维筛选 + 批量勾选 | addModalOpen | addPrograms |
| ConfirmModal | 统一确认（B6） | confirm | closeConfirm/onOk |

**规则**：组件不直接发请求；一切经 store action → api 层（`src/api/`，待建）。组件内只允许纯 UI 局部状态（如抽屉 Tab 页）。

## 2. Store 规格（Zustand）

现有切片保留，规范阶段改造点：

| 切片 | 现状（mock） | 目标（接 API） |
|---|---|---|
| channels | 本地数组 | `GET /channels`（进入页面加载） |
| playlists | 本地生成 | `GET /playlist`；写操作走 REST，成功后以响应 version 为准 |
| messages | 本地数组 | `GET /messages` 分页；发送走 SSE `/ai/chat` |
| aiPhase | 本地枚举 | 以服务端 session-state 为准（R4），前端仅渲染 |
| candidates/checked | 本地 | SSE `candidates` 事件写入 |
| version | 本地计数 | 服务端版本号；WS `playlist.updated` 驱动刷新（02 规格 §5 冲突规则） |
| confirm | 本地 | 破坏性操作先 `POST confirm-tokens`（C3）再执行 |

新增切片：`lock`（held/holderName/readonly）、`connection`（WS/SSE 状态，断连置灰输入区 B14）。

## 3. API 层（`src/api/`，待建）

- `client.ts`：fetch 封装，注入 `X-User-Id`（C2，一期从环境/调试面板取值），统一解析 envelope 与错误码 → 用户可读提示
- `sse.ts`：SSE 消费器，事件 → store action 映射（thinking/tool_call/candidates/message/done/error）
- `ws.ts`：WS 客户端，自动重连；事件 → store
- 各资源模块：`channel.ts / playlist.ts / rule.ts / program.ts / session.ts / lock.ts`，与 02 规格接口一一对应

## 4. 交互规则实现映射（验收对照）

| 规则 | 实现位置 |
|---|---|
| 15 条/页分页（B4） | MiddlePanel（PAGE_SIZE=15，已定值） |
| 行拖拽 + drag-over 高亮（B7） | MiddlePanel；跨页"移至第 N 位"输入兜底（C8，已确认） |
| 频道信息条（C7） | MiddlePanel 标题下新增信息行：频道名/租户/类型/规则摘要/已编排数（docx 为准） |
| 重复节目提示不拦截（B5） | addPrograms/applyCandidates 中检测并 toast"该节目已在播单中" |
| 6 种空态（B12） | 各组件 empty 分支（文案按 B12 原文） |
| 锁占用弹窗 + 只读（U5/B13） | 新增 LockGate：进入频道先 POST lock；占用 → 弹窗 + 全界面只读 |
| "播单已更新"横幅（B13） | WS playlist.updated → Banner 组件（待建） |
| 断连置灰 + 重连恢复（B14） | connection 切片驱动 AIPanel 输入区 |
| 响应式（B10） | <1366px 显示"请使用桌面端"提示页（待建） |
| 快捷指令三组（R6） | AIPanel 按 phase 切换（已实现） |
| 设计 token（B11） | 全部样式引用 styles.css 变量，新增样式仅写 app.css |

## 5. 测试规格

- store 单测（Vitest）：时间轴重算（C1）、三种插入模式、幂等 request_id 生成、分页切片
- 组件测试：空态文案、按钮可见性条件（U4）、全选仅启用项
- 联调 checklist 按 PRD §4 各 AC 逐条映射
