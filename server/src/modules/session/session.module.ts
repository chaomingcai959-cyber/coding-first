// S4 会话服务（规格 02 §3、04 §3/§5）：按频道存档、微信式上翻分页、cutoff、状态机持久化
import { Body, Controller, Get, Module, Param, Post, Put, Query } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { InjectRepository, TypeOrmModule } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Message, SessionState } from "../../database/entities";
import { CurrentUser, RequestUser } from "../../common/auth";
import { ChannelModule, ChannelService } from "../channel/channel.module";

export type AiPhase =
  | "IDLE" | "INTENT_COLLECTING" | "RULE_READY"
  | "CANDIDATES_REVIEW" | "INSERT_MODE_CONFIRM" | "APPLIED";

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(SessionState) private readonly states: Repository<SessionState>,
    private readonly channels: ChannelService,
  ) {}

  /** 微信式上翻分页（U1）：before=seq 游标，默认 20 条 */
  async page(user: RequestUser, channelId: string, before?: string, limit = 20) {
    await this.channels.assertAccess(user, channelId);
    const qb = this.messages.createQueryBuilder("m")
      .where("m.channel_id = :cid", { cid: channelId })
      .orderBy("m.seq", "DESC")
      .take(Math.min(100, limit));
    if (before) qb.andWhere("m.seq < :before", { before: Number(before) });
    const rows = await qb.getMany();
    return { items: rows.reverse(), has_more: rows.length === limit };
  }

  async append(channelId: string, role: Message["role"], content: unknown, isCutoff = false) {
    await this.messages.insert({ channel_id: channelId, role, content, is_cutoff: isCutoff } as never);
  }

  /** 开启新规则（F5/M3/R5）：写入 cutoff 分割线 + 状态强制 IDLE */
  async cutoff(user: RequestUser, channelId: string) {
    await this.channels.assertAccess(user, channelId);
    await this.append(channelId, "divider", { text: "以上对话已隔离，已开启全新对话规则" }, true);
    await this.saveState(channelId, "IDLE", null);
    return { ok: true };
  }

  /** M3：模型上下文 = cutoff 之后消息 + 规则 + 播单快照（由 AI 编排器组装） */
  async contextAfterCutoff(channelId: string, windowSize = 20) {
    const cutoff = await this.messages.createQueryBuilder("m")
      .where("m.channel_id = :cid AND m.is_cutoff = true", { cid: channelId })
      .orderBy("m.seq", "DESC").getOne();
    const qb = this.messages.createQueryBuilder("m")
      .where("m.channel_id = :cid", { cid: channelId })
      .orderBy("m.seq", "DESC").take(windowSize);
    if (cutoff) qb.andWhere("m.seq > :cs", { cs: cutoff.seq });
    return (await qb.getMany()).reverse();
  }

  async saveState(channelId: string, phase: AiPhase, payload: unknown) {
    await this.states.save({ channel_id: channelId, phase, payload: payload as never });
  }

  async getState(user: RequestUser, channelId: string) {
    await this.channels.assertAccess(user, channelId);
    const s = await this.states.findOne({ where: { channel_id: channelId } });
    return { phase: s?.phase ?? "IDLE", payload: s?.payload ?? null };
  }
}

@Controller("api/channels/:id")
export class SessionController {
  constructor(private readonly svc: SessionService) {}

  @Get("messages")
  page(@CurrentUser() user: RequestUser, @Param("id") id: string,
    @Query("before") before?: string, @Query("limit") limit?: string) {
    return this.svc.page(user, id, before, limit ? parseInt(limit, 10) : 20);
  }

  @Post("messages/cutoff")
  cutoff(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.svc.cutoff(user, id);
  }

  @Get("session-state")
  getState(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.svc.getState(user, id);
  }

  @Put("session-state")
  saveState(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { phase: AiPhase; payload?: unknown }) {
    return this.svc.saveState(id, body.phase, body.payload ?? null).then(() => ({ ok: true }));
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Message, SessionState]), ChannelModule],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
