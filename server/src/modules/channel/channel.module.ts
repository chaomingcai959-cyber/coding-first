// S1 频道服务（规格 02 §3）：列表按权限过滤（G2）；节目条数随列表返回（左栏卡片/C7 信息条依赖）
import { Controller, Get, Module, Param, Query } from "@nestjs/common";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository, TypeOrmModule } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Channel, ChannelPermission, PlaylistItem } from "../../database/entities";
import { CurrentUser, RequestUser } from "../../common/auth";
import { authForbidden } from "../../common/errors";

@Injectable()
export class ChannelService {
  constructor(
    @InjectRepository(Channel) private readonly channels: Repository<Channel>,
    @InjectRepository(ChannelPermission) private readonly perms: Repository<ChannelPermission>,
    @InjectRepository(PlaylistItem) private readonly items: Repository<PlaylistItem>,
  ) {}

  async assertAccess(user: RequestUser, channelId: string) {
    if (user.role === "admin") return;
    const hit = await this.perms.findOne({ where: { user_id: user.id, channel_id: channelId } });
    if (!hit) throw authForbidden();
  }

  async list(user: RequestUser, q: { keyword?: string; tenant?: string; type?: string; category?: string }) {
    const qb = this.channels.createQueryBuilder("c");
    if (user.role !== "admin") {
      qb.innerJoin(ChannelPermission, "p", "p.channel_id = c.id AND p.user_id = :uid", { uid: user.id });
    }
    if (q.keyword) qb.andWhere("c.name LIKE :kw", { kw: `%${q.keyword}%` });
    if (q.tenant) qb.andWhere("c.tenant = :tenant", { tenant: q.tenant });
    if (q.type) qb.andWhere("c.type = :type", { type: q.type === "线性频道" ? "linear" : q.type === "智能频道" ? "smart" : q.type });
    if (q.category) qb.andWhere("c.category = :cat", { cat: q.category });
    // 节目条数：子查询统计播单条目
    qb.addSelect(
      (sub) => sub.select("COUNT(*)", "cnt").from(PlaylistItem, "pi").where("pi.channel_id = c.id"),
      "program_count",
    );
    const rows = await qb.getRawAndEntities();
    const countMap = new Map(
      (rows.raw as { c_id: string; program_count: string }[]).map((r) => [r.c_id, Number(r.program_count)]),
    );
    return { items: rows.entities.map((c) => ({ ...c, program_count: countMap.get(c.id) ?? 0 })) };
  }

  async detail(user: RequestUser, id: string) {
    await this.assertAccess(user, id);
    const ch = await this.channels.findOne({ where: { id } });
    if (!ch) throw new NotFoundException("频道不存在");
    return ch;
  }
}

@Controller("api/channels")
export class ChannelController {
  constructor(private readonly svc: ChannelService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() q: Record<string, string>) {
    return this.svc.list(user, q);
  }

  @Get(":id")
  detail(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.svc.detail(user, id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Channel, ChannelPermission, PlaylistItem])],
  controllers: [ChannelController],
  providers: [ChannelService],
  exports: [ChannelService],
})
export class ChannelModule {}
