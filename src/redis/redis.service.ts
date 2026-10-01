import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD') || undefined;

    try {
      this.client = new Redis({
        host,
        port: Number(port),
        password,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn('Redis connection retry limit reached. Redis features will be bypassed.');
            return null;
          }
          return Math.min(times * 100, 2000);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Connected to Redis at ${host}:${port}`);
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(`Redis connection error: ${err.message}`);
      });

      this.client.connect().catch((err) => {
        this.isConnected = false;
        this.logger.warn(`Failed initial Redis connect: ${err.message}. Running in fallback mode.`);
      });
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(`Could not initialize Redis client: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
        this.logger.log('Disconnected from Redis.');
      } catch (err: any) {
        this.logger.warn(`Error disconnecting Redis: ${err.message}`);
      }
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err: any) {
      this.logger.warn(`Redis GET error for key ${key}: ${err.message}`);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (err: any) {
      this.logger.warn(`Redis SET error for key ${key}: ${err.message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await this.client.del(key);
    } catch (err: any) {
      this.logger.warn(`Redis DEL error for key ${key}: ${err.message}`);
    }
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (!this.isConnected || !this.client) return 0;
    try {
      const res = await this.client.incr(key);
      if (res === 1 && ttlSeconds && ttlSeconds > 0) {
        await this.client.expire(key, ttlSeconds);
      }
      return res;
    } catch (err: any) {
      this.logger.warn(`Redis INCR error for key ${key}: ${err.message}`);
      return 0;
    }
  }

  async incrBy(key: string, amount: number, ttlSeconds?: number): Promise<number> {
    if (!this.isConnected || !this.client) return 0;
    try {
      const res = await this.client.incrby(key, amount);
      if (res === amount && ttlSeconds && ttlSeconds > 0) {
        await this.client.expire(key, ttlSeconds);
      }
      return res;
    } catch (err: any) {
      this.logger.warn(`Redis INCRBY error for key ${key}: ${err.message}`);
      return 0;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isConnected || !this.client) return -1;
    try {
      return await this.client.ttl(key);
    } catch (err: any) {
      this.logger.warn(`Redis TTL error for key ${key}: ${err.message}`);
      return -1;
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      const stream = this.client.scanStream({
        match: pattern,
        count: 100,
      });

      stream.on('data', async (keys: string[]) => {
        if (keys.length && this.client) {
          const pipeline = this.client.pipeline();
          keys.forEach((key) => pipeline.del(key));
          await pipeline.exec();
        }
      });
    } catch (err: any) {
      this.logger.warn(`Redis delByPattern error for pattern ${pattern}: ${err.message}`);
    }
  }
}
