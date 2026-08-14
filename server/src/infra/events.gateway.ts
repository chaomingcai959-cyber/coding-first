// WebSocket 事件总线（规格 02 §4）：lock.acquired/lock.released/lock.occupied/playlist.updated
import {
  OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer,
} from "@nestjs/websockets";
import { Server, WebSocket } from "ws";

export type WsEvent =
  | { event: "lock.acquired"; data: { channel_id: string; holder: string } }
  | { event: "lock.released"; data: { channel_id: string } }
  | { event: "lock.occupied"; data: { channel_id: string; holder_name: string } }
  | { event: "playlist.updated"; data: { channel_id: string; version: number } };

@WebSocketGateway({ path: "/ws" })
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private userSockets = new Map<string, Set<WebSocket>>();

  handleConnection(client: WebSocket) {
    // 连接后等待客户端 auth 消息绑定 user_id
    (client as WebSocket & { userId?: string }).userId = undefined;
  }

  @SubscribeMessage("auth")
  handleAuth(client: WebSocket, payload: { user_id: string }) {
    const uid = payload?.user_id;
    if (!uid) return;
    (client as WebSocket & { userId?: string }).userId = uid;
    if (!this.userSockets.has(uid)) this.userSockets.set(uid, new Set());
    this.userSockets.get(uid)!.add(client);
    client.on("close", () => this.userSockets.get(uid)?.delete(client));
  }

  /** 广播给所有在线连接（一期全量广播，前端按 channel_id 自行过滤） */
  broadcast(evt: WsEvent) {
    const raw = JSON.stringify(evt);
    for (const set of this.userSockets.values()) {
      for (const sock of set) {
        if (sock.readyState === sock.OPEN) sock.send(raw);
      }
    }
  }
}
