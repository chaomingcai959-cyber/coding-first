# 04 · AI 编排规格

> 依据：PRD 第二部分（§5-§9）、附录 B8/C3。AI 侧所有行为以本规格为测试基准。

## 1. 编排架构

- **模型**：DeepSeek-V4-Pro（部署 ID 7ea1a443-4262-4a98-b442-29f99db5c370），仅经 S8 LLM 网关访问
- **模式**：LLM + Function Calling。理解/追问/话术走模型；一切确定性操作映射为工具（T1-T10），由后端执行
- **置信度**：意图分类置信度 < 0.7 进入追问分支，不得猜测执行（4.2-AC5）

## 2. 意图 → 工具映射（PRD §5/§6 合并视图）

| 意图 | 工具链 | 写操作护栏 |
|---|---|---|
| I1 生成播单 | T3 → T6 | G2+G3；overwrite 需 G4 |
| I2 筛选/查询 | T3 | 只读 |
| I3 添加节目 | T6 | G2+G3 |
| I4 删除 | T7 | G2+G3 |
| I5 调序 | T8 | G2+G3 |
| I6 清空 | T9 | G2+G3+G4（confirm_token） |
| I7 修改规则 | T4 | G2+G3；覆盖前 AI 复述确认（M4） |
| I8 规则继承 | T5 → T3（exclude_ids）→ T6 | 同上 |
| I9/I10 查询 | T1/T2 | 只读 |
| I11 配置规则 | T4 | G2+G3 |
| I12 兜底 | 无 | 拒识话术（G5 白名单外一律拒识） |

## 3. 状态机实现规格（6 态，PRD §7 + B8 勘误）

```
NO_CHANNEL(前端态) → IDLE → INTENT_COLLECTING → RULE_READY
  → CANDIDATES_REVIEW → INSERT_MODE_CONFIRM → APPLIED → IDLE
```

| 规则 | 实现要点 |
|---|---|
| R1 新意图打断 | 编排器每轮开头先跑意图分类；非当前流程意图 → 当前流程挂起（session_state.payload 保留候选快照），执行新意图 |
| R2 追问防循环 | payload 记录 `ask_count[slot]`；同一槽位 ≤2 次，第 3 次回复附可选示例；一次追问最多 2 个槽位 |
| R3 零候选 | 回退 INTENT_COLLECTING，回复说明原因并建议放宽条件 |
| R4 持久化 | 每次状态迁移写 `session_state`；前端进入频道时 `GET session-state` 恢复 |
| R5 开启新规则 | `POST messages/cutoff` → 状态强制 IDLE + 上下文截断（M3） |
| R6 快捷指令 | 前端按 phase 渲染三组（未选频道/已选频道/候选中） |

## 4. SSE 事件序列（`POST /api/ai/chat`）

```
event: thinking   data: {"step":"意图识别","detail":"..."}      ← 可多条
event: tool_call  data: {"tool":"search_programs","status":"start"}
event: tool_call  data: {"tool":"search_programs","status":"ok","summary":"命中 10 条"}
event: candidates data: {"items":[...]}                          ← 候选卡片（如需勾选）
event: message    data: {"delta":"..."}                          ← 流式正文，间隔 ≤1s（SLO）
event: done       data: {"phase":"CANDIDATES_REVIEW","version":N}
event: error      data: {"code":3002,"message":"..."}            ← G6 兜底话术
```

- 敏感词过滤（G1）在**入站**（用户输入）与**出站**（模型输出）双通道执行；命中即 `error code=3001`
- 工具调用全程 trace 落库（工具调用成功率 ≥99% 统计依据，9.2）
- SLO 埋点：首响应、单轮总时长、语义解析、上下文检索、流式间隔，均打 P95 指标

## 5. 记忆策略实现映射

| PRD | 实现 |
|---|---|
| M1 频道隔离 | message.channel_id；所有上下文查询强制带 channel_id |
| M2 上下文窗口 | 最近 20 轮全量 + 更早摘要（摘要由后台任务生成存 session_state.payload.summary）；检索 ≤500ms |
| M3 cutoff | 模型输入仅含 `seq > 最新 is_cutoff 消息` 的消息 + 当前规则对象 + 播单快照 |
| M4 规则覆盖 | T4 按字段级 merge；AI 回复先复述"将把 X 从 A 改为 B"再执行 |
| M5 规则继承 | T5 直接读 channel_rule 当前版本（结构化对象，非文本回溯）；T3 带 exclude_ids=播单 program_ids |
| M6 手动操作同步 | S3 写操作成功后由后端写入 role=system_event 消息（"你手动删除了《xx》"），进入 AI 上下文 |
| M7 即时存档 | 每轮 SSE done 后消息入库（同事务）；刷新不丢 |

## 6. 评估脚本约定（9.2）

- `server/eval/dataset/intent-200.jsonl`：200 条标注语料（I1-I12 + 口语化变体）——**语料标注责任方待定（开放项）**
- `server/eval/run.ts`：跑意图识别准确率 / 规则继承准确率；CI 卡点：低于阈值（95%/98%）即失败
- 引导完成率、追问收敛率：从 message + trace 日志离线统计
