import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class LLMTokenLimiterService {
  private readonly logger = new Logger(LLMTokenLimiterService.name);
  private readonly maxTokens: number;
  private readonly windowSeconds: number;

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.maxTokens = Number(
      this.configService.get<number>('TENANT_LLM_TOKEN_LIMIT_MAX', 2000),
    );
    this.windowSeconds = Number(
      this.configService.get<number>('TENANT_LLM_TOKEN_LIMIT_WINDOW', 600),
    ); // Default 10 min
  }

  /**
   * Estimates token count based on text length (~3.5 chars per token for ID/EN).
   */
  estimateTokens(subject: string, message: string): number {
    const totalChars = (subject?.length || 0) + (message?.length || 0) + 500; // includes prompt instructions
    return Math.ceil(totalChars / 3.5);
  }

  /**
   * Checks if tenant has enough remaining token budget in current window.
   */
  async checkTokenBudget(
    organizationId: string,
    estimatedTokens: number = 0,
  ): Promise<{ allowed: boolean; currentUsage: number; remainingTokens: number; maxTokens: number }> {
    const key = `ratelimit:tokens:tenant:${organizationId}`;
    const usageStr = await this.redis.get<string | number>(key);
    const currentUsage = usageStr ? Number(usageStr) : 0;

    const remainingTokens = Math.max(0, this.maxTokens - currentUsage);
    const allowed = currentUsage + estimatedTokens <= this.maxTokens;

    return {
      allowed,
      currentUsage,
      remainingTokens,
      maxTokens: this.maxTokens,
    };
  }

  /**
   * Records token consumption for the tenant in Redis.
   */
  async recordTokenUsage(organizationId: string, tokens: number): Promise<number> {
    if (tokens <= 0) return 0;
    const key = `ratelimit:tokens:tenant:${organizationId}`;
    const newTotal = await this.redis.incrBy(key, tokens, this.windowSeconds);
    this.logger.log(
      `Tenant org=${organizationId} consumed ${tokens} LLM tokens (Total in window: ${newTotal}/${this.maxTokens})`,
    );
    return newTotal;
  }
}
