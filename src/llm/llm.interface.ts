export interface LLMTicketAnalysis {
  category: string;
  suggestedReply: string;
  confidence?: number;
  provider: 'gemini' | 'groq' | 'fallback' | 'cache';
  cached?: boolean;
}

export interface ILLMProvider {
  name: string;
  analyzeTicket(subject: string, message: string): Promise<LLMTicketAnalysis | null>;
}
