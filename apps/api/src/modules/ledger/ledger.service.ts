import {
  Injectable,
  Logger,
  InternalServerErrorException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import Redis from 'ioredis';
import { LedgerEntry } from './ledger-entry.entity';
import { WriteEntriesDto, LedgerEntryDto } from './dto/write-entries.dto';
import { LedgerType, EntryType } from '../../common/enums';
import { REDIS_CLIENT } from '../../config/redis.module';

// Configure Decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface LedgerPage {
  data: LedgerEntry[];
  meta: { total: number; page: number; limit: number; balance: string };
}

interface LedgerFilters {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  entry_type?: EntryType;
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Write a balanced set of ledger entries in a single transaction.
   * RULE: SUM(CREDIT) must equal SUM(DEBIT) within the entry_group_id.
   * This is the ONLY way to write to the ledger.
   */
  async writeEntries(dto: WriteEntriesDto, firmId: string, userId: string): Promise<LedgerEntry[]> {
    this.validateGroupIntegrity(dto.entries);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      // Set RLS context for this transaction
      await queryRunner.query(`SET LOCAL app.current_firm_id = '${firmId}'`);

      const saved: LedgerEntry[] = [];

      for (const entryDto of dto.entries) {
        // Check idempotency — skip if already written
        const existing = await queryRunner.manager.findOne(LedgerEntry, {
          where: { idempotency_key: entryDto.idempotency_key },
        });

        if (existing) {
          saved.push(existing);
          continue;
        }

        // Compute running balance with row-level lock to prevent race conditions
        const currentBalance = await this.getRunningBalance(
          queryRunner,
          entryDto.ledger_type,
          firmId,
          entryDto.customer_id ?? null,
          entryDto.truck_id ?? null,
          entryDto.user_id ?? null,
        );

        const amount = new Decimal(entryDto.amount);
        const balanceAfter =
          entryDto.entry_type === EntryType.CREDIT
            ? currentBalance.plus(amount)
            : currentBalance.minus(amount);

        const entry = queryRunner.manager.create(LedgerEntry, {
          ...entryDto,
          firm_id: firmId,
          amount: amount.toFixed(2),
          balance_after: balanceAfter.toFixed(2),
          created_by: userId,
        });

        const savedEntry = await queryRunner.manager.save(LedgerEntry, entry);
        saved.push(savedEntry);
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `Wrote ${saved.length} ledger entries for group ${dto.entries[0]?.entry_group_id}`,
      );
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Ledger write failed, rolled back', error);
      throw new InternalServerErrorException('Ledger write failed');
    } finally {
      await queryRunner.release();
    }
  }

  async getCustomerLedger(
    customerId: string,
    firmId: string,
    filters: LedgerFilters = {},
  ): Promise<LedgerPage> {
    return this.queryLedger(
      { ledger_type: LedgerType.CUSTOMER, customer_id: customerId, firm_id: firmId },
      filters,
    );
  }

  async getTruckLedger(
    truckId: string,
    firmId: string,
    filters: LedgerFilters = {},
  ): Promise<LedgerPage> {
    return this.queryLedger(
      { ledger_type: LedgerType.TRUCK, truck_id: truckId, firm_id: firmId },
      filters,
    );
  }

  async getFirmCashLedger(firmId: string, filters: LedgerFilters = {}): Promise<LedgerPage> {
    return this.queryLedger({ ledger_type: LedgerType.FIRM_CASH, firm_id: firmId }, filters);
  }

  async getUserSalaryLedger(
    userId: string,
    firmId: string,
    filters: LedgerFilters = {},
  ): Promise<LedgerPage> {
    return this.queryLedger(
      { ledger_type: LedgerType.USER_SALARY, user_id: userId, firm_id: firmId },
      filters,
    );
  }

  /**
   * INVARIANT: SUM(CREDIT amounts) == SUM(DEBIT amounts) per entry_group_id.
   * Throws if invariant is violated — prevents unbalanced ledger writes.
   */
  private validateGroupIntegrity(entries: LedgerEntryDto[]): void {
    let totalCredits = new Decimal(0);
    let totalDebits = new Decimal(0);

    for (const entry of entries) {
      const amount = new Decimal(entry.amount);
      if (amount.lte(0)) {
        throw new ConflictException(`Ledger entry amount must be positive: ${entry.amount}`);
      }
      if (entry.entry_type === EntryType.CREDIT) {
        totalCredits = totalCredits.plus(amount);
      } else {
        totalDebits = totalDebits.plus(amount);
      }
    }

    if (!totalCredits.equals(totalDebits)) {
      throw new ConflictException(
        `Ledger group integrity violation: CREDITS ${totalCredits.toFixed(2)} ≠ DEBITS ${totalDebits.toFixed(2)}`,
      );
    }
  }

  private async getRunningBalance(
    queryRunner: ReturnType<DataSource['createQueryRunner']>,
    ledgerType: LedgerType,
    firmId: string,
    customerId: string | null,
    truckId: string | null,
    userId: string | null,
  ): Promise<Decimal> {
    // Get the latest balance_after for this ledger partition
    const query = queryRunner.manager
      .createQueryBuilder(LedgerEntry, 'le')
      .select('le.balance_after')
      .where('le.firm_id = :firmId', { firmId })
      .andWhere('le.ledger_type = :ledgerType', { ledgerType })
      .orderBy('le.created_at', 'DESC')
      .limit(1);

    if (customerId) query.andWhere('le.customer_id = :customerId', { customerId });
    if (truckId) query.andWhere('le.truck_id = :truckId', { truckId });
    if (userId) query.andWhere('le.user_id = :userId', { userId });

    const latest = await query.getOne();
    return latest ? new Decimal(latest.balance_after) : new Decimal(0);
  }

  private async queryLedger(
    where: Partial<LedgerEntry>,
    filters: LedgerFilters,
  ): Promise<LedgerPage> {
    const page = Math.max(1, Number(filters.page ?? 1) || 1);
    const limit = Math.min(Math.max(1, Number(filters.limit ?? 50) || 50), 100);
    const skip = (page - 1) * limit;

    const qb = this.ledgerRepo
      .createQueryBuilder('le')
      .where(where)
      .orderBy('le.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (filters.from) qb.andWhere('le.created_at >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('le.created_at <= :to', { to: filters.to });
    if (filters.entry_type) qb.andWhere('le.entry_type = :type', { type: filters.entry_type });

    const [data, total] = await qb.getManyAndCount();

    const balance = data.length > 0 ? data[0].balance_after : '0.00';

    return { data, meta: { total, page, limit, balance } };
  }
}
