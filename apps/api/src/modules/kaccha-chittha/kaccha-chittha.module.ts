import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KacchaChittha } from './entities/kaccha-chittha.entity';
import { KcLineItem } from './entities/kc-line-item.entity';
import { KcPayment } from './entities/kc-payment.entity';
import { FirmPdfConfig } from './entities/firm-pdf-config.entity';
import { KacchaChitthaService } from './kaccha-chittha.service';
import { KcPdfService } from './kc-pdf.service';
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
    TypeOrmModule.forFeature([KacchaChittha, KcLineItem, KcPayment, FirmPdfConfig]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    ConfiguratorModule,
    LedgerModule,
    EventStoreModule,
    AuditModule,
    NotificationModule,
  ],
  controllers: [KacchaChitthaController],
  providers: [KacchaChitthaService, KcPdfService, CommissionCalculatorService, ApmcFeeCalculatorService],
  exports: [KacchaChitthaService],
})
export class KacchaChitthaModule {}
