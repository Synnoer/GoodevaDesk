import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LLMService } from '../llm/llm.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { FilterTicketDto } from './dto/filter-ticket.dto';
import { Prisma, Ticket } from '@prisma/client';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly llmService: LLMService,
  ) {}

  /**
   * Create a new support ticket:
   * 1. Runs LLM classification & draft reply generation.
   * 2. Persists ticket scoped strictly to the organization.
   * 3. Invalidates relevant Redis cache keys.
   */
  async createTicket(organizationId: string, dto: CreateTicketDto): Promise<Ticket> {
    this.logger.log(`Creating ticket for organizationId=${organizationId}, email=${dto.customer_email}`);

    // LLM analysis for category classification and draft reply
    const llmResult = await this.llmService.classifyAndDraftReply(dto.subject, dto.message);

    const ticket = await this.prisma.ticket.create({
      data: {
        organizationId,
        customerEmail: dto.customer_email,
        subject: dto.subject,
        message: dto.message,
        category: llmResult.category,
        suggestedReply: llmResult.suggestedReply,
        status: 'open',
      },
    });

    // Invalidate cached lists for this organization
    await this.redis.delByPattern(`tickets:org:${organizationId}:*`);

    return ticket;
  }

  /**
   * Find tickets belonging strictly to the organization with optional status & category filters.
   */
  async findTickets(organizationId: string, filterDto: FilterTicketDto) {
    const { status, category, page = 1, limit = 20 } = filterDto;
    const skip = (page - 1) * limit;

    const cacheKey = `tickets:org:${organizationId}:status=${status || 'all'}:cat=${category || 'all'}:p=${page}:l=${limit}`;

    // Check Redis cache
    const cached = await this.redis.get<{
      data: Ticket[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    const whereClause: Prisma.TicketWhereInput = {
      organizationId, // Strict tenant isolation
      ...(status && { status }),
      ...(category && { category: { equals: category, mode: 'insensitive' } }),
    };

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ticket.count({
        where: whereClause,
      }),
    ]);

    const result = {
      data: tickets,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };

    // Cache results for 60 seconds
    await this.redis.set(cacheKey, result, 60);

    return result;
  }

  /**
   * Find a single ticket by ID strictly scoped to organizationId.
   */
  async findTicketById(organizationId: string, id: string): Promise<Ticket> {
    const cacheKey = `ticket:${organizationId}:${id}`;

    // Check Redis cache
    const cached = await this.redis.get<Ticket>(cacheKey);
    if (cached) {
      return cached;
    }

    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id,
        organizationId, // Strict tenant isolation
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID "${id}" was not found in your organization.`);
    }

    // Cache ticket detail for 120 seconds
    await this.redis.set(cacheKey, ticket, 120);

    return ticket;
  }

  /**
   * Update status of a ticket strictly scoped to organizationId.
   */
  async updateTicketStatus(
    organizationId: string,
    id: string,
    dto: UpdateTicketStatusDto,
  ): Promise<Ticket> {
    // Verify ticket exists and belongs to the organization
    await this.findTicketById(organizationId, id);

    const updated = await this.prisma.ticket.update({
      where: {
        id,
      },
      data: {
        status: dto.status,
      },
    });

    // Invalidate Redis caches
    await Promise.all([
      this.redis.del(`ticket:${organizationId}:${id}`),
      this.redis.delByPattern(`tickets:org:${organizationId}:*`),
    ]);

    return updated;
  }
}
