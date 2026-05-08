import {
  Controller, Get, Post, Query, Body, Param, Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentFirmId } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserRole } from '../../common/enums';

@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get dashboard metrics — single date (cached) or date range (live)' })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  getDashboard(
    @CurrentFirmId() firmId: string,
    @Query('date') date?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
  ) {
    if (date_from || date_to) {
      return this.service.getDashboardRange(firmId, date_from, date_to);
    }
    return this.service.getDashboard(firmId, date);
  }

  @Post('summary-sheets')
  @Roles(UserRole.FIRM_HEAD, UserRole.AUTHORIZER)
  @ApiOperation({ summary: 'Generate an immutable summary sheet for a sale date' })
  generateSummarySheet(
    @Body('sale_date') sale_date: string,
    @CurrentFirmId() firmId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.generateSummarySheet(firmId, sale_date, user.sub);
  }

  @Get('summary-sheets')
  @ApiOperation({ summary: 'List summary sheets' })
  getSummarySheets(
    @CurrentFirmId() firmId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.getSummarySheets(firmId, page, limit);
  }
}
