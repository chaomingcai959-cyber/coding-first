// S7 操作日志服务（规格 02 §3）：追加写、不可改删、仅管理员可检索
import { Controller, Get, Module, Query } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { InjectRepository, TypeOrmModule } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OperationLog } from "../../database/entities";
import { CurrentUser, RequestUser } from "../../common/auth";
import { authForbidden } from "../../common/errors";

@Injectable()
export class OplogService {
  constructor(@InjectRepository(OperationLog) private readonly logs: Repository<OperationLog>) {}

  /** 追加写（全量留痕：人/时间/前后内容快照/对话原文）。不提供更新与删除接口。 */
  async append(entry: {
    channel_id?: string;
    operator_id: string;
    operator_name: string;
    action: string;
    detail: unknown;
  }) {
    await this.logs.insert(entry as never);
  }

  async query(user: RequestUser, q: { channel_id?: string; operator?: string; from?: string; to?: string; page?: string; size?: string }) {
    if (user.role !== "admin") throw authForbidden();
    const page = Math.max(1, parseInt(q.page || "1", 10));
    const size = Math.min(100, Math.max(1, parseInt(q.size || "20", 10)));
    const qb = this.logs.createQueryBuilder("l").orderBy("l.created_at", "DESC");
    if (q.channel_id) qb.andWhere("l.channel_id = :cid", { cid: q.channel_id });
    if (q.operator) qb.andWhere("(l.operator_id = :op OR l.operator_name LIKE :opn)", { op: q.operator, opn: `%${q.operator}%` });
    if (q.from) qb.andWhere("l.created_at >= :from", { from: q.from });
    if (q.to) qb.andWhere("l.created_at <= :to", { to: q.to });
    const [items, total] = await qb.skip((page - 1) * size).take(size).getManyAndCount();
    return { total, items };
  }
}

@Controller("api/logs")
export class OplogController {
  constructor(private readonly svc: OplogService) {}

  @Get()
  query(@CurrentUser() user: RequestUser, @Query() q: Record<string, string>) {
    return this.svc.query(user, q);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([OperationLog])],
  controllers: [OplogController],
  providers: [OplogService],
  exports: [OplogService],
})
export class OplogModule {}
