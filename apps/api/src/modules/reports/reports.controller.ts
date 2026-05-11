import {
  Controller, Get, Query, Res, UseGuards,
  Headers, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ReportsService } from './reports.service';
import { BuyerSummaryPdfService } from './buyer-summary-pdf.service';
import { DaybookPdfService } from './daybook-pdf.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentFirmId } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { LedgerType } from '../../common/enums';

@ApiTags('reports')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly buyerSummaryPdfService: BuyerSummaryPdfService,
    private readonly daybookPdfService: DaybookPdfService,
    private readonly jwtService: JwtService,
  ) {}

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

  /** Buyer Summary PDF — Public endpoint, JWT via ?token= or Authorization header */
  @Public()
  @Get('buyer-summary/pdf')
  @ApiOperation({ summary: 'Download buyer summary PDF for a date range (PDF must be enabled by SA)' })
  @ApiQuery({ name: 'date_from', required: true, description: 'Start date YYYY-MM-DD' })
  @ApiQuery({ name: 'date_to', required: true, description: 'End date YYYY-MM-DD' })
  @ApiQuery({ name: 'token', required: false, description: 'JWT access token (alternative to Authorization header)' })
  async buyerSummaryPdf(
    @Query('date_from') dateFrom: string,
    @Query('date_to') dateTo: string,
    @Query('token') tokenQuery: string,
    @Headers('authorization') authHeader: string,
    @Res() res: Response,
  ) {
    // Manual JWT verification (needed for Linking.openURL which can't set headers)
    const rawToken = tokenQuery || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
    if (!rawToken) throw new UnauthorizedException('Token required');
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(rawToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!dateFrom || !dateTo) throw new UnauthorizedException('date_from and date_to params are required');

    const firmId = payload.firm_id;
    const buf = await this.buyerSummaryPdfService.generateBuyerSummaryPdf(firmId, dateFrom, dateTo);
    const isSingleDay = dateFrom === dateTo;
    const label = isSingleDay
      ? dateFrom.replace(/-/g, '')
      : `${dateFrom.replace(/-/g, '')}-${dateTo.replace(/-/g, '')}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="buyer-summary-${label}.pdf"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  }

  /** Day Book PDF — Public endpoint, JWT via ?token= or Authorization header */
  @Public()
  @Get('daybook/pdf')
  @ApiOperation({ summary: 'Download truck-wise day book PDF for a date range (must be enabled by SA)' })
  @ApiQuery({ name: 'date_from', required: true, description: 'Start date YYYY-MM-DD' })
  @ApiQuery({ name: 'date_to',   required: true, description: 'End date YYYY-MM-DD' })
  @ApiQuery({ name: 'token',     required: false, description: 'JWT access token' })
  async daybookPdf(
    @Query('date_from') dateFrom: string,
    @Query('date_to')   dateTo: string,
    @Query('token')     tokenQuery: string,
    @Headers('authorization') authHeader: string,
    @Res() res: Response,
  ) {
    const rawToken = tokenQuery || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
    if (!rawToken) throw new UnauthorizedException('Token required');
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(rawToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!dateFrom || !dateTo) throw new UnauthorizedException('date_from and date_to params are required');

    const firmId = payload.firm_id;
    const buf = await this.daybookPdfService.generateDaybookPdf(firmId, dateFrom, dateTo);
    const isSingleDay = dateFrom === dateTo;
    const label = isSingleDay
      ? dateFrom.replace(/-/g, '')
      : `${dateFrom.replace(/-/g, '')}-${dateTo.replace(/-/g, '')}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="daybook-${label}.pdf"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  }
}
