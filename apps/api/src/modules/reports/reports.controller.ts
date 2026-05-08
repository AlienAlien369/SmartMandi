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
  @ApiOperation({ summary: 'Export KCs as CSV — single date or date range' })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  async exportKcs(
    @CurrentFirmId() firmId: string,
    @Query('date') date: string,
    @Query('date_from') date_from: string,
    @Query('date_to') date_to: string,
    @Res() res: Response,
  ) {
    const from = date_from || date;
    const to   = date_to   || date;
    const csv = await this.service.exportKcsCsv(firmId, from, to);
    const label = from === to ? from : `${from}_to_${to}`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="kcs-${label}.csv"`);
    res.send(csv);
  }

  @Get('export/trucks')
  @ApiOperation({ summary: 'Export trucks as CSV — single date or date range' })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  async exportTrucks(
    @CurrentFirmId() firmId: string,
    @Query('date') date: string,
    @Query('date_from') date_from: string,
    @Query('date_to') date_to: string,
    @Res() res: Response,
  ) {
    const from = date_from || date;
    const to   = date_to   || date;
    const csv = await this.service.exportTrucksCsv(firmId, from, to);
    const label = from === to ? from : `${from}_to_${to}`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="trucks-${label}.csv"`);
    res.send(csv);
  }
}
