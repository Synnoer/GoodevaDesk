import { Module } from '@nestjs/common';
import { LLMService } from './llm.service';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { LLMCacheService } from './llm-cache.service';
import { LLMTokenLimiterService } from './llm-token-limiter.service';

@Module({
  providers: [
    GeminiProvider,
    GroqProvider,
    LLMCacheService,
    LLMTokenLimiterService,
    LLMService,
  ],
  exports: [LLMService, LLMCacheService, LLMTokenLimiterService],
})
export class LLMModule {}
