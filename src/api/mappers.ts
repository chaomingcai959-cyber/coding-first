// DTO → 前端本地模型映射（规格 05 §2：组件不感知 API 形状）
import type { Channel, PlaylistItem, Program } from "../mock/data";
import type { ChannelDto, PlaylistItemDto, MessageDto } from "./resources";
import type { Msg } from "../store/workbench";

export function mapChannel(d: ChannelDto): Channel {
  return {
    id: d.id,
    name: d.name,
    type: d.type === "linear" ? "线性频道" : "智能频道",
    cat: d.category,
    tenant: d.tenant,
    playCount: Number(d.program_count ?? 0),
    status: d.status === "enabled" ? "启用" : "禁用",
  };
}

export function mapPlaylistItem(d: PlaylistItemDto): PlaylistItem {
  return {
    id: d.id,
    program_id: d.program_id,
    sort: d.sort,
    name: d.name,
    album: d.album,
    status: d.status === "enabled" ? "启用" : "禁用",
    timeStart: d.time_start ?? undefined,
    timeEnd: d.time_end ?? undefined,
  };
}

let mappedSeq = 1;
const timeOf = (iso: string) => {
  try { return new Date(iso).toTimeString().slice(0, 8); } catch { return ""; }
};

export function mapMessage(d: MessageDto): Msg {
  const seq = Number(d.seq);
  if (d.role === "divider") return { id: `d${d.seq}` as never, kind: "divider", seq } as Msg;
  if (d.role === "system_event")
    return { id: mappedSeq++, kind: "event", text: String(d.content?.text ?? ""), time: timeOf(d.created_at), seq } as Msg;
  return {
    id: mappedSeq++, kind: "text", role: d.role === "user" ? "user" : "ai",
    text: String(d.content?.text ?? ""), time: timeOf(d.created_at), seq,
  } as Msg;
}

/** 后端媒资 mock（prog-XXXX）→ 前端 Program */
export function mapProgram(d: {
  id: string; code: string; name: string; cat: string; tag: string;
  provider: string; album: string; duration_sec: number; status: string;
}): Program {
  return {
    id: d.id, code: d.code, name: d.name, cat: d.cat, tag: d.tag,
    provider: d.provider, album: d.album, durationSec: d.duration_sec,
    status: d.status === "enabled" ? "启用" : "禁用",
  };
}
