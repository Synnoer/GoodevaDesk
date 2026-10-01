import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ILLMProvider, LLMTicketAnalysis } from '../llm.interface';

@Injectable()
export class GeminiProvider implements ILLMProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private client: GoogleGenerativeAI | null = null;
  private modelName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.modelName = this.configService.get<string>('GEMINI_MODEL', 'gemini-1.5-flash');

    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
      this.logger.log(`Gemini provider initialized with model: ${this.modelName}`);
    } else {
      this.logger.warn('GEMINI_API_KEY is not set. Gemini provider will be disabled.');
    }
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  async analyzeTicket(subject: string, message: string): Promise<LLMTicketAnalysis | null> {
    if (!this.client) return null;

    const prompt = `You are an AI customer support assistant for a SaaS platform.
Your task is to analyze the support ticket below, classify it into one category, and generate a polite, professional draft reply for the human support agent to review.

Supported Categories:
- "billing" (invoices, payments, refunds, subscription plans)
- "technical" (bugs, system errors, API issues, outages, integration problems)
- "general" (how-to questions, basic information, general feedback)
- "account" (login issues, password reset, permissions, account deletion)
- "feature_request" (new feature suggestions, improvements)

Ticket Details:
Subject: ${subject}
Message: ${message}

Instructions:
1. Detect the language of the ticket message (e.g. Indonesian, English, etc.) and write the draft reply in the EXACT SAME LANGUAGE.
2. The draft reply should be polite, empathetic, professional, addressing the user's issue directly, but keeping it ready for a human agent to review and send.
3. Return ONLY a valid JSON object without markdown code blocks, with the following format:
{
  "category": "billing | technical | general | account | feature_request",
  "suggestedReply": "Your draft reply string here...",
  "confidence": 0.95
}`;

    try {
      const model = this.client.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        category: parsed.category || 'general',
        suggestedReply: parsed.suggestedReply || '',
        confidence: parsed.confidence,
        provider: 'gemini',
      };
    } catch (error: any) {
      this.logger.error(`Gemini analysis error: ${error.message}`);
      return null;
    }
  }
}
