import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import * as crypto from 'crypto';
import { Organization } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrganizationDto): Promise<Organization> {
    const apiKey = dto.api_key || `gd_live_${crypto.randomBytes(24).toString('hex')}`;

    // Check if API key already exists
    const existing = await this.prisma.organization.findUnique({
      where: { apiKey },
    });

    if (existing) {
      throw new ConflictException('An organization with this API key already exists.');
    }

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        apiKey,
      },
    });

    this.logger.log(`Created organization "${org.name}" with ID=${org.id}`);
    return org;
  }

  async findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({
      where: { id },
    });
  }
}
