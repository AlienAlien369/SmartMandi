import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { LedgerEntry } from '../ledger/ledger-entry.entity';
import { KacchaChittha } from '../kaccha-chittha/entities/kaccha-chittha.entity';
import { Truck } from '../trucks/truck.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerEntry, KacchaChittha, Truck])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
