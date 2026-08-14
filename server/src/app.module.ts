import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EnvelopeInterceptor } from "./common/envelope.interceptor";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { AuthGuard } from "./common/auth";
import { ALL_ENTITIES } from "./database/entities";
import { ChannelModule } from "./modules/channel/channel.module";
import { ProgramModule } from "./modules/program/program.module";
import { PlaylistModule } from "./modules/playlist/playlist.module";
import { SessionModule } from "./modules/session/session.module";
import { RuleModule } from "./modules/rule/rule.module";
import { LockModule } from "./modules/lock/lock.module";
import { OplogModule } from "./modules/oplog/oplog.module";
import { AiModule } from "./modules/ai/ai.module";

@Module({
  imports: [
    // 附录 C6：PostgreSQL（本地 docker-compose 起库；禁用 synchronize，DDL 以 migration 为准）
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.PG_HOST || "127.0.0.1",
      port: parseInt(process.env.PG_PORT || "5432", 10),
      username: process.env.PG_USER || "workbench",
      password: process.env.PG_PASSWORD || "workbench",
      database: process.env.PG_DB || "workbench",
      entities: ALL_ENTITIES,
      synchronize: process.env.TYPEORM_SYNC === "1", // 仅限本地首次建表；生产必须走 migration
    }),
    ChannelModule, ProgramModule, PlaylistModule, SessionModule,
    RuleModule, LockModule, OplogModule, AiModule,
  ],
  providers: [
    Reflector,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
