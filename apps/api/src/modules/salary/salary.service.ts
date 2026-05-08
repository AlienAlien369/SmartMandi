import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import { SalaryEntry } from './salary-entry.entity';
import { CreateSalaryEntryDto } from './dto/salary.dto';
import { LedgerEntry } from '../ledger/ledger-entry.entity';
import { LedgerType, EntryType, SourceType, AuditAction, EntityType } from '../../common/enums';
import { AuditService } from '../audit/audit.service';
import { EventStoreService } from '../events/event-store.service';

@Injectable()
export class SalaryService {
  private readonly logger = new Logger(SalaryService.name);

  constructor(
    @InjectRepository(SalaryEntry)
    private readonly salaryRepo: Repository<SalaryEntry>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly eventStore: EventStoreService,
  ) {}

  async create(dto: CreateSalaryEntryDto, firmId: string, createdBy: string): Promise<SalaryEntry> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      await qr.query(`SET LOCAL app.current_firm_id = '${firmId}'`);

      const salaryId = uuidv4();
      const groupId = uuidv4();
      const idempotencyBase = `salary-${firmId}-${dto.user_id}-${dto.salary_date}-${dto.amount}`;

      // Write salary ledger entry (USER_SALARY CREDIT + FIRM_CASH DEBIT)
      // FIRM_CASH DEBIT — money leaving firm
      const firmCashDebit = qr.manager.create(LedgerEntry, {
        firm_id: firmId,
        ledger_type: LedgerType.FIRM_CASH,
        entry_type: EntryType.DEBIT,
        amount: new Decimal(dto.amount).toFixed(2),
        balance_after: '0.00', // Will be set by ledger service in production
        source_type: SourceType.SALARY_PAID,
        source_id: salaryId,
        entry_group_id: groupId,
        description: `Salary paid to user ${dto.user_id}`,
        idempotency_key: `${idempotencyBase}-firm-debit`,
        created_by: createdBy,
        user_id: dto.user_id,
      });

      // USER_SALARY CREDIT — marks salary as paid
      const salaryCredit = qr.manager.create(LedgerEntry, {
        firm_id: firmId,
        ledger_type: LedgerType.USER_SALARY,
        entry_type: EntryType.CREDIT,
        amount: new Decimal(dto.amount).toFixed(2),
        balance_after: '0.00',
        source_type: SourceType.SALARY_PAID,
        source_id: salaryId,
        entry_group_id: groupId,
        description: dto.notes ?? `Salary payment`,
        idempotency_key: `${idempotencyBase}-salary-credit`,
        created_by: createdBy,
        user_id: dto.user_id,
      });

      await qr.manager.save(LedgerEntry, [firmCashDebit, salaryCredit]);

      const entry = qr.manager.create(SalaryEntry, {
        ...dto,
        id: salaryId,
        firm_id: firmId,
        created_by: createdBy,
        idempotency_key: idempotencyBase,
      });
      const saved = await qr.manager.save(SalaryEntry, entry);

      await qr.commitTransaction();

      await this.eventStore.publish({
        event_type: 'SALARY_PAID',
        aggregate_type: 'SALARY',
        firm_id: firmId,
        aggregate_id: saved.id,
        payload: { user_id: dto.user_id, amount: dto.amount, salary_date: dto.salary_date },
      });

      this.logger.log(`Salary ${saved.id} paid to user ${dto.user_id}`);
      return saved;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async findAll(
    firmId: string,
    filters: { user_id?: string; from?: string; to?: string; page?: number; limit?: number },
  ): Promise<{ data: SalaryEntry[]; meta: object }> {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));

    const qb = this.salaryRepo
      .createQueryBuilder('se')
      .where('se.firm_id = :firmId', { firmId })
      .orderBy('se.salary_date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.user_id) qb.andWhere('se.user_id = :uid', { uid: filters.user_id });
    if (filters.from) qb.andWhere('se.salary_date >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('se.salary_date <= :to', { to: filters.to });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  /** Update notes on a salary entry (amount is immutable — tied to ledger). */
  async update(id: string, notes: string, firmId: string): Promise<SalaryEntry> {
    const entry = await this.salaryRepo.findOne({ where: { id, firm_id: firmId } });
    if (!entry) throw new NotFoundException(`Salary entry ${id} not found`);
    entry.notes = notes;
    return this.salaryRepo.save(entry);
  }

  /** Delete a salary entry — writes reversal ledger entries to maintain audit trail. */
  async delete(id: string, firmId: string, deletedBy: string): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      await qr.query(`SET LOCAL app.current_firm_id = '${firmId}'`);

      const entry = await qr.manager.findOne(SalaryEntry, { where: { id, firm_id: firmId } });
      if (!entry) throw new NotFoundException(`Salary entry ${id} not found`);

      const groupId = uuidv4();
      const reversalBase = `salary-reversal-${id}`;

      // Reversal: FIRM_CASH CREDIT (reverses the debit)
      const firmCashCredit = qr.manager.create(LedgerEntry, {
        firm_id: firmId,
        ledger_type: LedgerType.FIRM_CASH,
        entry_type: EntryType.CREDIT,
        amount: entry.amount,
        balance_after: '0.00',
        source_type: SourceType.REVERSAL,
        source_id: id,
        entry_group_id: groupId,
        description: `Reversal of salary entry ${id}`,
        idempotency_key: `${reversalBase}-firm-credit`,
        created_by: deletedBy,
        user_id: entry.user_id,
      });

      // Reversal: USER_SALARY DEBIT (reverses the credit)
      const salaryDebit = qr.manager.create(LedgerEntry, {
        firm_id: firmId,
        ledger_type: LedgerType.USER_SALARY,
        entry_type: EntryType.DEBIT,
        amount: entry.amount,
        balance_after: '0.00',
        source_type: SourceType.REVERSAL,
        source_id: id,
        entry_group_id: groupId,
        description: `Reversal of salary entry ${id}`,
        idempotency_key: `${reversalBase}-salary-debit`,
        created_by: deletedBy,
        user_id: entry.user_id,
      });

      await qr.manager.save(LedgerEntry, [firmCashCredit, salaryDebit]);
      await qr.manager.delete(SalaryEntry, { id, firm_id: firmId });
      await qr.commitTransaction();

      this.logger.log(`Salary entry ${id} deleted with reversals by ${deletedBy}`);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}
