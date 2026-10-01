import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Organization } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  organization: Organization;
  organizationId: string;
  headers: Headers & Record<string, string | undefined>;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<any>();
    const apiKey =
      request.headers['x-api-key'] ||
      request.headers['X-API-KEY'] ||
      request.headers['x-api-token'];

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new UnauthorizedException(
        'Missing API Key. Please provide a valid "x-api-key" header.',
      );
    }

    const trimmedKey = apiKey.trim();
    const cacheKey = `org:apikey:${trimmedKey}`;

    // 1. Try Redis cache first
    let organization = await this.redis.get<Organization>(cacheKey);

    // 2. If cache miss, fetch from PostgreSQL database
    if (!organization) {
      organization = await this.prisma.organization.findUnique({
        where: { apiKey: trimmedKey },
      });

      if (!organization) {
        this.logger.warn(`Unauthorized access attempt with invalid API key: ${trimmedKey.substring(0, 8)}...`);
        throw new UnauthorizedException('Invalid API Key.');
      }

      // Cache the organization for 30 minutes (1800s)
      await this.redis.set(cacheKey, organization, 1800);
    }

    // 3. Attach organization to request object for strict tenant isolation
    request.organization = organization;
    request.organizationId = organization.id;

    return true;
  }
}
