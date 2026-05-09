import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KacchaChittha } from './entities/kaccha-chittha.entity';
import { KcLineItem } from './entities/kc-line-item.entity';
import { KcPayment } from './entities/kc-payment.entity';
import { KacchaChitthaService } from './kaccha-chittha.service';
import { KacchaChitthaController } from './kaccha-chittha.controller';
import { CommissionCalculatorService } from './commission-calculator.service';
import { ApmcFeeCalculatorService } from './apmc-fee-calculator.service';
import { ConfiguratorModule } from '../config/configurator.module';
import { LedgerModule } from '../ledger/ledger.module';
import { EventStoreModule } from '../events/event-store.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KacchaChittha, KcLineItem, KcPayment]),
    ConfiguratorModule,
    LedgerModule,
    EventStoreModule,
    AuditModule,
    NotificationModule,
  ],
  controllers: [KacchaChitthaController],
  providers: [KacchaChitthaService, CommissionCalculatorService, ApmcFeeCalculatorService],
  exports: [KacchaChitthaService],
})
export class KacchaChitthaModule {}
