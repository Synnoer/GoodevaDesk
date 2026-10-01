import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class TenantRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(TenantRateLimitGuard.name);

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<any>();
    const response = context.switchToHttp().getResponse<any>();

    // Tenant ID is resolved by ApiKeyGuard and attached to request.organizationId
    const orgId = request.organizationId || request.organization?.id;

    // If no orgId is found (e.g. unauthenticated public endpoints), bypass
    if (!orgId) {
      return true;
    }

    const maxRequests = Number(
      this.configService.get<number>('TENANT_API_RATE_LIMIT_MAX', 10),
    );
    const windowSeconds = Number(
      this.configService.get<number>('TENANT_API_RATE_LIMIT_WINDOW', 60),
    );

    const key = `ratelimit:api:tenant:${orgId}`;

    const currentCount = await this.redis.incr(key, windowSeconds);
    const ttl = await this.redis.ttl(key);
    const effectiveTtl = ttl > 0 ? ttl : windowSeconds;

    const remaining = Math.max(0, maxRequests - currentCount);
    const resetTime = Math.floor(Date.now() / 1000) + effectiveTtl;

    // Set standard rate limit headers
    if (response && typeof response.setHeader === 'function') {
      response.setHeader('X-RateLimit-Limit', maxRequests.toString());
      response.setHeader('X-RateLimit-Remaining', remaining.toString());
      response.setHeader('X-RateLimit-Reset', resetTime.toString());
    }

    if (currentCount > maxRequests) {
      this.logger.warn(
        `Rate limit exceeded for organization ${orgId}: ${currentCount}/${maxRequests} in ${windowSeconds}s window`,
      );

      if (response && typeof response.setHeader === 'function') {
        response.setHeader('Retry-After', effectiveTtl.toString());
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `API rate limit exceeded for this tenant. Maximum ${maxRequests} requests per ${windowSeconds}s allowed. Please retry after ${effectiveTtl} seconds.`,
          error: 'Too Many Requests',
          retryAfter: effectiveTtl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
