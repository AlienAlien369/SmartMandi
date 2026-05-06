import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentFirmId } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';

@ApiTags('ledger')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('firm')
  @Roles(UserRole.FIRM_HEAD, UserRole.AUTHORIZER)
  @ApiOperation({ summary: 'Firm cash ledger' })
  getFirmCashLedger(
    @CurrentFirmId() firmId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ledgerService.getFirmCashLedger(firmId, { from, to, page, limit });
  }

  @Get('customer/:customerId')
  @Roles(UserRole.FIRM_HEAD, UserRole.AUTHORIZER)
  @ApiOperation({ summary: 'Customer ledger — shows all KCs, payments, Udhar' })
  getCustomerLedger(
    @Param('customerId') customerId: string,
    @CurrentFirmId() firmId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
  ) {
    return this.ledgerService.getCustomerLedger(customerId, firmId, { from, to, page });
  }

  @Get('truck/:truckId')
  @Roles(UserRole.FIRM_HEAD, UserRole.AUTHORIZER)
  @ApiOperation({ summary: 'Truck ledger — purchase entry, inam, weight variance' })
  getTruckLedger(
    @Param('truckId') truckId: string,
    @CurrentFirmId() firmId: string,
  ) {
    return this.ledgerService.getTruckLedger(truckId, firmId);
  }

  @Get('salary/:userId')
  @Roles(UserRole.FIRM_HEAD)
  @ApiOperation({ summary: 'User salary ledger' })
  getUserSalaryLedger(
    @Param('userId') userId: string,
    @CurrentFirmId() firmId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ledgerService.getUserSalaryLedger(userId, firmId, { from, to });
  }
}
