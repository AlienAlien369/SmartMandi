import {
  Controller, Get, Query, Res, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentFirmId } from '../../common/decorators/current-user.decorator';
import { LedgerType } from '../../common/enums';

@ApiTags('reports')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('ledger')
  @ApiOperation({ summary: 'Ledger view by type (CUSTOMER, TRUCK, FIRM_CASH, USER_SALARY)' })
  getLedger(
    @CurrentFirmId() firmId: string,
    @Query('type') type: LedgerType,
    @Query('customer_id') customer_id?: string,
    @Query('truck_id') truck_id?: string,
    @Query('user_id') user_id?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.getLedgerReport(firmId, {
      ledger_type: type,
      customer_id, truck_id, user_id, from, to, page, limit,
    });
  }

  @Get('cash-flow')
  @ApiOperation({ summary: 'Cash flow report (FIRM_CASH ledger grouped by date)' })
  getCashFlow(
    @CurrentFirmId() firmId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.getCashFlowReport(firmId, from, to);
  }

  @Get('export/kcs')
  @ApiOperation({ summary: 'Export KCs as CSV for a sale date' })
  async exportKcs(
    @CurrentFirmId() firmId: string,
    @Query('date') date: string,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportKcsCsv(firmId, date);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="kcs-${date}.csv"`);
    res.send(csv);
  }

  @Get('export/trucks')
  @ApiOperation({ summary: 'Export trucks as CSV for a sale date' })
  async exportTrucks(
    @CurrentFirmId() firmId: string,
    @Query('date') date: string,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportTrucksCsv(firmId, date);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="trucks-${date}.csv"`);
    res.send(csv);
  }
}
