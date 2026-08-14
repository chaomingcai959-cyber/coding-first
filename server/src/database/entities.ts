// 实体定义（规格 03 数据模型；DDL 以 migration 为准，禁用 synchronize）
import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn,
} from "typeorm";

@Entity("app_user")
export class AppUser {
  @PrimaryColumn() id: string; // 一期使用目录内可读 ID（u-yang 等），与 USER_DIRECTORY 对齐
  @Column() account: string;
  @Column() nickname: string;
  @Column() role: "editor" | "viewer" | "admin";
}

@Entity("channel")
export class Channel {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() name: string;
  @Column() type: "smart" | "linear"; // 智能/线性
  @Column() category: string;
  @Column() tenant: string;
  @Column({ default: "enabled" }) status: "enabled" | "disabled";
}

@Entity("channel_permission")
export class ChannelPermission {
  @PrimaryColumn() user_id: string;
  @PrimaryColumn("uuid") channel_id: string;
}

@Entity("program")
export class Program {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ unique: true }) code: string;
  @Column() name: string;
  @Column() category: string;
  @Column({ nullable: true }) tag: string;
  @Column({ nullable: true }) provider: string;
  @Column({ nullable: true }) director: string;
  @Column({ nullable: true }) actors: string;
  @Column({ nullable: true }) album: string;
  @Column({ default: 0 }) duration_sec: number; // 线性时间轴依赖（C4：一期 mock 保证齐全）
  @Column({ nullable: true }) pay_status: "free" | "paid";
  @Column({ default: "enabled" }) status: "enabled" | "disabled";
}

@Entity("playlist")
export class Playlist {
  @PrimaryColumn("uuid") channel_id: string;
  @Column({ type: "bigint", default: 0 }) version: number; // 每次写操作 +1，WS 广播依据
}

@Entity("playlist_item")
@Index(["channel_id", "sort"])
export class PlaylistItem {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") channel_id: string;
  @Column() program_id: string;
  @Column() sort: number;
  @Column({ length: 10, nullable: true }) time_start: string; // MMDDHHMMSS，仅线性（C1）
  @Column({ length: 10, nullable: true }) time_end: string;
  @Column({ default: "enabled" }) status: string;
  // 冗余展示字段（避免联表，写操作时由 program 快照写入）
  @Column() name: string;
  @Column({ nullable: true }) album: string;
}

@Entity("idempotency_key")
export class IdempotencyKey {
  @PrimaryColumn() request_id: string;
  @Column() user_id: string;
  @Column() endpoint: string;
  @Column({ type: "jsonb" }) response: unknown;
  @CreateDateColumn() created_at: Date;
}

@Entity("confirm_token") // 附录 C3
export class ConfirmToken {
  @PrimaryColumn() token: string;
  @Column("uuid") channel_id: string;
  @Column() holder_id: string;
  @Column() action: "clear_playlist" | "overwrite_playlist";
  @Column() expires_at: Date;
  @Column({ default: false }) used: boolean;
}

@Entity("message")
@Index(["channel_id", "seq"])
export class Message {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") channel_id: string; // namespace = 频道（M1）
  @Column({ type: "bigint", generated: "increment" }) seq: number; // 频道内单调序，分页游标
  @Column() role: "user" | "ai" | "system_event" | "divider";
  @Column({ type: "jsonb" }) content: unknown; // 文本/思考过程/工具调用/候选/操作事件（M6）
  @Column({ default: false }) is_cutoff: boolean; // 新规则分割线（M3）
  @CreateDateColumn() created_at: Date;
}

@Entity("session_state")
export class SessionState {
  @PrimaryColumn("uuid") channel_id: string;
  @Column() phase: string; // IDLE/INTENT_COLLECTING/...（R4 持久化）
  @Column({ type: "jsonb", nullable: true }) payload: unknown;
  @UpdateDateColumn() updated_at: Date;
}

@Entity("channel_rule")
export class ChannelRule {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") channel_id: string;
  @Column() rule_type: "movie" | "album" | "drama";
  @Column({ type: "jsonb", default: {} }) fields: Record<string, unknown>; // 字段级增量覆盖（M4）
  @Column({ default: 1 }) rule_version: number;
}

@Entity("edit_lock")
export class EditLock {
  @PrimaryColumn("uuid") channel_id: string;
  @Column() holder_id: string;
  @Column() heartbeat_at: Date;
  @Column() expires_at: Date; // heartbeat + 30min
}

@Entity("operation_log") // 追加写，不可改删（S7）
@Index(["channel_id", "operator_id", "created_at"])
export class OperationLog {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid", { nullable: true }) channel_id: string;
  @Column() operator_id: string;
  @Column() operator_name: string;
  @Column() action: string;
  @Column({ type: "jsonb" }) detail: unknown; // 前后内容快照、对话原文
  @CreateDateColumn() created_at: Date;
}

export const ALL_ENTITIES = [
  AppUser, Channel, ChannelPermission, Program, Playlist, PlaylistItem,
  IdempotencyKey, ConfirmToken, Message, SessionState, ChannelRule, EditLock, OperationLog,
];
