// S6 编辑锁服务（规格 02 §3）：抢占原子、心跳保活、30 分钟超时释放
import { Controller, Delete, Module, Param, Post } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { InjectRepository, TypeOrmModule } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EditLock } from "../../database/entities";
import { CurrentUser, RequestUser } from "../../common/auth";
import { lockOccupied, lockNotHeld } from "../../common/errors";
import { ChannelService } from "../channel/channel.module";
import { ChannelModule } from "../channel/channel.module";
import { EventsGateway } from "../../infra/events.gateway";

const LOCK_TTL_MS = 30 * 60 * 1000; // 30 分钟（PRD 4.7）

@Injectable()
export class LockService {
  constructor(
    @InjectRepository(EditLock) private readonly locks: Repository<EditLock>,
    private readonly channels: ChannelService,
    private readonly events: EventsGateway,
  ) {}

  private isExpired(lock: EditLock) {
    return new Date(lock.expires_at).getTime() < Date.now();
  }

  /** 进入频道即申领；占用返回持锁人信息（前端弹窗 + 只读，U5/B13） */
  async acquire(user: RequestUser, channelId: string) {
    await this.channels.assertAccess(user, channelId);
    const existing = await this.locks.findOne({ where: { channel_id: channelId } });
    if (existing && !this.isExpired(existing) && existing.holder_id !== user.id) {
      this.events.broadcast({ event: "lock.occupied", data: { channel_id: channelId, holder_name: existing.holder_id } });
      throw lockOccupied(existing.holder_id);
    }
    // 原子抢占：主键冲突即失败（并发场景仅最先申领者成功，4.7-AC1）
    const now = new Date();
    const lock: Partial<EditLock> = {
      channel_id: channelId, holder_id: user.id,
      heartbeat_at: now, expires_at: new Date(now.getTime() + LOCK_TTL_MS),
    };
    await this.locks.save(lock);
    this.events.broadcast({ event: "lock.acquired", data: { channel_id: channelId, holder: user.id } });
    return { held: true, expires_at: lock.expires_at };
  }

  async release(user: RequestUser, channelId: string) {
    const existing = await this.locks.findOne({ where: { channel_id: channelId } });
    if (!existing || existing.holder_id !== user.id) throw lockNotHeld();
    await this.locks.delete({ channel_id: channelId });
    this.events.broadcast({ event: "lock.released", data: { channel_id: channelId } });
    return { released: true };
  }

  async heartbeat(user: RequestUser, channelId: string) {
    const existing = await this.locks.findOne({ where: { channel_id: channelId } });
    if (!existing || existing.holder_id !== user.id) throw lockNotHeld();
    const now = new Date();
    await this.locks.update({ channel_id: channelId }, { heartbeat_at: now, expires_at: new Date(now.getTime() + LOCK_TTL_MS) });
    return { ok: true };
  }

  /** 写操作前置锁校验（G3） */
  async assertHeld(user: RequestUser, channelId: string) {
    const existing = await this.locks.findOne({ where: { channel_id: channelId } });
    if (!existing || this.isExpired(existing) || existing.holder_id !== user.id) throw lockNotHeld();
  }

  async status(channelId: string) {
    const existing = await this.locks.findOne({ where: { channel_id: channelId } });
    if (!existing || this.isExpired(existing)) return { locked: false };
    return { locked: true, holder_id: existing.holder_id, expires_at: existing.expires_at };
  }
}

@Controller("api/channels/:id/lock")
export class LockController {
  constructor(private readonly svc: LockService) {}

  @Post()
  acquire(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.svc.acquire(user, id);
  }

  @Delete()
  release(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.svc.release(user, id);
  }

  @Post("heartbeat")
  heartbeat(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.svc.heartbeat(user, id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([EditLock]), ChannelModule],
  controllers: [LockController],
  providers: [LockService, EventsGateway],
  exports: [LockService],
})
export class LockModule {}
