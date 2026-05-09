import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardMetrics } from './dashboard-metrics.entity';
import { SummarySheet } from './summary-sheet.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { KacchaChittha } from '../kaccha-chittha/entities/kaccha-chittha.entity';
import { Truck } from '../trucks/truck.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DashboardMetrics, SummarySheet, KacchaChittha, Truck])],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
