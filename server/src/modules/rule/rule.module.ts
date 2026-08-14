// S5 规则服务（规格 02 §3）：电影/专辑/剧集三类规则、字段级增量覆盖（M4）、版本管理
import { Body, Controller, Get, Module, Param, Put } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { InjectRepository, TypeOrmModule } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ChannelRule } from "../../database/entities";
import { CurrentUser, RequestUser } from "../../common/auth";
import { ChannelModule, ChannelService } from "../channel/channel.module";
import { LockModule, LockService } from "../lock/lock.module";
import { OplogModule, OplogService } from "../oplog/oplog.module";

const RULE_TYPES = ["movie", "album", "drama"] as const;

@Injectable()
export class RuleService {
  constructor(
    @InjectRepository(ChannelRule) private readonly rules: Repository<ChannelRule>,
    private readonly channels: ChannelService,
    private readonly locks: LockService,
    private readonly oplog: OplogService,
  ) {}

  async getAll(user: RequestUser, channelId: string) {
    await this.channels.assertAccess(user, channelId);
    const rows = await this.rules.find({ where: { channel_id: channelId } });
    return {
      rules: RULE_TYPES.map((t) => {
        const r = rows.find((x) => x.rule_type === t);
        return { rule_type: t, fields: r?.fields ?? {}, rule_version: r?.rule_version ?? 0 };
      }),
    };
  }

  /** 字段级增量覆盖：仅替换 body 中出现的字段，其余保留（M4）；返回新版本号 */
  async upsert(user: RequestUser, channelId: string, body: { rule_type: string; fields: Record<string, unknown> }) {
    await this.channels.assertAccess(user, channelId);
    await this.locks.assertHeld(user, channelId); // G3
    let rule = await this.rules.findOne({ where: { channel_id: channelId, rule_type: body.rule_type as never } });
    if (!rule) {
      rule = this.rules.create({ channel_id: channelId, rule_type: body.rule_type as never, fields: {}, rule_version: 0 });
    }
    const before = { ...rule.fields };
    rule.fields = { ...rule.fields, ...body.fields }; // 字段级 merge
    rule.rule_version += 1;
    await this.rules.save(rule);
    await this.oplog.append({
      channel_id: channelId, operator_id: user.id, operator_name: user.nickname,
      action: "rule_update", detail: { rule_type: body.rule_type, before, after: rule.fields, rule_version: rule.rule_version },
    });
    return { rule_version: rule.rule_version };
  }

  /** T5 规则继承：读取当前有效规则对象（结构化，非文本回溯，M5） */
  async current(channelId: string) {
    const rows = await this.rules.find({ where: { channel_id: channelId } });
    return rows.map((r) => ({ rule_type: r.rule_type, fields: r.fields, rule_version: r.rule_version }));
  }
}

@Controller("api/channels/:id/rules")
export class RuleController {
  constructor(private readonly svc: RuleService) {}

  @Get()
  getAll(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.svc.getAll(user, id);
  }

  @Put()
  upsert(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { rule_type: string; fields: Record<string, unknown> }) {
    return this.svc.upsert(user, id, body);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([ChannelRule]), ChannelModule, LockModule, OplogModule],
  controllers: [RuleController],
  providers: [RuleService],
  exports: [RuleService],
})
export class RuleModule {}
