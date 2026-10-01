import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { LLMModule } from './llm/llm.module';
import { TicketsModule } from './tickets/tickets.module';
import { OrganizationsModule } from './organizations/organizations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    LLMModule,
    OrganizationsModule,
    TicketsModule,
  ],
})
export class AppModule {}
