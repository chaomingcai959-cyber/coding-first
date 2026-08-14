# 02 · API 契约规格

> 依据：开发提示词 §7、PRD §6 工具注册表、附录 C2/C3
> 本文件为前后端联调唯一契约依据；任何字段变更须先改本文件。

## 1. 通用约定

| 项 | 规格 |
|---|---|
| Base URL | `/api` |
| 鉴权（C2） | 所有请求携带 `X-User-Id: <userId>`；服务端据此校验频道权限（G2），缺失或越权返回 `AUTH_FORBIDDEN` |
| 幂等 | 写接口请求体含 `request_id`（UUID v4，客户端生成）；同 `request_id` 重复提交返回首次执行结果，不重复执行 |
| 响应 envelope | 成功：`{ "code": 0, "data": ... }`；失败：`{ "code": <错误码>, "message": "<用户可读>", "trace_id": "..." }` |
| 时间格式 | ISO 8601 字符串；线性频道播出时间为 `MMDDHHMMSS` 10 位字符串 |
| 分页 | `page`（1 起）+ `size`；响应含 `total` |

## 2. 错误码

| code | 含义 | 前端/AI 处理 |
|---|---|---|
| 0 | 成功 | — |
| 1001 | AUTH_REQUIRED | 提示重新进入 |
| 1002 | AUTH_FORBIDDEN | "您没有该频道的操作权限"（G2） |
| 1003 | LOCK_OCCUPIED | "频道正在被占用，暂无法编辑生成播单"（G3） |
| 1004 | LOCK_NOT_HELD | 提示刷新后重试 |
| 1005 | CONFIRM_TOKEN_INVALID | "请重新确认操作"（过期/已用/不匹配） |
| 1006 | VERSION_CONFLICT | 强制刷新为服务端最新版本（R2 弱网兜底） |
| 2001 | VALIDATION_FAILED | 展示具体字段错误 |
| 3001 | CONTENT_REJECTED | 合规提示（G1 敏感词命中） |
| 3002 | AI_TIMEOUT / AI_UNAVAILABLE | 降级话术（G6） |
| 9000 | INTERNAL_ERROR | 统一兜底话术 |

## 3. REST 接口

### S1 频道服务
| 方法 | 路径 | 说明 | 响应要点 |
|---|---|---|---|
| GET | `/channels?keyword&tenant&type&category` | 频道列表（按 X-User-Id 权限过滤） | `items[]{id,name,type,category,tenant,program_count,status}` |
| GET | `/channels/{id}` | 频道详情 | 同上 + 规则摘要 |

### S5 规则服务
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/channels/{id}/rules` | 返回电影/专辑/剧集三类规则对象 + 各自版本号 |
| PUT | `/channels/{id}/rules` | 体：`{rule_type, fields{...}}` 字段级增量覆盖；响应 `{rule_version}` |

### S2 媒资服务
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/programs?cat&tag&provider&name&album&page&size` | 多维检索，P95 ≤1s；`items[]{id,name,code,cat,tag,provider,album,duration_sec,status}`（C4：一期 mock） |

### S3 播单服务
| 方法 | 路径 | 体 / 说明 |
|---|---|---|
| GET | `/channels/{id}/playlist` | `{version, items[]{item_id,program_id,sort,name,album,status,time_start?,time_end?}}`（time_* 仅线性） |
| POST | `/channels/{id}/playlist/items` | `{program_ids[], mode: prepend\|append\|overwrite, request_id, confirm_token?}`（overwrite 必带 token） |
| DELETE | `/channels/{id}/playlist/items` | `{program_ids[] 或 item_ids[], request_id}` |
| POST | `/channels/{id}/playlist/move` | `{program_id, target_index, request_id}`（target_index 为全播单 0 基索引） |
| POST | `/channels/{id}/playlist/clear` | `{confirm_token, request_id}` |
| POST | `/channels/{id}/confirm-tokens` | **C3 新增**。体：`{action: clear_playlist\|overwrite_playlist}`；响应 `{confirm_token, expires_in: 300}`；一次性、绑定 channel+action+持锁人 |

写接口成功响应统一：`{version: <新版本号>}`；成功后服务端广播 `playlist.updated`（见 §4）。

### S4 会话服务
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/channels/{id}/messages?before=<msg_id>&limit=20` | 微信式上翻分页（U1；首屏 20 条，默认值已定） |
| POST | `/channels/{id}/messages/cutoff` | 开启新规则：写入 cutoff 标记消息；响应 `{cutoff_msg_id}` |
| GET | `/channels/{id}/session-state` | AI 状态机当前状态持久化读取（R4 刷新恢复） |

### S6 编辑锁服务
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/channels/{id}/lock` | 抢占（原子：PG `INSERT ... ON CONFLICT DO NOTHING` + 过期判定）；成功 `{held: true}`，占用返回 1003 + 持锁人昵称 |
| DELETE | `/channels/{id}/lock` | 释放 |
| POST | `/channels/{id}/lock/heartbeat` | 心跳保活（前端每 60s）；30 分钟无心跳自动释放 |

### S7 日志服务
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/logs?channel_id&operator&from&to&page&size` | 仅管理员角色；追加写无更新/删除接口 |

### S8 AI 网关
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/ai/chat` | SSE 流式，事件序列见 04 规格 §4；体：`{channel_id, content, request_id}` |

## 4. WebSocket 事件（`WS /ws`）

连接后发送 `auth {user_id}`；服务端按用户推送其在线频道事件：

| 事件 | 载荷 | 触发 |
|---|---|---|
| `lock.acquired` | `{channel_id, holder}` | 锁申领成功 |
| `lock.released` | `{channel_id}` | 锁释放（前端提示"可申领编辑"，B13） |
| `lock.occupied` | `{channel_id, holder_name}` | 进入已占用频道 |
| `playlist.updated` | `{channel_id, version}` | 播单写操作成功（前端比对版本，落后则刷新，B13/R2 兜底） |

## 5. 前端本地操作与广播冲突规则（评审默认项）

- 前端拖拽/勾选等**进行中操作**期间收到 `playlist.updated`：延迟应用，操作完成后比对版本，若落后则拉取最新并横幅提示"播单已更新"
- 无任何进行中操作时收到广播：直接拉取刷新 + 横幅提示
