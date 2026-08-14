// WebSocket 客户端（规格 02 §4 / 05 §3）：自动重连；事件 → 回调
import { API_BASE, USER_ID } from "./client";

export interface WsHandlers {
  onLockAcquired?: (channelId: string, holder: string) => void;
  onLockReleased?: (channelId: string) => void;
  onLockOccupied?: (channelId: string, holderName: string) => void;
  onPlaylistUpdated?: (channelId: string, version: number) => void;
  onConnectionChange?: (connected: boolean) => void; // B14 断连置灰
}

export function connectWs(handlers: WsHandlers): () => void {
  const wsBase = API_BASE.replace(/^http/, "ws");
  let ws: WebSocket | null = null;
  let closed = false;
  let retry = 0;

  const connect = () => {
    ws = new WebSocket(`${wsBase}/ws`);
    ws.onopen = () => {
      retry = 0;
      ws!.send(JSON.stringify({ event: "auth", data: { user_id: USER_ID } }));
      handlers.onConnectionChange?.(true);
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string);
      const d = msg.data ?? {};
      switch (msg.event) {
        case "lock.acquired": handlers.onLockAcquired?.(d.channel_id, d.holder); break;
        case "lock.released": handlers.onLockReleased?.(d.channel_id); break;
        case "lock.occupied": handlers.onLockOccupied?.(d.channel_id, d.holder_name); break;
        case "playlist.updated": handlers.onPlaylistUpdated?.(d.channel_id, d.version); break;
      }
    };
    ws.onclose = () => {
      handlers.onConnectionChange?.(false);
      if (!closed) setTimeout(connect, Math.min(10000, 1000 * 2 ** retry++)); // 指数退避重连（B14）
    };
  };
  connect();
  return () => { closed = true; ws?.close(); };
}
