import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import { SalaryEntry } from './salary-entry.entity';
import { CreateSalaryEntryDto } from './dto/salary.dto';
import { LedgerEntry } from '../ledger/ledger-entry.entity';
import { Truck } from '../trucks/truck.entity';
import { LedgerType, EntryType, SourceType, FreightType } from '../../common/enums';
import { AuditService } from '../audit/audit.service';
import { EventStoreService } from '../events/event-store.service';

const FREIGHT_LABELS: Record<FreightType, string> = {
  [FreightType.SALARY]: 'Salary',
  [FreightType.INAM]: 'Inam (Driver Gift)',
  [FreightType.KIRAYA]: 'Kiraya (Travel Money)',
  [FreightType.PARCHI]: 'Parchi',
};

/** Driver freight types — recipient is a truck driver, not a firm employee. */
const DRIVER_FREIGHT_TYPES = new Set([FreightType.INAM, FreightType.KIRAYA, FreightType.PARCHI]);

@Injectable()
export class SalaryService {
  private readonly logger = new Logger(SalaryService.name);

  constructor(
    @InjectRepository(SalaryEntry)
    private readonly salaryRepo: Repository<SalaryEntry>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(Truck)
    private readonly truckRepo: Repository<Truck>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly eventStore: EventStoreService,
  ) {}

  async create(dto: CreateSalaryEntryDto, firmId: string, createdBy: string): Promise<SalaryEntry> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    const freightType = dto.freight_type ?? FreightType.SALARY;
    const freightLabel = FREIGHT_LABELS[freightType];
    const isDriverType = DRIVER_FREIGHT_TYPES.has(freightType);

    try {
      await qr.query(`SET LOCAL app.current_firm_id = '${firmId}'`);

      // Resolve recipient info
      let recipientUserId: string | null = null;
      let recipientTruckId: string | null = null;
      let recipientDriverName: string | null = null;
      let recipientDriverPhone: string | null = null;
      let description: string;

      if (isDriverType) {
        if (!dto.truck_id) throw new BadRequestException(`truck_id is required for freight type ${freightType}`);
        const truck = await qr.manager.findOne(Truck, { where: { id: dto.truck_id, firm_id: firmId } });
        if (!truck) throw new NotFoundException(`Truck ${dto.truck_id} not found`);
        recipientTruckId = truck.id;
        recipientDriverName = truck.driver_name;
        recipientDriverPhone = truck.driver_phone ?? null;
        description = dto.notes ?? `${freightLabel} paid to driver ${truck.driver_name} (${truck.truck_number})`;
      } else {
        if (!dto.user_id) throw new BadRequestException('user_id is required for SALARY freight type');
        recipientUserId = dto.user_id;
        description = dto.notes ?? `${freightLabel} paid to user ${dto.user_id}`;
      }

      const salaryId = uuidv4();
      const groupId = uuidv4();
      const recipientKey = isDriverType ? dto.truck_id : dto.user_id;
      const idempotencyBase = `freight-${firmId}-${recipientKey}-${dto.salary_date}-${dto.amount}-${freightType}`;

      // FIRM_CASH DEBIT — money leaving firm
      const firmCashDebit = qr.manager.create(LedgerEntry, {
        firm_id: firmId,
        ledger_type: LedgerType.FIRM_CASH,
        entry_type: EntryType.DEBIT,
        amount: new Decimal(dto.amount).toFixed(2),
        balance_after: '0.00',
        source_type: SourceType.SALARY_PAID,
        source_id: salaryId,
        entry_group_id: groupId,
        description,
        idempotency_key: `${idempotencyBase}-firm-debit`,
        created_by: createdBy,
        user_id: recipientUserId,
      });

      // USER_SALARY CREDIT — marks freight as paid
      const salaryCredit = qr.manager.create(LedgerEntry, {
        firm_id: firmId,
        ledger_type: LedgerType.USER_SALARY,
        entry_type: EntryType.CREDIT,
        amount: new Decimal(dto.amount).toFixed(2),
        balance_after: '0.00',
        source_type: SourceType.SALARY_PAID,
        source_id: salaryId,
        entry_group_id: groupId,
        description,
        idempotency_key: `${idempotencyBase}-salary-credit`,
        created_by: createdBy,
        user_id: recipientUserId,
      });

      await qr.manager.save(LedgerEntry, [firmCashDebit, salaryCredit]);

      const entry = qr.manager.create(SalaryEntry, {
        id: salaryId,
        firm_id: firmId,
        user_id: recipientUserId,
        truck_id: recipientTruckId,
        driver_name: recipientDriverName,
        driver_phone: recipientDriverPhone,
        salary_date: dto.salary_date,
        amount: new Decimal(dto.amount).toFixed(2),
        notes: dto.notes ?? null,
        freight_type: freightType,
        created_by: createdBy,
        idempotency_key: idempotencyBase,
      });
      const saved = await qr.manager.save(SalaryEntry, entry);

      await qr.commitTransaction();

      await this.eventStore.publish({
        event_type: 'FREIGHT_PAID',
        aggregate_type: 'SALARY',
        firm_id: firmId,
        aggregate_id: saved.id,
        payload: {
          user_id: recipientUserId,
          truck_id: recipientTruckId,
          driver_name: recipientDriverName,
          amount: dto.amount,
          salary_date: dto.salary_date,
          freight_type: freightType,
        },
      });

      this.logger.log(`Freight [${freightType}] ${saved.id} paid to ${isDriverType ? `driver ${recipientDriverName}` : `user ${recipientUserId}`}`);
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
    filters: { user_id?: string; truck_id?: string; freight_type?: FreightType; from?: string; to?: string; page?: number; limit?: number },
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
    if (filters.truck_id) qb.andWhere('se.truck_id = :tid', { tid: filters.truck_id });
    if (filters.freight_type) qb.andWhere('se.freight_type = :ft', { ft: filters.freight_type });
    if (filters.from) qb.andWhere('se.salary_date >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('se.salary_date <= :to', { to: filters.to });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  /** Update notes on a freight entry (amount is immutable — tied to ledger). */
  async update(id: string, notes: string, firmId: string): Promise<SalaryEntry> {
    const entry = await this.salaryRepo.findOne({ where: { id, firm_id: firmId } });
    if (!entry) throw new NotFoundException(`Freight entry ${id} not found`);
    entry.notes = notes;
    return this.salaryRepo.save(entry);
  }

  /** Delete a freight entry — writes reversal ledger entries to maintain audit trail. */
  async delete(id: string, firmId: string, deletedBy: string): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      await qr.query(`SET LOCAL app.current_firm_id = '${firmId}'`);

      const entry = await qr.manager.findOne(SalaryEntry, { where: { id, firm_id: firmId } });
      if (!entry) throw new NotFoundException(`Freight entry ${id} not found`);

      const freightLabel = FREIGHT_LABELS[(entry.freight_type as FreightType) ?? FreightType.SALARY];
      const groupId = uuidv4();
      const reversalBase = `freight-reversal-${id}`;
      const reversalDesc = `Reversal of ${freightLabel} entry ${id}`;

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
        description: reversalDesc,
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
        description: reversalDesc,
        idempotency_key: `${reversalBase}-salary-debit`,
        created_by: deletedBy,
        user_id: entry.user_id,
      });

      await qr.manager.save(LedgerEntry, [firmCashCredit, salaryDebit]);
      await qr.manager.delete(SalaryEntry, { id, firm_id: firmId });
      await qr.commitTransaction();

      this.logger.log(`Freight entry ${id} deleted with reversals by ${deletedBy}`);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}
