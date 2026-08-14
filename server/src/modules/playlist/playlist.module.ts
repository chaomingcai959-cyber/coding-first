// S3 播单服务（规格 02 §3、03 §4、附录 C1/C3）
// 要点：request_id 幂等、三种插入模式、序号重排、线性时间轴重算、版本广播、confirm_token、M6 系统事件
import { Body, Controller, Delete, Get, Module, Param, Post } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { InjectRepository, TypeOrmModule } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { randomUUID } from "crypto";
import {
  Channel, ConfirmToken, IdempotencyKey, Message, Playlist, PlaylistItem,
} from "../../database/entities";
import { CurrentUser, RequestUser } from "../../common/auth";
import { BizException, confirmTokenInvalid, ERR } from "../../common/errors";
import { ChannelModule, ChannelService } from "../channel/channel.module";
import { LockModule, LockService } from "../lock/lock.module";
import { OplogModule, OplogService } from "../oplog/oplog.module";
import { ProgramModule, ProgramService } from "../program/program.module";
import { EventsGateway } from "../../infra/events.gateway";
import { recalcTimeline, renumber } from "../../shared/timeline.util";

@Injectable()
export class PlaylistService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Playlist) private readonly playlists: Repository<Playlist>,
    @InjectRepository(PlaylistItem) private readonly items: Repository<PlaylistItem>,
    @InjectRepository(IdempotencyKey) private readonly idem: Repository<IdempotencyKey>,
    @InjectRepository(ConfirmToken) private readonly tokens: Repository<ConfirmToken>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly channels: ChannelService,
    private readonly locks: LockService,
    private readonly oplog: OplogService,
    private readonly programs: ProgramService,
    private readonly events: EventsGateway,
  ) {}

  async get(user: RequestUser, channelId: string) {
    await this.channels.assertAccess(user, channelId);
    const pl = await this.playlists.findOne({ where: { channel_id: channelId } });
    const items = await this.items.find({ where: { channel_id: channelId }, order: { sort: "ASC" } });
    return { version: pl?.version ?? 0, items };
  }

  /** 幂等执行包装：同 request_id 返回首次结果（4.2-AC3 无重复执行） */
  private async idempotent<T>(user: RequestUser, endpoint: string, requestId: string, fn: () => Promise<T>): Promise<T> {
    const hit = await this.idem.findOne({ where: { request_id: requestId } });
    if (hit) return hit.response as T;
    const result = await fn();
    await this.idem.insert({ request_id: requestId, user_id: user.id, endpoint, response: result as never });
    return result;
  }

  /** C3：签发 confirm_token（5 分钟、一次性、绑定频道+动作+持锁人） */
  async issueConfirmToken(user: RequestUser, channelId: string, action: "clear_playlist" | "overwrite_playlist") {
    await this.channels.assertAccess(user, channelId);
    await this.locks.assertHeld(user, channelId); // 与写工具同一套校验
    const token = randomUUID();
    await this.tokens.save({
      token, channel_id: channelId, holder_id: user.id, action,
      expires_at: new Date(Date.now() + 5 * 60 * 1000), used: false,
    });
    return { confirm_token: token, action, expires_in: 300 };
  }

  private async consumeConfirmToken(user: RequestUser, channelId: string, action: string, token?: string) {
    if (!token) throw confirmTokenInvalid();
    const row = await this.tokens.findOne({ where: { token } });
    if (
      !row || row.used || row.channel_id !== channelId || row.action !== action ||
      row.holder_id !== user.id || new Date(row.expires_at).getTime() < Date.now()
    ) throw confirmTokenInvalid();
    row.used = true; // 一次性核销
    await this.tokens.save(row);
  }

  /**
   * 写操作统一管道：鉴权(G2) → 锁校验(G3) → 事务内改写 + 重排序号 + 线性时间轴重算(C1)
   * → 版本 +1 → 广播 → 留痕(S7) → M6 系统事件写入会话流
   */
  private async mutate(
    user: RequestUser, channelId: string, action: string,
    fn: (items: PlaylistItem[], isLinear: boolean) => PlaylistItem[],
  ) {
    await this.channels.assertAccess(user, channelId);
    await this.locks.assertHeld(user, channelId);
    return this.ds.transaction(async (em) => {
      const ch = await em.findOne(Channel, { where: { id: channelId } });
      const isLinear = ch?.type === "linear";
      const cur = await em.find(PlaylistItem, { where: { channel_id: channelId }, order: { sort: "ASC" } });
      const next = fn(cur, isLinear);
      renumber(next);
      if (isLinear) {
        // 时长取自 program 快照（mock 数据源）；缺失按 0（C1）
        const withDur = next.map((it) => {
          const p = this.programs.byIds([it.program_id])[0];
          return Object.assign(it, { duration_sec: p?.duration_sec ?? 0 });
        });
        recalcTimeline(withDur);
      }
      await em.delete(PlaylistItem, { channel_id: channelId });
      await em.save(PlaylistItem, next.map((it) => ({ ...it, id: undefined, channel_id: channelId })));
      let pl = await em.findOne(Playlist, { where: { channel_id: channelId } });
      if (!pl) pl = em.create(Playlist, { channel_id: channelId, version: 0 });
      pl.version = Number(pl.version) + 1;
      await em.save(Playlist, pl);
      return { version: pl.version };
    }).then(async (r) => {
      this.events.broadcast({ event: "playlist.updated", data: { channel_id: channelId, version: r.version } }); // B13
      await this.oplog.append({ channel_id: channelId, operator_id: user.id, operator_name: user.nickname, action, detail: { version: r.version } });
      await this.messages.insert({ // M6：手动/AI 操作写入会话流，AI 上下文可见
        channel_id: channelId, role: "system_event",
        content: { text: this.eventText(action), operator: user.nickname },
      } as never);
      return r;
    });
  }

  private eventText(action: string): string {
    const map: Record<string, string> = {
      add: "向播单添加了节目", remove: "从播单删除了节目", move: "调整了节目顺序",
      clear: "清空了播单", overwrite: "全覆盖重写了播单",
    };
    return map[action] ?? action;
  }

  async addPrograms(user: RequestUser, channelId: string, body: {
    program_ids: string[]; mode: "prepend" | "append" | "overwrite"; request_id: string; confirm_token?: string;
  }) {
    if (body.mode === "overwrite") {
      await this.consumeConfirmToken(user, channelId, "overwrite_playlist", body.confirm_token); // G4
    }
    return this.idempotent(user, "playlist.items.add", body.request_id, async () => {
      const progs = this.programs.byIds(body.program_ids);
      const mapped = progs.map((p) => ({
        program_id: p.id, name: p.name, album: p.album, status: p.status, sort: 0,
        time_start: null, time_end: null,
      })) as unknown as PlaylistItem[];
      return this.mutate(user, channelId, body.mode === "overwrite" ? "overwrite" : "add", (cur) => {
        if (body.mode === "prepend") return [...mapped, ...cur];
        if (body.mode === "overwrite") return mapped;
        return [...cur, ...mapped];
      });
    });
  }

  async removePrograms(user: RequestUser, channelId: string, body: { item_ids?: string[]; program_ids?: string[]; request_id: string }) {
    return this.idempotent(user, "playlist.items.remove", body.request_id, () =>
      this.mutate(user, channelId, "remove", (cur) =>
        cur.filter((it) => !(body.item_ids ?? []).includes(it.id) && !(body.program_ids ?? []).includes(it.program_id))));
  }

  async move(user: RequestUser, channelId: string, body: { program_id: string; target_index: number; request_id: string }) {
    return this.idempotent(user, "playlist.move", body.request_id, () =>
      this.mutate(user, channelId, "move", (cur) => {
        const from = cur.findIndex((it) => it.program_id === body.program_id);
        if (from < 0) throw new BizException(ERR.VALIDATION_FAILED, "目标节目不在播单中");
        const to = Math.max(0, Math.min(cur.length - 1, body.target_index));
        const arr = [...cur];
        const [m] = arr.splice(from, 1);
        arr.splice(to, 0, m);
        return arr;
      }));
  }

  async clear(user: RequestUser, channelId: string, body: { confirm_token: string; request_id: string }) {
    await this.consumeConfirmToken(user, channelId, "clear_playlist", body.confirm_token); // G4
    return this.idempotent(user, "playlist.clear", body.request_id, () =>
      this.mutate(user, channelId, "clear", () => []));
  }
}

@Controller("api/channels/:id")
export class PlaylistController {
  constructor(private readonly svc: PlaylistService) {}

  @Get("playlist")
  get(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.svc.get(user, id);
  }

  @Post("confirm-tokens")
  issueToken(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { action: "clear_playlist" | "overwrite_playlist" }) {
    return this.svc.issueConfirmToken(user, id, body.action);
  }

  @Post("playlist/items")
  add(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: never) {
    return this.svc.addPrograms(user, id, body);
  }

  @Delete("playlist/items")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: never) {
    return this.svc.removePrograms(user, id, body);
  }

  @Post("playlist/move")
  move(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: never) {
    return this.svc.move(user, id, body);
  }

  @Post("playlist/clear")
  clear(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: never) {
    return this.svc.clear(user, id, body);
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Playlist, PlaylistItem, IdempotencyKey, ConfirmToken, Message, Channel]),
    ChannelModule, LockModule, OplogModule, ProgramModule,
  ],
  controllers: [PlaylistController],
  providers: [PlaylistService, EventsGateway],
  exports: [PlaylistService],
})
export class PlaylistModule {}
