import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { ILLMProvider, LLMTicketAnalysis } from '../llm.interface';

@Injectable()
export class GroqProvider implements ILLMProvider {
  readonly name = 'groq';
  private readonly logger = new Logger(GroqProvider.name);
  private client: Groq | null = null;
  private modelName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    this.modelName = this.configService.get<string>('GROQ_MODEL', 'llama-3.3-70b-versatile');

    if (apiKey) {
      this.client = new Groq({ apiKey });
      this.logger.log(`Groq provider initialized with model: ${this.modelName}`);
    } else {
      this.logger.warn('GROQ_API_KEY is not set. Groq provider will be disabled.');
    }
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  async analyzeTicket(subject: string, message: string): Promise<LLMTicketAnalysis | null> {
    if (!this.client) return null;

    const systemPrompt = `You are an AI customer support assistant for a multi-tenant support desk.
Your task is to classify incoming customer tickets and generate a high quality draft reply for human support agents to review.

Categories:
- "billing" (invoices, payments, refunds, subscription plans)
- "technical" (bugs, system errors, API issues, outages, integration problems)
- "general" (how-to questions, basic information, general feedback)
- "account" (login issues, password reset, permissions, account deletion)
- "feature_request" (new feature suggestions, improvements)

You must respond with valid JSON matching:
{
  "category": "billing | technical | general | account | feature_request",
  "suggestedReply": "Polite, professional draft reply in the customer's language",
  "confidence": 0.95
}`;

    const userPrompt = `Ticket Subject: ${subject}
Ticket Message: ${message}

Analyze the ticket and generate the JSON response.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content);
      return {
        category: parsed.category || 'general',
        suggestedReply: parsed.suggestedReply || '',
        confidence: parsed.confidence,
        provider: 'groq',
      };
    } catch (error: any) {
      this.logger.error(`Groq analysis error: ${error.message}`);
      return null;
    }
  }
}
