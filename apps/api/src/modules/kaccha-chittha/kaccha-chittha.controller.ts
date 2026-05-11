import {
  Controller, Get, Post, Patch, Body, Param,
  Query, UseGuards, HttpCode, HttpStatus, Headers,
  Res, UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { KacchaChitthaService } from './kaccha-chittha.service';
import { KcPdfService } from './kc-pdf.service';
import {
  CreateKCDto, AddPaymentDto, AuthorizeKCDto,
  CancelKCDto, UpdateLineItemsDto,
} from './dto/kc.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, CurrentFirmId } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { KCStatus } from '../../common/enums';

const MODULE = 'KC';

@ApiTags('kaccha-chittha')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('kcs')
export class KacchaChitthaController {
  constructor(
    private readonly service: KacchaChitthaService,
    private readonly pdfService: KcPdfService,
    private readonly jwtService: JwtService,
  ) {}

  @Post()
  @RequirePermission(MODULE, 'create')
  @ApiOperation({ summary: 'Create a new Kaccha Chittha (DRAFT)' })
  @ApiHeader({ name: 'X-Idempotency-Key', required: true })
  create(@Body() dto: CreateKCDto, @CurrentFirmId() firmId: string, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, firmId, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List KCs with filters (date, truck, customer, status, search, date range)' })
  findAll(
    @CurrentFirmId() firmId: string,
    @Query('date') date?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('search') search?: string,
    @Query('truck_id') truck_id?: string,
    @Query('customer_id') customer_id?: string,
    @Query('status') status?: KCStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll(firmId, { date, date_from, date_to, search, truck_id, customer_id, status, page, limit });
  }

  /**
   * Download KC as PDF. Accepts JWT via Authorization header OR ?token= query param
   * (query param is used for direct browser/Linking.openURL downloads from mobile).
   */
  @Get(':id/pdf')
  @Public()
  @ApiOperation({ summary: 'Download authorized KC as PDF' })
  async downloadPdf(
    @Param('id') id: string,
    @Query('token') queryToken: string | undefined,
    @Headers('authorization') authHeader: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    // Resolve JWT from header or query param
    const rawToken = queryToken ?? authHeader?.replace(/^Bearer\s+/i, '');
    if (!rawToken) throw new UnauthorizedException('Authentication required');

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(rawToken);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const pdfBuffer = await this.pdfService.generateKcPdf(id, payload.firm_id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="KC-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get KC with line items + payments' })
  findOne(@Param('id') id: string, @CurrentFirmId() firmId: string) {
    return this.service.findOne(id, firmId);
  }

  @Patch(':id/items')
  @RequirePermission(MODULE, 'update')
  @ApiOperation({ summary: 'Replace all line items on a DRAFT KC' })
  updateLineItems(
    @Param('id') id: string,
    @Body() dto: UpdateLineItemsDto,
    @CurrentFirmId() firmId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateLineItems(id, dto, firmId, user.sub);
  }

  @Post(':id/payments')
  @RequirePermission(MODULE, 'update')
  @ApiOperation({ summary: 'Add a payment record to a DRAFT KC' })
  @ApiHeader({ name: 'X-Idempotency-Key', required: true })
  addPayment(
    @Param('id') id: string,
    @Body() dto: AddPaymentDto,
    @CurrentFirmId() firmId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addPayment(id, dto, firmId, user.sub);
  }

  @Post(':id/authorize')
  @RequirePermission(MODULE, 'update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authorize KC — 9-step transactional flow' })
  authorize(
    @Param('id') id: string,
    @Body() dto: AuthorizeKCDto,
    @CurrentFirmId() firmId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.authorize(id, dto, firmId, user.sub);
  }

  @Post(':id/cancel')
  @RequirePermission(MODULE, 'delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel KC — writes reversal entries if AUTHORIZED' })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelKCDto,
    @CurrentFirmId() firmId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.cancel(id, dto, firmId, user.sub);
  }
}
