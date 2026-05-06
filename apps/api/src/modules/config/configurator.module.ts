import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigVersion } from './entities/config-version.entity';
import { GradeConfig } from './entities/grade-config.entity';
import { ApmcFeeConfig } from './entities/apmc-fee-config.entity';
import { CommissionConfig } from './entities/commission-config.entity';
import { BaardanaConfig } from './entities/baardana-config.entity';
import { PaymentModeConfig } from './entities/payment-mode-config.entity';
import { ConfiguratorService } from './configurator.service';
import { ConfiguratorController } from './configurator.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConfigVersion, GradeConfig, ApmcFeeConfig,
      CommissionConfig, BaardanaConfig, PaymentModeConfig,
    ]),
  ],
  controllers: [ConfiguratorController],
  providers: [ConfiguratorService],
  exports: [ConfiguratorService],
})
export class ConfiguratorModule {}
