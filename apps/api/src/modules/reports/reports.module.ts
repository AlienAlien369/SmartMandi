import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { BuyerSummaryPdfService } from './buyer-summary-pdf.service';
import { DaybookPdfService } from './daybook-pdf.service';
import { LedgerEntry } from '../ledger/ledger-entry.entity';
import { KacchaChittha } from '../kaccha-chittha/entities/kaccha-chittha.entity';
import { Truck } from '../trucks/truck.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LedgerEntry, KacchaChittha, Truck]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({ secret: cfg.get<string>('JWT_SECRET') }),
    }),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, BuyerSummaryPdfService, DaybookPdfService],
  exports: [ReportsService],
})
export class ReportsModule {}
