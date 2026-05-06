import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryEntry } from './salary-entry.entity';
import { SalaryService } from './salary.service';
import { SalaryController } from './salary.controller';
import { LedgerEntry } from '../ledger/ledger-entry.entity';
import { EventStoreModule } from '../events/event-store.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalaryEntry, LedgerEntry]),
    EventStoreModule,
    AuditModule,
  ],
  controllers: [SalaryController],
  providers: [SalaryService],
  exports: [SalaryService],
})
export class SalaryModule {}
