import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiHeader, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { FilterTicketDto } from './dto/filter-ticket.dto';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { TenantRateLimitGuard } from '../auth/tenant-rate-limit.guard';
import { CurrentOrg } from '../auth/current-org.decorator';

@ApiTags('Tickets')
@ApiHeader({
  name: 'x-api-key',
  description: 'Organization API Key for authentication and tenant isolation',
  required: true,
})
@ApiResponse({
  status: 429,
  description: 'Too Many Requests - Tenant API rate limit exceeded.',
})
@UseGuards(ApiKeyGuard, TenantRateLimitGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new ticket',
    description:
      'Creates a new support ticket and automatically triggers LLM classification (Gemini/Groq) and suggested draft reply.',
  })
  @ApiResponse({ status: 201, description: 'Ticket created successfully with LLM classification & draft reply.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing API key.' })
  async createTicket(
    @CurrentOrg('id') orgId: string,
    @Body() createTicketDto: CreateTicketDto,
  ) {
    return this.ticketsService.createTicket(orgId, createTicketDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List organization tickets',
    description:
      'Returns a list of tickets belonging strictly to the authenticated organization. Filterable by status and category.',
  })
  @ApiResponse({ status: 200, description: 'Tickets retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing API key.' })
  async getTickets(
    @CurrentOrg('id') orgId: string,
    @Query() filterDto: FilterTicketDto,
  ) {
    return this.ticketsService.findTickets(orgId, filterDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get ticket detail by ID',
    description:
      'Retrieves the full detail of a ticket (including category and suggested_reply) strictly within the organization.',
  })
  @ApiParam({ name: 'id', description: 'Ticket UUID' })
  @ApiResponse({ status: 200, description: 'Ticket detail retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing API key.' })
  async getTicketById(
    @CurrentOrg('id') orgId: string,
    @Param('id') id: string,
  ) {
    return this.ticketsService.findTicketById(orgId, id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update ticket status',
    description: 'Updates the status of a ticket (open, in_progress, closed) within the organization.',
  })
  @ApiParam({ name: 'id', description: 'Ticket UUID' })
  @ApiResponse({ status: 200, description: 'Ticket status updated successfully.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing API key.' })
  async updateTicketStatus(
    @CurrentOrg('id') orgId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateTicketStatus(orgId, id, updateDto);
  }
}
