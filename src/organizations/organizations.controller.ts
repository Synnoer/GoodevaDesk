import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CurrentOrg } from '../auth/current-org.decorator';
import { Organization } from '@prisma/client';

@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new organization tenant',
    description: 'Creates a new organization tenant and generates an API key for authentication.',
  })
  @ApiResponse({ status: 201, description: 'Organization created successfully.' })
  @ApiResponse({ status: 409, description: 'API Key conflict.' })
  async createOrganization(@Body() createDto: CreateOrganizationDto) {
    return this.organizationsService.create(createDto);
  }

  @Get('me')
  @UseGuards(ApiKeyGuard)
  @ApiHeader({
    name: 'x-api-key',
    description: 'Organization API Key',
    required: true,
  })
  @ApiOperation({
    summary: 'Get current organization details',
    description: 'Returns the organization profile associated with the provided x-api-key header.',
  })
  @ApiResponse({ status: 200, description: 'Organization profile returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getMyOrganization(@CurrentOrg() org: Organization) {
    return org;
  }
}
