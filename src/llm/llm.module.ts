import { Module } from '@nestjs/common';
import { LLMService } from './llm.service';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';

@Module({
  providers: [GeminiProvider, GroqProvider, LLMService],
  exports: [LLMService],
})
export class LLMModule {}
