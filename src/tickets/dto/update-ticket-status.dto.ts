import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TicketStatus } from '@prisma/client';

export class UpdateTicketStatusDto {
  @ApiProperty({
    enum: TicketStatus,
    example: TicketStatus.in_progress,
    description: 'Updated status of the ticket (open, in_progress, closed)',
  })
  @IsEnum(TicketStatus, {
    message: `status must be one of: ${Object.values(TicketStatus).join(', ')}`,
  })
  @IsNotEmpty({ message: 'status is required' })
  status: TicketStatus;
}
