import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { TenantRateLimitGuard } from './tenant-rate-limit.guard';

@Module({
  providers: [ApiKeyGuard, TenantRateLimitGuard],
  exports: [ApiKeyGuard, TenantRateLimitGuard],
})
export class AuthModule {}
