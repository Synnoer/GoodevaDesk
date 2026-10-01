import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address of the customer reporting the issue',
  })
  @IsEmail({}, { message: 'customer_email must be a valid email address' })
  @IsNotEmpty({ message: 'customer_email is required' })
  customer_email: string;

  @ApiProperty({
    example: 'Cannot access invoice PDF for September',
    description: 'Brief subject or title of the ticket',
  })
  @IsString()
  @IsNotEmpty({ message: 'subject is required' })
  @MaxLength(255)
  subject: string;

  @ApiProperty({
    example: 'Hi support, when clicking download invoice in billing tab, it shows 404 not found. Please help.',
    description: 'Detailed description / message of the issue',
  })
  @IsString()
  @IsNotEmpty({ message: 'message is required' })
  message: string;
}
