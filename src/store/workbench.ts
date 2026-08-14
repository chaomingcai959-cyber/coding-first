import { create } from "zustand";
import {
  CHANNELS, PROGRAM_POOL, genPlaylist, fmtLinearTime,
  type Channel, type PlaylistItem, type Program,
} from "../mock/data";
import { channelApi, playlistApi, sessionApi, lockApi } from "../api/resources";
import { chatStream } from "../api/sse";
import { connectWs } from "../api/ws";
import { mapChannel, mapPlaylistItem, mapMessage } from "../api/mappers";
import { ApiError } from "../api/client";

// ---- AI 引导状态机（PRD §7，6 态） ----
export type AiPhase =
  | "NO_CHANNEL" | "IDLE" | "INTENT_COLLECTING"
  | "RULE_READY" | "CANDIDATES_REVIEW" | "INSERT_MODE_CONFIRM" | "APPLIED";

export type Msg =
  | { id: number; kind: "text"; role: "ai" | "user"; text: string; time: string }
  | { id: number; kind: "thinking"; steps: { label: string; detail: string }[] }
  | { id: number; kind: "candidates" }
  | { id: number; kind: "divider" }
  | { id: number; kind: "event"; text: string; time: string };

interface Filters { name: string; tenant: string; type: string; cat: string }
interface ConfirmState { open: boolean; title: string; text: string; danger?: boolean; onOk?: () => void }

let msgSeq = 1;
const now = () => new Date().toTimeString().slice(0, 8);
const key = (id: number | string) => String(id);

interface WorkbenchState {
  filters: Filters;
  applied: Filters;
  channels: Channel[];
  selectedId: number | string | null;
  playlists: Record<string, PlaylistItem[]>;
  page: number;
  version: number;
  aiPhase: AiPhase;
  messagesByChannel: Record<string, Msg[]>; // M1：会话按频道独立存储
  candidates: Program[];
  checked: Set<number | string>;
  aiTyping: boolean;
  ruleDrawerFor: number | string | null;
  addModalOpen: boolean;
  confirm: ConfirmState;
  apiMode: boolean | null;
  // 协作与连接（规格 02 §4/§5、B13/B14）
  lockHeld: boolean;
  readonly: boolean;
  lockHolder: string | null;
  banner: string | null;
  wsConnected: boolean;
  hasMore: boolean;

  setApiMode: (v: boolean) => void;
  initRemote: () => Promise<void>;
  bindWs: () => void;
  loadEarlierMessages: () => Promise<void>;
  refreshChannels: () => Promise<void>;
  dismissBanner: () => void;
  setFilter: (k: keyof Filters, v: string) => void;
  applyFilters: () => void;
  resetFilters: () => void;
  selectChannel: (id: number | string) => Promise<void>;
  setPage: (p: number) => void;
  openRule: (id: number | string) => void;
  closeRule: () => void;
  setAddModal: (open: boolean) => void;
  askConfirm: (title: string, text: string, onOk: () => void, danger?: boolean) => void;
  closeConfirm: () => void;
  deleteItem: (itemId: number | string) => void;
  clearPlaylist: () => void;
  moveItem: (from: number, to: number) => void;
  addPrograms: (ids: (number | string)[]) => void;
  sendMessage: (text: string) => void;
  newRule: () => void;
  continueByRule: () => void;
  toggleCandidate: (id: number | string) => void;
  checkAllCandidates: () => void;
  applyCandidates: (mode: "prepend" | "append" | "overwrite") => void;
}

export const PAGE_SIZE = 15;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let wsBound = false;

export const useWorkbench = create<WorkbenchState>((set, get) => {
  const isApi = () => get().apiMode === true;
  const selectedChannel = () => get().channels.find((c) => c.id === get().selectedId) || null;
  const curItems = () => {
    const id = get().selectedId;
    return id == null ? [] : get().playlists[key(id)] || [];
  };

  // 手动/AI 操作后重排序号 + 线性时间轴整体重算（附录 C1，演示模式本地重算）
  const recalc = (items: PlaylistItem[], isLinear: boolean): PlaylistItem[] => {
    let cursor = 0;
    return items.map((it, i) => {
      const dur = 55 * 60;
      const next = { ...it, sort: i + 1 };
      if (isLinear) {
        next.timeStart = fmtLinearTime(cursor);
        next.timeEnd = fmtLinearTime(cursor + dur);
      }
      cursor += dur;
      return next;
    });
  };

  const mutatePlaylist = (fn: (items: PlaylistItem[], ch: Channel) => PlaylistItem[], eventText?: string) => {
    const ch = selectedChannel();
    if (!ch) return;
    const cur = get().playlists[key(ch.id)] || [];
    const next = recalc(fn(cur, ch), ch.type === "线性频道");
    set((s) => ({
      playlists: { ...s.playlists, [key(ch.id)]: next },
      version: s.version + 1,
    }));
    if (eventText) appendMsgs(ch.id, [{ id: msgSeq++, kind: "event", text: eventText, time: now() }]);
    // 演示模式：同步左栏频道条数（与 API 模式 refreshChannels 对齐）
    set((st) => ({
      channels: st.channels.map((c) => (c.id === ch.id ? { ...c, playCount: next.length } : c)),
    }));
  };

  // API 模式：写操作后拉取服务端最新播单（服务端为唯一数据源，4.8-AC3）
  const reloadPlaylist = async () => {
    const id = get().selectedId;
    if (id == null) return;
    const r = await playlistApi.get(String(id));
    set((s) => ({
      playlists: { ...s.playlists, [key(id)]: r.items.map(mapPlaylistItem) },
      version: r.version,
    }));
    void get().refreshChannels(); // 左栏节目条数同步（program_count 联动）
  };

  const apiErrorToast = (e: unknown) => {
    const msg = e instanceof ApiError ? e.message : "当前网络不好，请稍后重试";
    set((s) => ({ banner: msg }));
  };

  // ---- M1 会话按频道分片：appendMsgs/setMsgs 始终写入指定频道的切片，杜绝跨频道串扰 ----
  const msgsOf = (id: number | string) => get().messagesByChannel[key(id)] || [];
  const setMsgs = (id: number | string, items: Msg[]) =>
    set((s) => ({ messagesByChannel: { ...s.messagesByChannel, [key(id)]: items } }));
  const appendMsgs = (id: number | string, items: Msg[]) =>
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [key(id)]: [...(s.messagesByChannel[key(id)] || []), ...items],
      },
    }));
  const pushAi = (cid: number | string, text: string) => {
    appendMsgs(cid, [{ id: msgSeq++, kind: "text", role: "ai", text, time: now() }]);
    set({ aiTyping: false });
  };

  return {
    filters: { name: "", tenant: "", type: "", cat: "" },
    applied: { name: "", tenant: "", type: "", cat: "" },
    channels: CHANNELS,
    selectedId: null,
    playlists: {},
    page: 1,
    version: 0,
    aiPhase: "NO_CHANNEL",
    messagesByChannel: {},
    candidates: [],
    checked: new Set(),
    aiTyping: false,
    ruleDrawerFor: null,
    addModalOpen: false,
    confirm: { open: false, title: "", text: "" },
    apiMode: null,
    lockHeld: false,
    readonly: false,
    lockHolder: null,
    banner: null,
    wsConnected: false,
    hasMore: false,

    setApiMode: (v) => set({ apiMode: v }),

    // 刷新频道列表（含 program_count），保持左栏条数与服务端一致
    refreshChannels: async () => {
      const f = get().applied;
      try {
        const r = await channelApi.list({ keyword: f.name, tenant: f.tenant, type: f.type, category: f.cat });
        set({ channels: r.items.map(mapChannel) });
      } catch (e) {
        apiErrorToast(e);
      }
    },

    // API 模式初始化：频道列表 + WS（规格 05 §2/§3）
    initRemote: async () => {
      try {
        const r = await channelApi.list({});
        set({ channels: r.items.map(mapChannel) });
        get().bindWs();
      } catch (e) {
        apiErrorToast(e);
      }
    },

    bindWs: () => {
      if (wsBound) return;
      wsBound = true;
      connectWs({
        onConnectionChange: (c) => set({ wsConnected: c }),
        onPlaylistUpdated: async (channelId, version) => {
          // B13 + 02 §5：他人保存后横幅提示并刷新为最新版本
          if (String(get().selectedId) === String(channelId) && version !== get().version) {
            await reloadPlaylist();
            set({ banner: "播单已更新" });
          }
        },
        onLockReleased: (channelId) => {
          if (String(get().selectedId) === String(channelId) && get().readonly) {
            set({ banner: "编辑锁已释放，可重新进入申领编辑" });
          }
        },
      });
    },

    dismissBanner: () => set({ banner: null }),

    // F4/U1 微信式上翻分页：滚动到对话顶部加载更早记录（before = 最早消息 seq）
    loadEarlierMessages: async () => {
      const id = get().selectedId;
      if (id == null || !get().hasMore) return;
      const cur = msgsOf(id);
      const earliest = (cur[0] as { seq?: number } | undefined)?.seq;
      if (earliest == null) return;
      try {
        const r = await sessionApi.page(String(id), earliest, 20);
        const older = r.items.map(mapMessage);
        set((s) => ({
          messagesByChannel: { ...s.messagesByChannel, [key(id)]: [...older, ...cur] },
          hasMore: r.has_more,
        }));
      } catch (e) {
        apiErrorToast(e);
      }
    },

    setFilter: (k, v) => set((s) => ({ filters: { ...s.filters, [k]: v } })),
    applyFilters: () => {
      const f = get().filters;
      set({ applied: { ...f } });
      if (isApi()) {
        channelApi.list({ keyword: f.name, tenant: f.tenant, type: f.type, category: f.cat })
          .then((r) => set({ channels: r.items.map(mapChannel) }))
          .catch(apiErrorToast);
      }
    },
    resetFilters: () => {
      set({ filters: { name: "", tenant: "", type: "", cat: "" }, applied: { name: "", tenant: "", type: "", cat: "" } });
      if (isApi()) get().initRemote();
    },

    // U2：切频道清空上下文，加载目标频道播单 + 历史会话；API 模式含锁门禁（U5）
    selectChannel: async (id) => {
      const ch = get().channels.find((c) => c.id === id);
      if (!ch) return;

      if (isApi()) {
        // 释放旧锁 + 停心跳
        const prev = get().selectedId;
        if (prev != null && get().lockHeld) {
          lockApi.release(String(prev)).catch(() => undefined);
        }
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }

        let held = false, readonly = false, holder: string | null = null;
        try {
          await lockApi.acquire(String(id));
          held = true;
          heartbeatTimer = setInterval(() => lockApi.heartbeat(String(id)).catch(() => undefined), 60_000); // 心跳保活
        } catch (e) {
          if (e instanceof ApiError && e.code === 1003) {
            readonly = true; // U5：只读查看模式
            holder = e.message;
          } else {
            apiErrorToast(e);
            return;
          }
        }
        const [pl, msgs] = await Promise.all([
          playlistApi.get(String(id)),
          sessionApi.page(String(id)),
        ]);
        set((s) => ({
          selectedId: id, page: 1, ruleDrawerFor: null,
          lockHeld: held, readonly, lockHolder: holder,
          aiPhase: "IDLE", checked: new Set(), candidates: [],
          playlists: { ...s.playlists, [key(id)]: pl.items.map(mapPlaylistItem) },
          version: pl.version,
          banner: readonly ? "频道正在被占用，暂无法编辑生成播单（只读模式）" : null,
        }));
        setMsgs(id, msgs.items.length
          ? msgs.items.map(mapMessage)
          : [{ id: msgSeq++, kind: "text", role: "ai", time: now(),
               text: `已进入「${ch.name}」。我是 AI Director，可以帮你生成播单、筛选节目或调整编排。要现在生成一份播单吗？` }]);
        set({ hasMore: msgs.has_more });
        return;
      }

      // 演示模式（原 mock 路径）
      const isLinear = ch.type === "线性频道";
      set((s) => ({
        selectedId: id, page: 1, ruleDrawerFor: null,
        aiPhase: "IDLE", checked: new Set(), candidates: [],
        playlists: s.playlists[key(id)]
          ? s.playlists
          : { ...s.playlists, [key(id)]: genPlaylist(Number(id) || 1, Math.min(ch.playCount, 42), isLinear) },
      }));
      setMsgs(id, [
        { id: msgSeq++, kind: "text", role: "ai", time: now(),
          text: `已进入「${ch.name}」。我是 AI Director，可以帮你生成播单、筛选节目或调整编排。要现在生成一份播单吗？` },
      ]);
    },

    setPage: (p) => set({ page: p }),
    openRule: (id) => set({ ruleDrawerFor: id }),
    closeRule: () => set({ ruleDrawerFor: null }),
    setAddModal: (open) => set({ addModalOpen: open }),
    askConfirm: (title, text, onOk, danger) => set({ confirm: { open: true, title, text, onOk, danger } }),
    closeConfirm: () => set({ confirm: { open: false, title: "", text: "" } }),

    deleteItem: (itemId) => {
      if (get().readonly) return;
      const item = curItems().find((i) => i.id === itemId);
      get().askConfirm("删除节目", `确定将「${item?.name}」从播单中删除吗？`, async () => {
        if (isApi()) {
          try {
            await playlistApi.remove(String(get().selectedId), [String(itemId)]);
            await reloadPlaylist();
          } catch (e) { apiErrorToast(e); }
        } else {
          mutatePlaylist((items) => items.filter((i) => i.id !== itemId), `你手动删除了《${item?.name}》`);
        }
        get().closeConfirm();
      }, true);
    },

    // C3：清空前先签发 confirm_token（G4）
    clearPlaylist: () => {
      if (get().readonly) return;
      get().askConfirm("清空播单", "清空后当前播单将全部移除，此操作不可恢复。确定清空吗？", async () => {
        if (isApi()) {
          try {
            const t = await playlistApi.issueConfirmToken(String(get().selectedId), "clear_playlist");
            await playlistApi.clear(String(get().selectedId), t.confirm_token);
            await reloadPlaylist();
          } catch (e) { apiErrorToast(e); }
        } else {
          mutatePlaylist(() => [], "你手动清空了播单");
        }
        get().closeConfirm();
      }, true);
    },

    moveItem: (from, to) => {
      if (get().readonly) return;
      const item = curItems()[from];
      if (isApi()) {
        if (!item?.program_id) return;
        playlistApi.move(String(get().selectedId), item.program_id, to)
          .then(reloadPlaylist)
          .catch(apiErrorToast);
        return;
      }
      mutatePlaylist((items) => {
        const arr = [...items];
        const [m] = arr.splice(from, 1);
        arr.splice(to, 0, m);
        return arr;
      }, `你手动将《${item?.name}》调整了顺序`);
    },

    addPrograms: (ids) => {
      if (get().readonly) return;
      if (isApi()) {
        playlistApi.add(String(get().selectedId), ids.map(String), "append")
          .then(async () => { await reloadPlaylist(); set({ addModalOpen: false }); })
          .catch(apiErrorToast);
        return;
      }
      const progs = PROGRAM_POOL.filter((p) => ids.includes(p.id));
      mutatePlaylist((items) => [
        ...items,
        ...progs.map((p, i) => ({
          id: Number(p.id) + Date.now() % 100000 + i, sort: 0, name: p.name, album: p.album, status: p.status,
        })),
      ], `你手动添加了 ${progs.length} 个节目`);
      set({ addModalOpen: false });
    },

    sendMessage: (text) => {
      if (!text.trim() || get().readonly) return;
      const cid = String(get().selectedId); // 发起频道：用户消息与后续 AI 回复都归入该频道切片
      appendMsgs(cid, [{ id: msgSeq++, kind: "text", role: "user", text, time: now() }]);
      set({ aiTyping: true });

      if (isApi()) {
        const thinkingSteps: { label: string; detail: string }[] = [];
        let aiText = "";
        chatStream(cid, text, {
          onThinking: (step, detail) => {
            thinkingSteps.push({ label: step, detail });
            const steps = [...thinkingSteps];
            setMsgs(cid, [...msgsOf(cid).filter((m) => m.kind !== "thinking"), { id: msgSeq, kind: "thinking", steps } as Msg]);
          },
          onCandidates: (items) => {
            const mapped = (items as { id: string; name: string; cat: string; tag: string; provider: string; album: string; duration_sec: number; status: string }[])
              .map((p) => ({
                id: p.id, code: "", name: p.name, cat: p.cat, tag: p.tag, provider: p.provider,
                album: p.album, durationSec: p.duration_sec, status: "启用" as const,
              }));
            set({ candidates: mapped, checked: new Set(), aiPhase: "CANDIDATES_REVIEW" });
            setMsgs(cid, [...msgsOf(cid).filter((m) => m.kind !== "thinking"), { id: msgSeq++, kind: "candidates" }]);
          },
          onMessage: (delta) => { aiText += delta; },
          onDone: (phase) => {
            set({ aiTyping: false, aiPhase: (phase as AiPhase) || "IDLE" });
            setMsgs(cid, [
              ...msgsOf(cid).filter((m) => m.kind !== "thinking"),
              ...(aiText ? [{ id: msgSeq++, kind: "text", role: "ai", text: aiText, time: now() } as Msg] : []),
            ]);
            reloadPlaylist().catch(() => undefined);
          },
          onError: (_code, message) => {
            set({ aiTyping: false });
            pushAi(cid, message);
          },
        }).catch(() => {
          set({ aiTyping: false });
          pushAi(cid, "当前网络不好，请稍后重试");
        });
        return;
      }

      // 演示模式（模拟流式）
      setTimeout(() => {
        appendMsgs(cid, [{
          id: msgSeq++, kind: "thinking",
          steps: [
            { label: "意图识别", detail: "识别为「生成播单 / 筛选节目」意图，置信度 0.93" },
            { label: "槽位抽取", detail: `题材=古装；时长=不限；来源指令："${text.slice(0, 24)}${text.length > 24 ? "…" : ""}"` },
          ],
        }]);
      }, 500);
      setTimeout(() => {
        if (/播单|生成|筛选|节目|电影|剧/.test(text)) {
          get().continueByRule();
          pushAi(cid, "已按你的要求完成筛选，请在上方候选列表中勾选节目，然后确认加入方式。");
        } else {
          pushAi(cid, "我理解你的需求了。当前原型为交互演示版，AI 能力将在联调阶段接入 DeepSeek-V4-Pro 后生效。你可以试试：「帮我生成今天的播单」。");
        }
      }, 1400);
    },

    // F5 开启新规则：确认 → cutoff → 分割线 → 状态重置（R5/M3）
    newRule: () => {
      if (get().readonly) return;
      get().askConfirm(
        "开启新规则",
        "新规则中所有对话将默认不再使用对话历史，播单将根据你给出的新规则重新生成，确定要开启新规则吗？",
        async () => {
          const cid = String(get().selectedId);
          if (isApi()) {
            try { await sessionApi.cutoff(cid); } catch (e) { apiErrorToast(e); get().closeConfirm(); return; }
          }
          set({ aiPhase: "IDLE", candidates: [], checked: new Set() });
          appendMsgs(cid, [
            { id: msgSeq++, kind: "divider" },
            { id: msgSeq++, kind: "text", role: "ai", time: now(),
              text: "已开启全新对话规则。请告诉我新的编排方向，例如题材、时长、受众与时段要求。" },
          ]);
          get().closeConfirm();
        }
      );
    },

    // F6 规则继承：API 模式走 SSE 编排（T5→T3），演示模式本地候选
    continueByRule: () => {
      const ch = selectedChannel();
      if (!ch || get().readonly) return;
      if (isApi()) {
        get().sendMessage("按此规则继续生成");
        return;
      }
      const inPlaylist = new Set(curItems().map((i) => i.name));
      const pool = PROGRAM_POOL.filter((p) => p.status === "启用" && !inPlaylist.has(p.name)).slice(0, 10);
      set({ candidates: pool, checked: new Set(), aiPhase: "CANDIDATES_REVIEW" });
      appendMsgs(ch.id, [
        { id: msgSeq++, kind: "thinking", steps: [
          { label: "规则继承", detail: `读取频道「${ch.name}」当前有效规则 v3：题材=古装/悬疑；提供方=优酷、爱奇艺；最大数量=10` },
          { label: "媒资匹配", detail: `命中 ${pool.length} 个候选节目，已排除播单内 ${inPlaylist.size} 个在播节目（exclude_ids）` },
        ]},
        { id: msgSeq++, kind: "candidates" },
      ]);
    },

    toggleCandidate: (id) =>
      set((s) => {
        const next = new Set(s.checked);
        if (next.has(id)) next.delete(id); else next.add(id);
        return { checked: next };
      }),
    checkAllCandidates: () =>
      set((s) => ({
        checked: s.checked.size === s.candidates.length ? new Set() : new Set(s.candidates.map((c) => c.id)),
      })),

    applyCandidates: (mode) => {
      if (get().readonly) return;
      const { checked, candidates } = get();
      const chosen = candidates.filter((c) => checked.has(c.id));
      if (!chosen.length) return;
      const doApply = async () => {
        if (isApi()) {
          try {
            let token: string | undefined;
            if (mode === "overwrite") {
              token = (await playlistApi.issueConfirmToken(String(get().selectedId), "overwrite_playlist")).confirm_token;
            }
            await playlistApi.add(String(get().selectedId), chosen.map((c) => String(c.id)), mode, token);
            await reloadPlaylist();
          } catch (e) { apiErrorToast(e); return; }
        } else {
          mutatePlaylist((items) => {
            const mapped = chosen.map((p, i) => ({
              id: Number(p.id) + Date.now() % 100000 + i, sort: 0, name: p.name, album: p.album, status: "启用",
            }));
            if (mode === "prepend") return [...mapped, ...items];
            if (mode === "overwrite") return mapped;
            return [...items, ...mapped];
          });
        }
        set({ aiPhase: "APPLIED", candidates: [], checked: new Set() });
        const cid = get().selectedId;
        if (cid != null) {
          appendMsgs(cid, [{ id: msgSeq++, kind: "text", role: "ai", time: now(),
            text: `已将 ${chosen.length} 个节目${mode === "prepend" ? "插入播单开头" : mode === "overwrite" ? "全覆盖写入播单" : "追加到播单末尾"}，序号与播出时间已自动重排，版本已存档。` }]);
        }
      };
      if (mode === "overwrite") {
        get().askConfirm("全覆盖确认", "全覆盖将清空原有播单，仅保留本次选中节目。确定执行吗？", () => { doApply(); get().closeConfirm(); }, true);
      } else {
        doApply();
      }
    },
  };
});
