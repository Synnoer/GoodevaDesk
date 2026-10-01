import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { LLMTicketAnalysis } from './llm.interface';
import { LLMCacheService } from './llm-cache.service';
import { LLMTokenLimiterService } from './llm-token-limiter.service';

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private preferredProvider: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiProvider: GeminiProvider,
    private readonly groqProvider: GroqProvider,
    private readonly llmCacheService: LLMCacheService,
    private readonly tokenLimiterService: LLMTokenLimiterService,
  ) {
    this.preferredProvider = this.configService.get<string>('LLM_PROVIDER', 'gemini').toLowerCase();
  }

  /**
   * Classifies ticket and drafts reply with:
   * 1. Redis classification cache check (exact / normalized similarity)
   * 2. Per-tenant LLM token usage budget check
   * 3. Primary/Secondary LLM provider invocation
   * 4. Automatic caching and token consumption recording
   * 5. Fallback heuristic engine if rate-limited or providers fail
   */
  async classifyAndDraftReply(
    organizationId: string,
    subject: string,
    message: string,
  ): Promise<LLMTicketAnalysis> {
    // 1. Check Redis LLM Cache
    if (organizationId) {
      const cached = await this.llmCacheService.getCached(organizationId, subject, message);
      if (cached) {
        return cached;
      }
    }

    // 2. Check LLM Token Quota for Tenant
    if (organizationId) {
      const estimatedTokens = this.tokenLimiterService.estimateTokens(subject, message);
      const budget = await this.tokenLimiterService.checkTokenBudget(organizationId, estimatedTokens);

      if (!budget.allowed) {
        this.logger.warn(
          `Tenant org=${organizationId} exceeded LLM token quota (${budget.currentUsage}/${budget.maxTokens}). Falling back to heuristic engine.`,
        );
        return this.heuristicFallback(subject, message);
      }
    }

    const primary = this.preferredProvider === 'groq' ? this.groqProvider : this.geminiProvider;
    const secondary = this.preferredProvider === 'groq' ? this.geminiProvider : this.groqProvider;

    let result: LLMTicketAnalysis | null = null;

    // 3. Try Primary Provider
    if (primary.isAvailable()) {
      this.logger.log(`Attempting LLM classification using primary provider: ${primary.name}`);
      result = await primary.analyzeTicket(subject, message);
      if (!result) {
        this.logger.warn(`Primary provider ${primary.name} failed or returned empty. Trying fallback...`);
      }
    }

    // 4. Try Secondary Provider
    if (!result && secondary.isAvailable()) {
      this.logger.log(`Attempting LLM classification using secondary provider: ${secondary.name}`);
      result = await secondary.analyzeTicket(subject, message);
      if (!result) {
        this.logger.warn(`Secondary provider ${secondary.name} also failed.`);
      }
    }

    // 5. If providers succeeded, record tokens and save cache
    if (result) {
      if (organizationId) {
        const consumedTokens = this.tokenLimiterService.estimateTokens(subject, message) + 150;
        await this.tokenLimiterService.recordTokenUsage(organizationId, consumedTokens);
        await this.llmCacheService.setCached(organizationId, subject, message, result);
      }
      return result;
    }

    // 6. Smart Heuristic Fallback Engine
    this.logger.log('Using rule-based heuristic fallback engine for classification & draft reply.');
    return this.heuristicFallback(subject, message);
  }

  private heuristicFallback(subject: string, message: string): LLMTicketAnalysis {
    const combined = `${subject} ${message}`.toLowerCase();

    let category = 'general';
    let suggestedReply = '';

    if (
      combined.includes('billing') ||
      combined.includes('invoice') ||
      combined.includes('payment') ||
      combined.includes('tagihan') ||
      combined.includes('bayar') ||
      combined.includes('refund') ||
      combined.includes('subscription') ||
      combined.includes('harga')
    ) {
      category = 'billing';
      suggestedReply =
        'Halo, terima kasih telah menghubungi tim support kami terkait pertanyaan tagihan / pembayaran Anda. Kami sedang memeriksa rincian transaksi akun Anda dan akan segera memberikan konfirmasi lebih lanjut.';
    } else if (
      combined.includes('bug') ||
      combined.includes('error') ||
      combined.includes('fail') ||
      combined.includes('crash') ||
      combined.includes('500') ||
      combined.includes('gagal') ||
      combined.includes('rusak') ||
      combined.includes('api') ||
      combined.includes('technical')
    ) {
      category = 'technical';
      suggestedReply =
        'Halo, terima kasih telah melaporkan kendala teknis ini. Tim teknis kami sedang menginvestigasi log sistem terkait masalah tersebut. Mohon informasikan jika Anda memiliki tangkapan layar atau pesan kesalahan tambahan.';
    } else if (
      combined.includes('login') ||
      combined.includes('password') ||
      combined.includes('sandi') ||
      combined.includes('akun') ||
      combined.includes('account') ||
      combined.includes('reset') ||
      combined.includes('auth')
    ) {
      category = 'account';
      suggestedReply =
        'Halo, terima kasih telah menghubungi kami mengenai akun Anda. Demi keamanan, kami dapat membantu Anda melakukan verifikasi dan reset kredensial akun Anda. Tim kami akan memandu langkah selanjutnya.';
    } else if (
      combined.includes('feature') ||
      combined.includes('request') ||
      combined.includes('fitur') ||
      combined.includes('saran') ||
      combined.includes('improvement')
    ) {
      category = 'feature_request';
      suggestedReply =
        'Halo, terima kasih atas masukan dan saran fitur yang sangat berharga bagi kami. Tim produk kami telah mencatat permintaan ini untuk pertimbangan pembaruan sistem ke depan.';
    } else {
      category = 'general';
      suggestedReply =
        'Halo, terima kasih telah menghubungi tim support kami. Kami telah menerima pesan Anda dan agen kami akan segera menindaklanjuti pertanyaan Anda secepatnya.';
    }

    return {
      category,
      suggestedReply,
      confidence: 0.8,
      provider: 'fallback',
    };
  }
}
