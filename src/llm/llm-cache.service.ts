import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { LLMTicketAnalysis } from './llm.interface';
import * as crypto from 'crypto';

@Injectable()
export class LLMCacheService {
  private readonly logger = new Logger(LLMCacheService.name);
  private readonly enabled: boolean;
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.enabled =
      this.configService.get<string>('LLM_CACHE_ENABLED', 'true').toLowerCase() !== 'false';
    this.ttlSeconds = Number(
      this.configService.get<number>('LLM_CACHE_TTL_SECONDS', 604800),
    ); // Default 7 days
  }

  /**
   * Normalizes subject and message to create a canonical fingerprint.
   * Strips extra whitespace, punctuations, and lowercases text so that
   * near-identical tickets (e.g. "Ada kendala login!" vs "ada kendala login")
   * map to the exact same cache entry.
   */
  normalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generates a deterministic SHA-256 cache key scoped per tenant organization.
   */
  generateCacheKey(organizationId: string, subject: string, message: string): string {
    const normalizedSubject = this.normalizeText(subject);
    const normalizedMessage = this.normalizeText(message);
    const combined = `${normalizedSubject} ||| ${normalizedMessage}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    return `llm:cache:org:${organizationId}:${hash}`;
  }

  /**
   * Retrieves cached ticket classification if available.
   */
  async getCached(
    organizationId: string,
    subject: string,
    message: string,
  ): Promise<LLMTicketAnalysis | null> {
    if (!this.enabled) return null;

    const cacheKey = this.generateCacheKey(organizationId, subject, message);
    const cached = await this.redis.get<LLMTicketAnalysis>(cacheKey);

    if (cached) {
      this.logger.log(
        `LLM Cache Hit for organizationId=${organizationId}, category=${cached.category}`,
      );
      return {
        ...cached,
        provider: 'cache',
        cached: true,
      };
    }

    return null;
  }

  /**
   * Caches ticket classification result in Redis.
   */
  async setCached(
    organizationId: string,
    subject: string,
    message: string,
    analysis: LLMTicketAnalysis,
  ): Promise<void> {
    if (!this.enabled) return;

    const cacheKey = this.generateCacheKey(organizationId, subject, message);
    await this.redis.set(cacheKey, analysis, this.ttlSeconds);
    this.logger.log(
      `LLM Classification cached for org=${organizationId} with TTL=${this.ttlSeconds}s`,
    );
  }
}
