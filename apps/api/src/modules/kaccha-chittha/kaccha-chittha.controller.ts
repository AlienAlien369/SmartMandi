import {
  Controller, Get, Post, Patch, Body, Param,
  Query, UseGuards, HttpCode, HttpStatus, Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { KacchaChitthaService } from './kaccha-chittha.service';
import {
  CreateKCDto, AddPaymentDto, AuthorizeKCDto,
  CancelKCDto, UpdateLineItemsDto,
} from './dto/kc.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentFirmId } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserRole, KCStatus } from '../../common/enums';

@ApiTags('kaccha-chittha')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kcs')
export class KacchaChitthaController {
  constructor(private readonly service: KacchaChitthaService) {}

  @Post()
  @Roles(UserRole.FIRM_HEAD, UserRole.AUTHORIZER, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Create a new Kaccha Chittha (DRAFT)' })
  @ApiHeader({ name: 'X-Idempotency-Key', required: true })
  create(@Body() dto: CreateKCDto, @CurrentFirmId() firmId: string, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, firmId, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List KCs with filters (date, truck, customer, status)' })
  findAll(
    @CurrentFirmId() firmId: string,
    @Query('date') date?: string,
    @Query('truck_id') truck_id?: string,
    @Query('customer_id') customer_id?: string,
    @Query('status') status?: KCStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll(firmId, { date, truck_id, customer_id, status, page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get KC with line items + payments' })
  findOne(@Param('id') id: string, @CurrentFirmId() firmId: string) {
    return this.service.findOne(id, firmId);
  }

  @Patch(':id/items')
  @Roles(UserRole.FIRM_HEAD, UserRole.AUTHORIZER, UserRole.OPERATOR)
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
  @Roles(UserRole.FIRM_HEAD, UserRole.AUTHORIZER, UserRole.OPERATOR)
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
  @Roles(UserRole.FIRM_HEAD, UserRole.AUTHORIZER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authorize KC — 9-step transactional flow',
    description: 'Computes totals, writes ledger entries, publishes event. AUTHORIZER role required.',
  })
  authorize(
    @Param('id') id: string,
    @Body() dto: AuthorizeKCDto,
    @CurrentFirmId() firmId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.authorize(id, dto, firmId, user.sub);
  }

  @Post(':id/cancel')
  @Roles(UserRole.FIRM_HEAD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel KC (Firm Head only) — writes reversal entries if AUTHORIZED',
  })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelKCDto,
    @CurrentFirmId() firmId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.cancel(id, dto, firmId, user.sub);
  }
}
