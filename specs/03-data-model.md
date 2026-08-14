# 03 · 数据模型规格（PostgreSQL）

> 依据：PRD §11、附录 C6。所有表带 `created_at`/`updated_at`；主键 UUID。
> DDL 为 TypeORM migration 的编写依据；禁用 synchronize。

## 1. 用户与权限（C2：一期无认证，账号预置）

```sql
CREATE TABLE app_user (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account     TEXT NOT NULL UNIQUE,      -- 登录账号（一期仅标识用）
  nickname    TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('editor','viewer','admin'))
);

CREATE TABLE channel_permission (        -- 账号 ↔ 频道授权
  user_id     UUID NOT NULL REFERENCES app_user(id),
  channel_id  UUID NOT NULL REFERENCES channel(id),
  PRIMARY KEY (user_id, channel_id)
);
```

## 2. S1 频道

```sql
CREATE TABLE channel (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('smart','linear')),   -- 智能/线性
  category    TEXT NOT NULL,               -- 电影/电视剧/综艺/少儿
  tenant      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled','disabled'))
);
CREATE INDEX idx_channel_filter ON channel (tenant, type, category);
```

## 3. S2 媒资（C4：一期由 mock 适配器供数；表结构先行定义，真实媒资接入时灌数）

```sql
CREATE TABLE program (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL UNIQUE,       -- 相关编号
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,
  tag          TEXT,
  provider     TEXT,
  director     TEXT,
  actors       TEXT,
  album        TEXT,
  duration_sec INT NOT NULL DEFAULT 0,     -- 线性时间轴依赖（O4/C4）
  pay_status   TEXT CHECK (pay_status IN ('free','paid')),
  status       TEXT NOT NULL DEFAULT 'enabled'
);
CREATE INDEX idx_program_search ON program (category, tag, provider, status);
```

## 4. S3 播单

```sql
CREATE TABLE playlist (
  channel_id  UUID PRIMARY KEY REFERENCES channel(id),
  version     BIGINT NOT NULL DEFAULT 0    -- 每次写操作 +1，广播依据
);

CREATE TABLE playlist_item (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID NOT NULL REFERENCES channel(id),
  program_id  UUID NOT NULL REFERENCES program(id),
  sort        INT NOT NULL,                -- 序号（写操作后整体重排）
  time_start  CHAR(10),                    -- MMDDHHMMSS，仅线性频道（C1）
  time_end    CHAR(10),
  status      TEXT NOT NULL DEFAULT 'enabled',
  UNIQUE (channel_id, sort) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX idx_playlist_item_ch ON playlist_item (channel_id, sort);

CREATE TABLE idempotency_key (             -- request_id 幂等键
  request_id  UUID PRIMARY KEY,
  user_id     UUID NOT NULL,
  endpoint    TEXT NOT NULL,
  response    JSONB NOT NULL,              -- 首次执行结果，重复请求原样返回
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE confirm_token (               -- C3
  token       UUID PRIMARY KEY,
  channel_id  UUID NOT NULL,
  holder_id   UUID NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('clear_playlist','overwrite_playlist')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE
);
```

**线性时间轴重算（C1）**：任何写操作提交前，在同事务内按 sort 顺序重算全部 time_start/time_end（00:00 起排、不填充、超 24h 自然滚入次日）；duration 缺失按 0 处理并标记条目异常。

## 5. S4 会话

```sql
CREATE TABLE message (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   UUID NOT NULL REFERENCES channel(id),   -- namespace = 频道（M1）
  seq          BIGSERIAL,                               -- 频道内单调序，分页游标（before=seq）
  role         TEXT NOT NULL CHECK (role IN ('user','ai','system_event','divider')),
  content      JSONB NOT NULL,             -- 文本/思考过程/工具调用/候选列表/操作事件（M6）
  is_cutoff    BOOLEAN NOT NULL DEFAULT FALSE,         -- 新规则分割线（M3）
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_message_ch_seq ON message (channel_id, seq DESC);

CREATE TABLE session_state (               -- 状态机持久化（R4）
  channel_id  UUID PRIMARY KEY REFERENCES channel(id),
  phase       TEXT NOT NULL,               -- IDLE/INTENT_COLLECTING/...
  payload     JSONB,                       -- 候选、勾选、挂起流程等
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 6. S5 规则

```sql
CREATE TABLE channel_rule (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   UUID NOT NULL REFERENCES channel(id),
  rule_type    TEXT NOT NULL CHECK (rule_type IN ('movie','album','drama')),
  fields       JSONB NOT NULL DEFAULT '{}',  -- 字段级增量覆盖（M4）
  rule_version INT NOT NULL DEFAULT 1,
  UNIQUE (channel_id, rule_type)
);
```

## 7. S6 编辑锁

```sql
CREATE TABLE edit_lock (
  channel_id   UUID PRIMARY KEY REFERENCES channel(id),
  holder_id    UUID NOT NULL REFERENCES app_user(id),
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL         -- heartbeat + 30min；抢占原子性靠行冲突判定
);
```

## 8. S7 操作日志（追加写，不可改删）

```sql
CREATE TABLE operation_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   UUID,
  operator_id  UUID NOT NULL,
  operator_name TEXT NOT NULL,
  action       TEXT NOT NULL,              -- add/remove/move/clear/ai_apply/rule_update/...
  detail       JSONB NOT NULL,             -- 前后内容快照、对话原文
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);          -- 按月分区（容量按 12 个月预留）
CREATE INDEX idx_oplog_query ON operation_log (channel_id, operator_id, created_at DESC);
```
