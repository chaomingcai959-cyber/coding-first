// 资源接口模块（与规格 02 §3 一一对应）
import { api, newRequestId } from "./client";

export interface ChannelDto {
  id: string; name: string; type: "smart" | "linear";
  category: string; tenant: string; status: "enabled" | "disabled";
  program_count?: number; // 节目条数（C7 信息条/左栏卡片依赖）
}

export interface PlaylistItemDto {
  id: string; program_id: string; sort: number; name: string; album: string;
  status: string; time_start?: string | null; time_end?: string | null;
}

export interface MessageDto {
  id: string; seq: number; role: "user" | "ai" | "system_event" | "divider";
  content: { text?: string; [k: string]: unknown }; is_cutoff: boolean; created_at: string;
}

// S1 频道
export const channelApi = {
  list: (q: { keyword?: string; tenant?: string; type?: string; category?: string }) =>
    api.get<{ items: ChannelDto[] }>(`/api/channels?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])}`),
  detail: (id: string) => api.get<ChannelDto>(`/api/channels/${id}`),
};

// S3 播单（request_id 幂等；confirm_token 见 C3）
export const playlistApi = {
  get: (channelId: string) => api.get<{ version: number; items: PlaylistItemDto[] }>(`/api/channels/${channelId}/playlist`),
  issueConfirmToken: (channelId: string, action: "clear_playlist" | "overwrite_playlist") =>
    api.post<{ confirm_token: string; expires_in: number }>(`/api/channels/${channelId}/confirm-tokens`, { action }),
  add: (channelId: string, programIds: string[], mode: "prepend" | "append" | "overwrite", confirmToken?: string) =>
    api.post<{ version: number }>(`/api/channels/${channelId}/playlist/items`,
      { program_ids: programIds, mode, request_id: newRequestId(), confirm_token: confirmToken }),
  remove: (channelId: string, itemIds: string[]) =>
    api.del<{ version: number }>(`/api/channels/${channelId}/playlist/items`,
      { item_ids: itemIds, request_id: newRequestId() }),
  move: (channelId: string, programId: string, targetIndex: number) =>
    api.post<{ version: number }>(`/api/channels/${channelId}/playlist/move`,
      { program_id: programId, target_index: targetIndex, request_id: newRequestId() }),
  clear: (channelId: string, confirmToken: string) =>
    api.post<{ version: number }>(`/api/channels/${channelId}/playlist/clear`,
      { confirm_token: confirmToken, request_id: newRequestId() }),
};

// S2 媒资
export const programApi = {
  search: (q: Record<string, string>) =>
    api.get<{ total: number; items: unknown[] }>(`/api/programs?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])}`),
};

// S4 会话
export const sessionApi = {
  page: (channelId: string, before?: number, limit = 20) =>
    api.get<{ items: MessageDto[]; has_more: boolean }>(
      `/api/channels/${channelId}/messages?limit=${limit}${before ? `&before=${before}` : ""}`),
  cutoff: (channelId: string) => api.post<{ ok: boolean }>(`/api/channels/${channelId}/messages/cutoff`),
  getState: (channelId: string) => api.get<{ phase: string; payload: unknown }>(`/api/channels/${channelId}/session-state`),
};

// S5 规则
export const ruleApi = {
  getAll: (channelId: string) => api.get<{ rules: { rule_type: string; fields: Record<string, unknown>; rule_version: number }[] }>(`/api/channels/${channelId}/rules`),
  upsert: (channelId: string, ruleType: string, fields: Record<string, unknown>) =>
    api.put<{ rule_version: number }>(`/api/channels/${channelId}/rules`, { rule_type: ruleType, fields }),
};

// S6 编辑锁
export const lockApi = {
  acquire: (channelId: string) => api.post<{ held: boolean }>(`/api/channels/${channelId}/lock`),
  release: (channelId: string) => api.del<{ released: boolean }>(`/api/channels/${channelId}/lock`),
  heartbeat: (channelId: string) => api.post<{ ok: boolean }>(`/api/channels/${channelId}/lock/heartbeat`),
};
