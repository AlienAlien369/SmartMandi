import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfiguratorService } from './configurator.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentFirmId } from '../../common/decorators/current-user.decorator';

@ApiTags('config')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('config')
export class ConfiguratorController {
  constructor(private readonly configuratorService: ConfiguratorService) {}

  @Get('grades')
  @ApiOperation({ summary: 'List active grade configs for the firm' })
  getGrades(@CurrentFirmId() firmId: string) {
    return this.configuratorService.getActiveGrades(firmId);
  }

  @Get('payment-modes')
  @ApiOperation({ summary: 'List active payment modes for the firm' })
  getPaymentModes(@CurrentFirmId() firmId: string) {
    return this.configuratorService.getActivePaymentModes(firmId);
  }

  @Get('baardana')
  @ApiOperation({ summary: 'Get current baardana config for the firm (pre-fills KC line item defaults)' })
  getBaardanaConfig(@CurrentFirmId() firmId: string) {
    return this.configuratorService.getBaardanaConfigForFirm(firmId).then(cfg =>
      cfg ?? { baardana_provider: 'FIRM', default_bags: 1, cost_per_unit: null, unit_label: 'bag' },
    );
  }

  @Get('version')
  @ApiOperation({ summary: 'Get the current active config version' })
  getActiveVersion(@CurrentFirmId() firmId: string) {
    return this.configuratorService.getActiveConfigVersion(firmId);
  }
}
