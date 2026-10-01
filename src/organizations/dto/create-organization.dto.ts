import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({
    example: 'Acme Corp Support',
    description: 'Name of the organization / tenant',
  })
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'org_live_secret_key_12345',
    description: 'Custom API Key (optional - will be auto-generated if omitted)',
  })
  @IsOptional()
  @IsString()
  api_key?: string;
}
