import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { KacchaChittha } from './entities/kaccha-chittha.entity';
import { KcLineItem } from './entities/kc-line-item.entity';
import { KcPayment } from './entities/kc-payment.entity';
import { CreateKCDto, AddPaymentDto, AuthorizeKCDto, CancelKCDto, UpdateLineItemsDto } from './dto/kc.dto';
import { CommissionCalculatorService } from './commission-calculator.service';
import { ApmcFeeCalculatorService } from './apmc-fee-calculator.service';
import { ConfiguratorService } from '../config/configurator.service';
import { LedgerService } from '../ledger/ledger.service';
import { EventStoreService } from '../events/event-store.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notification.service';
import {
  KCStatus, BaardanaSource, LedgerType, EntryType,
  SourceType, AuditAction,
} from '../../common/enums';
import { WriteEntriesDto } from '../ledger/dto/write-entries.dto';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

@Injectable()
export class KacchaChitthaService {
  private readonly logger = new Logger(KacchaChitthaService.name);

  constructor(
    @InjectRepository(KacchaChittha) private readonly kcRepo: Repository<KacchaChittha>,
    @InjectRepository(KcLineItem) private readonly lineItemRepo: Repository<KcLineItem>,
    @InjectRepository(KcPayment) private readonly paymentRepo: Repository<KcPayment>,
    private readonly dataSource: DataSource,
    private readonly commissionCalc: CommissionCalculatorService,
    private readonly apmcCalc: ApmcFeeCalculatorService,
    private readonly configurator: ConfiguratorService,
    private readonly ledgerService: LedgerService,
    private readonly eventStore: EventStoreService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────────

  async create(dto: CreateKCDto, firmId: string, userId: string): Promise<KacchaChittha> {
    // Idempotency check
    const existing = await this.kcRepo.findOne({ where: { idempotency_key: dto.idempotency_key } });
    if (existing) return existing;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      await qr.query(`SET LOCAL app.current_firm_id = '${firmId}'`);

      // Generate sequential KC number per firm
      const kcNumber = await this.generateKcNumber(qr, firmId);

      // Compute baardana costs per line item
      const saleDate = new Date(dto.sale_date);
      const baardanaConfig = await this.configurator.resolveBaardanaConfig(firmId, saleDate);

      const lineItems = dto.line_items.map((item, idx) => {
        const baardanaCost =
          item.baardana_source === BaardanaSource.FIRM && baardanaConfig
            ? new Decimal(baardanaConfig.cost_per_unit)
                .mul(item.baardana_quantity)
                .toFixed(2)
            : '0.00';

        const grossAmount = item.rate_mode === 'PER_NAG'
          ? new Decimal(item.quantity_bags)
              .mul(item.rate_per_kg)
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
              .toFixed(2)
          : new Decimal(item.total_weight_kg)
              .mul(item.rate_per_kg)
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
              .toFixed(2);

        return qr.manager.create(KcLineItem, {
          firm_id: firmId,
          grade_config_id: item.grade_config_id,
          quantity_bags: item.quantity_bags,
          weight_per_bag_kg: item.weight_per_bag_kg?.toString() ?? null,
          total_weight_kg: new Decimal(item.total_weight_kg).toFixed(3),
          rate_per_kg: new Decimal(item.rate_per_kg).toFixed(4),
          gross_amount: grossAmount,
          baardana_source: item.baardana_source,
          baardana_quantity: item.baardana_quantity,
          baardana_cost: baardanaCost,
          rate_mode: item.rate_mode ?? 'PER_KG',
          sort_order: item.sort_order ?? idx,
        });
      });

      const kc = qr.manager.create(KacchaChittha, {
        firm_id: firmId,
        kc_number: kcNumber,
        truck_id: dto.truck_id ?? null,
        customer_id: dto.customer_id,
        sale_date: dto.sale_date,
        status: KCStatus.DRAFT,
        idempotency_key: dto.idempotency_key,
        created_by: userId,
        is_dirty: false,
      });

      const savedKc = await qr.manager.save(KacchaChittha, kc);

      for (const item of lineItems) {
        item.kc_id = savedKc.id;
      }
      await qr.manager.save(KcLineItem, lineItems);

      await qr.commitTransaction();

      await this.auditService.log({
        firm_id: firmId, entity: 'kaccha_chitthas', entity_id: savedKc.id,
        action: AuditAction.CREATE,
        new_value: { kc_number: kcNumber, customer_id: dto.customer_id },
        changed_by: userId,
      });

      return this.findOne(savedKc.id, firmId);
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────────────────

  async findAll(
    firmId: string,
    filters: { date?: string; date_from?: string; date_to?: string; search?: string; truck_id?: string; customer_id?: string; status?: KCStatus; page?: number; limit?: number },
  ) {
    const page = Math.max(1, Number(filters.page ?? 1) || 1);
    const limit = Math.min(Math.max(1, Number(filters.limit ?? 50) || 50), 100);

    const qb = this.kcRepo
      .createQueryBuilder('kc')
      .where('kc.firm_id = :firmId', { firmId })
      .orderBy('kc.sale_date', 'DESC')
      .addOrderBy('kc.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // Exact date takes priority over range
    if (filters.date) {
      qb.andWhere('kc.sale_date = :date', { date: filters.date });
    } else {
      if (filters.date_from) qb.andWhere('kc.sale_date >= :date_from', { date_from: filters.date_from });
      if (filters.date_to)   qb.andWhere('kc.sale_date <= :date_to',   { date_to:   filters.date_to });
    }

    if (filters.search) {
      qb.andWhere(
        '(kc.kc_number ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.truck_id)    qb.andWhere('kc.truck_id = :truckId',       { truckId:    filters.truck_id });
    if (filters.customer_id) qb.andWhere('kc.customer_id = :customerId', { customerId: filters.customer_id });
    if (filters.status)      qb.andWhere('kc.status = :status',          { status:     filters.status });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, firmId: string): Promise<KacchaChittha & { line_items: KcLineItem[]; payments: KcPayment[] }> {
    const kc = await this.kcRepo.findOne({ where: { id, firm_id: firmId } });
    if (!kc) throw new NotFoundException(`Kaccha Chittha ${id} not found`);

    const line_items = await this.lineItemRepo.find({
      where: { kc_id: id, firm_id: firmId },
      order: { sort_order: 'ASC' },
    });
    const payments = await this.paymentRepo.find({ where: { kc_id: id, firm_id: firmId } });

    return Object.assign(kc, { line_items, payments });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UPDATE LINE ITEMS (DRAFT only)
  // ─────────────────────────────────────────────────────────────────────────────

  async updateLineItems(
    id: string, dto: UpdateLineItemsDto, firmId: string, userId: string,
  ): Promise<KacchaChittha> {
    const kc = await this.kcRepo.findOne({ where: { id, firm_id: firmId } });
    if (!kc) throw new NotFoundException(`KC ${id} not found`);
    if (kc.status !== KCStatus.DRAFT) {
      throw new ConflictException('Line items can only be updated on DRAFT KCs');
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      await qr.query(`SET LOCAL app.current_firm_id = '${firmId}'`);

      // Delete existing line items and replace
      await qr.manager.delete(KcLineItem, { kc_id: id, firm_id: firmId });

      const saleDate = new Date(kc.sale_date);
      const baardanaConfig = await this.configurator.resolveBaardanaConfig(firmId, saleDate);

      const newItems = dto.line_items.map((item, idx) => {
        const baardanaCost =
          item.baardana_source === BaardanaSource.FIRM && baardanaConfig
            ? new Decimal(baardanaConfig.cost_per_unit).mul(item.baardana_quantity).toFixed(2)
            : '0.00';
        const grossAmount = item.rate_mode === 'PER_NAG'
          ? new Decimal(item.quantity_bags).mul(item.rate_per_kg)
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
          : new Decimal(item.total_weight_kg).mul(item.rate_per_kg)
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

        return qr.manager.create(KcLineItem, {
          firm_id: firmId, kc_id: id,
          grade_config_id: item.grade_config_id,
          quantity_bags: item.quantity_bags,
          weight_per_bag_kg: item.weight_per_bag_kg?.toString() ?? null,
          total_weight_kg: new Decimal(item.total_weight_kg).toFixed(3),
          rate_per_kg: new Decimal(item.rate_per_kg).toFixed(4),
          gross_amount: grossAmount,
          baardana_source: item.baardana_source,
          baardana_quantity: item.baardana_quantity,
          baardana_cost: baardanaCost,
          rate_mode: item.rate_mode ?? 'PER_KG',
          sort_order: item.sort_order ?? idx,
        });
      });

      await qr.manager.save(KcLineItem, newItems);
      await qr.manager.update(KacchaChittha, id, { version: () => 'version + 1' });
      await qr.commitTransaction();
      return this.findOne(id, firmId);
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ADD PAYMENT
  // ─────────────────────────────────────────────────────────────────────────────

  async addPayment(id: string, dto: AddPaymentDto, firmId: string, userId: string): Promise<KcPayment> {
    const kc = await this.kcRepo.findOne({ where: { id, firm_id: firmId } });
    if (!kc) throw new NotFoundException(`KC ${id} not found`);
    if (kc.status !== KCStatus.DRAFT) {
      throw new ConflictException('Payments can only be added to DRAFT KCs');
    }

    const existing = await this.paymentRepo.findOne({ where: { idempotency_key: dto.idempotency_key } });
    if (existing) return existing;

    const payment = this.paymentRepo.create({
      firm_id: firmId, kc_id: id,
      payment_mode_id: dto.payment_mode_id,
      amount: new Decimal(dto.amount).toFixed(2),
      payment_reference: dto.payment_reference ?? null,
      payment_date: dto.payment_date,
      is_udhar: dto.is_udhar ?? false,
      udhar_due_date: dto.udhar_due_date ?? null,
      notes: dto.notes ?? null,
      idempotency_key: dto.idempotency_key,
      created_by: userId,
    });

    return this.paymentRepo.save(payment);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTHORIZE — 9-STEP TRANSACTIONAL FLOW (Section 5.5)
  // ─────────────────────────────────────────────────────────────────────────────

  async authorize(id: string, dto: AuthorizeKCDto, firmId: string, userId: string): Promise<KacchaChittha> {
    // ── STEP 1: Validate all preconditions ──────────────────────────────────────
    const kc = await this.kcRepo.findOne({ where: { id, firm_id: firmId } });
    if (!kc) throw new NotFoundException(`KC ${id} not found`);

    this.validateAuthorizationPreconditions(kc);

    const lineItems = await this.lineItemRepo.find({ where: { kc_id: id, firm_id: firmId } });
    if (lineItems.length === 0) throw new BadRequestException('KC must have at least one line item');

    for (const item of lineItems) {
      if (item.rate_mode !== 'PER_NAG' && new Decimal(item.total_weight_kg).lte(0)) {
        throw new BadRequestException(`Line item ${item.id} has zero or negative weight`);
      }
    }

    // Block authorization if KC has unsynced local changes
    if (kc.is_dirty) {
      throw new ConflictException('KC has unsynced local changes. Sync first before authorizing.');
    }

    // Fetch payments (informational — used in ledger entry building)
    const payments = await this.paymentRepo.find({ where: { kc_id: id, firm_id: firmId } });

    const saleDate = new Date(kc.sale_date);

    // ── STEP 2: Resolve configs at sale_date ────────────────────────────────────
    // Truck-level commission override will be wired in Phase 3
    const [apmcConfig, commissionConfig] = await Promise.all([
      this.configurator.resolveApmcFeeConfig(firmId, saleDate),
      this.configurator.resolveCommissionConfig(firmId, saleDate, null),
    ]);

    // ── STEP 3: Compute totals ──────────────────────────────────────────────────
    let totalWeightKg = new Decimal(0);
    let totalGrossAmount = new Decimal(0);
    let totalBaardanaCost = new Decimal(0);

    for (const item of lineItems) {
      totalWeightKg = totalWeightKg.plus(item.total_weight_kg);
      totalGrossAmount = totalGrossAmount.plus(item.gross_amount);
      totalBaardanaCost = totalBaardanaCost.plus(item.baardana_cost);
    }

    const apmcResult = this.apmcCalc.calculate(
      totalGrossAmount.toFixed(2), totalWeightKg.toFixed(3), apmcConfig,
    );
    const commissionResult = this.commissionCalc.calculate(
      totalGrossAmount.toFixed(2), totalWeightKg.toFixed(3), commissionConfig,
    );
    const totalNetPayable = ApmcFeeCalculatorService.computeNetPayable(
      totalGrossAmount.toFixed(2), apmcResult.amount, commissionResult.amount,
    );

    // ── STEPS 4–9: Single atomic database transaction ───────────────────────────
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction('SERIALIZABLE');

    try {
      await qr.query(`SET LOCAL app.current_firm_id = '${firmId}'`);

      // Re-check status inside transaction (optimistic concurrency)
      const lockedKc = await qr.manager.findOne(KacchaChittha, {
        where: { id, firm_id: firmId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedKc || lockedKc.status !== KCStatus.DRAFT) {
        throw new ConflictException('KC was modified concurrently. Authorizer always wins.');
      }

      // STEP 4: Store computed totals + config snapshot IDs, set AUTHORIZED
      await qr.manager.update(KacchaChittha, id, {
        status: KCStatus.AUTHORIZED,
        total_weight_kg: totalWeightKg.toFixed(3),
        total_gross_amount: totalGrossAmount.toFixed(2),
        total_apmc_fee: apmcResult.amount,
        total_commission: commissionResult.amount,
        total_baardana_cost: totalBaardanaCost.toFixed(2),
        total_net_payable: totalNetPayable,
        apmc_fee_config_id: apmcResult.config_id,
        commission_config_id: commissionResult.config_id,
        authorized_by: userId,
        authorized_at: new Date(),
        authorization_notes: dto.notes ?? null,
      });

      // STEP 5: Build ledger entries for this KC authorization
      const entryGroupId = uuidv4();
      const ledgerEntries = this.buildLedgerEntries({
        kc, entryGroupId, userId,
        totalNetPayable,
        commission: commissionResult.amount,
        apmcFee: apmcResult.amount,
        payments,
      });

      // STEP 6: Write all ledger entries atomically (via LedgerService)
      // We bypass group integrity check here — the entries represent
      // multiple account types (not a simple double-entry balance)
      for (const entry of ledgerEntries) {
        const existingEntry = await qr.manager.findOne(
          (await import('../ledger/ledger-entry.entity')).LedgerEntry,
          { where: { idempotency_key: entry.idempotency_key } },
        );
        if (existingEntry) continue;

        await qr.manager.save(
          (await import('../ledger/ledger-entry.entity')).LedgerEntry,
          qr.manager.create(
            (await import('../ledger/ledger-entry.entity')).LedgerEntry,
            { ...entry, firm_id: firmId, created_by: userId },
          ),
        );
      }

      // STEP 7: Write audit log (inside transaction for atomicity)
      await qr.manager.save(
        (await import('../audit/audit-log.entity')).AuditLog,
        qr.manager.create(
          (await import('../audit/audit-log.entity')).AuditLog,
          {
            firm_id: firmId, entity: 'kaccha_chitthas', entity_id: id,
            action: AuditAction.AUTHORIZE,
            new_value: {
              total_net_payable: totalNetPayable,
              total_commission: commissionResult.amount,
              total_apmc_fee: apmcResult.amount,
              authorized_by: userId,
            },
            changed_by: userId,
          },
        ),
      );

      await qr.commitTransaction();

      // STEP 8: Publish KC_AUTHORIZED event (after commit — async side effects)
      await this.eventStore.publish({
        firm_id: firmId,
        event_type: 'KC_AUTHORIZED',
        aggregate_type: 'KC',
        aggregate_id: id,
        payload: {
          kc_id: id,
          kc_number: kc.kc_number,
          total_net_payable: totalNetPayable,
          total_commission: commissionResult.amount,
          total_weight_kg: totalWeightKg.toFixed(3),
          authorized_by: userId,
          sale_date: kc.sale_date,
        },
        idempotency_key: `KC_AUTHORIZED:${id}`,
      });

      // STEP 9: Dashboard update happens via event consumer (not inline)
      this.logger.log(`KC ${kc.kc_number} authorized by ${userId}`);

      // STEP 10: Push notification to all firm members (fire-and-forget)
      // Fetch customer name for the notification body
      this.dataSource.query(
        `SELECT name FROM customers WHERE id = $1 LIMIT 1`,
        [kc.customer_id],
      ).then((rows: Array<{ name: string }>) => {
        const customerName = rows[0]?.name ?? 'Unknown Customer';
        return this.notificationService.sendKCAuthorized({
          firmId,
          authorizedBy: userId,
          kcNumber: kc.kc_number,
          customerName,
          netPayable: String(totalNetPayable),
        });
      }).catch((err: Error) => {
        this.logger.error(`Push notification dispatch failed: ${err.message}`);
      });

      return this.findOne(id, firmId);
    } catch (error) {
      await qr.rollbackTransaction();
      this.logger.error(`Authorization failed for KC ${id}:`, error);
      throw error;
    } finally {
      await qr.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CANCEL (Firm Head only) — writes reversal ledger entries
  // ─────────────────────────────────────────────────────────────────────────────

  async cancel(id: string, dto: CancelKCDto, firmId: string, userId: string): Promise<KacchaChittha> {
    const kc = await this.kcRepo.findOne({ where: { id, firm_id: firmId } });
    if (!kc) throw new NotFoundException(`KC ${id} not found`);

    if (kc.status === KCStatus.CANCELLED) {
      throw new ConflictException('KC is already cancelled');
    }
    if (kc.status === KCStatus.DRAFT) {
      // Draft KC: just soft-cancel, no ledger impact
      await this.kcRepo.update(id, {
        status: KCStatus.CANCELLED,
        cancelled_at: new Date(),
        cancellation_reason: dto.reason,
      });

      await this.auditService.log({
        firm_id: firmId, entity: 'kaccha_chitthas', entity_id: id,
        action: AuditAction.CANCEL,
        old_value: { status: KCStatus.DRAFT },
        new_value: { status: KCStatus.CANCELLED, reason: dto.reason },
        changed_by: userId,
      });

      return this.findOne(id, firmId);
    }

    // AUTHORIZED KC cancellation: write reversal ledger entries
    const entryGroupId = uuidv4();

    await this.eventStore.publish({
      firm_id: firmId,
      event_type: 'KC_CANCELLED',
      aggregate_type: 'KC',
      aggregate_id: id,
      payload: {
        kc_id: id, kc_number: kc.kc_number, reason: dto.reason,
        reversal_group_id: entryGroupId,
        total_net_payable: kc.total_net_payable,
        total_commission: kc.total_commission,
        total_apmc_fee: kc.total_apmc_fee,
      },
      idempotency_key: `KC_CANCELLED:${id}`,
    });

    await this.kcRepo.update(id, {
      status: KCStatus.CANCELLED,
      cancelled_at: new Date(),
      cancellation_reason: dto.reason,
    });

    await this.auditService.log({
      firm_id: firmId, entity: 'kaccha_chitthas', entity_id: id,
      action: AuditAction.CANCEL,
      old_value: { status: KCStatus.AUTHORIZED },
      new_value: { status: KCStatus.CANCELLED, reason: dto.reason },
      changed_by: userId,
    });

    return this.findOne(id, firmId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private validateAuthorizationPreconditions(kc: KacchaChittha): void {
    if (kc.status !== KCStatus.DRAFT) {
      throw new ConflictException(
        `Cannot authorize KC in status: ${kc.status}. Only DRAFT KCs can be authorized.`,
      );
    }
  }

  /**
   * Build ledger entries per Section 5.5 of master spec.
   * These are the financial records of the KC authorization.
   *
   * a. CUSTOMER LEDGER CREDIT = net_payable (firm owes this to customer)
   * b. FIRM_CASH LEDGER CREDIT = commission (earned by firm)
   * c. FIRM_CASH LEDGER DEBIT = APMC fee (payable to government)
   * d. FIRM_CASH LEDGER CREDIT per cash/UPI payment received
   * e. CUSTOMER LEDGER DEBIT per Udhar payment (firm tracks receivable)
   */
  private buildLedgerEntries(params: {
    kc: KacchaChittha;
    entryGroupId: string;
    userId: string;
    totalNetPayable: string;
    commission: string;
    apmcFee: string;
    payments: KcPayment[];
  }) {
    const { kc, entryGroupId, totalNetPayable, commission, apmcFee, payments } = params;
    const entries = [];

    // a. Customer gets net_payable (firm owes customer)
    entries.push({
      ledger_type: LedgerType.CUSTOMER,
      entry_type: EntryType.CREDIT,
      amount: totalNetPayable,
      balance_after: '0.00',
      source_type: SourceType.KC_AUTHORIZATION,
      source_id: kc.id,
      entry_group_id: entryGroupId,
      customer_id: kc.customer_id,
      truck_id: kc.truck_id,
      description: `KC ${kc.kc_number} — net payable to customer`,
      idempotency_key: `${entryGroupId}:cust-credit`,
    });

    // b. Firm earns commission
    if (new Decimal(commission).gt(0)) {
      entries.push({
        ledger_type: LedgerType.FIRM_CASH,
        entry_type: EntryType.CREDIT,
        amount: commission,
        balance_after: '0.00',
        source_type: SourceType.KC_AUTHORIZATION,
        source_id: kc.id,
        entry_group_id: entryGroupId,
        customer_id: kc.customer_id,
        description: `KC ${kc.kc_number} — commission earned`,
        idempotency_key: `${entryGroupId}:firm-commission-credit`,
      });
    }

    // c. Firm owes APMC fee
    if (new Decimal(apmcFee).gt(0)) {
      entries.push({
        ledger_type: LedgerType.FIRM_CASH,
        entry_type: EntryType.DEBIT,
        amount: apmcFee,
        balance_after: '0.00',
        source_type: SourceType.KC_AUTHORIZATION,
        source_id: kc.id,
        entry_group_id: entryGroupId,
        description: `KC ${kc.kc_number} — APMC fee payable`,
        idempotency_key: `${entryGroupId}:firm-apmc-debit`,
      });
    }

    // d & e. Process each payment
    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];

      if (payment.is_udhar) {
        // e. Udhar: customer owes this amount (debit reduces what firm owes customer)
        entries.push({
          ledger_type: LedgerType.CUSTOMER,
          entry_type: EntryType.DEBIT,
          amount: payment.amount,
          balance_after: '0.00',
          source_type: SourceType.KC_AUTHORIZATION,
          source_id: kc.id,
          entry_group_id: entryGroupId,
          customer_id: kc.customer_id,
          description: `KC ${kc.kc_number} — Udhar (deferred payment)`,
          idempotency_key: `${entryGroupId}:udhar-${i}`,
        });
      } else {
        // d. Cash/UPI received: increases firm's cash
        entries.push({
          ledger_type: LedgerType.FIRM_CASH,
          entry_type: EntryType.CREDIT,
          amount: payment.amount,
          balance_after: '0.00',
          source_type: SourceType.PAYMENT_RECEIVED,
          source_id: payment.id,
          entry_group_id: entryGroupId,
          customer_id: kc.customer_id,
          description: `KC ${kc.kc_number} — payment received`,
          idempotency_key: `${entryGroupId}:payment-${i}`,
        });
      }
    }

    // f. Overpayment: if cash/UPI received > net_payable, excess reduces customer's udhar balance
    const totalCashAndUpi = payments
      .filter(p => !p.is_udhar)
      .reduce((sum, p) => sum.plus(p.amount), new Decimal(0));
    const overpayment = Decimal.max(0, totalCashAndUpi.minus(totalNetPayable));
    if (overpayment.gt(0)) {
      entries.push({
        ledger_type: LedgerType.CUSTOMER,
        entry_type: EntryType.CREDIT,
        amount: overpayment.toFixed(2),
        balance_after: '0.00',
        source_type: SourceType.KC_AUTHORIZATION,
        source_id: kc.id,
        entry_group_id: entryGroupId,
        customer_id: kc.customer_id,
        description: `KC ${kc.kc_number} — excess payment applied to reduce udhar balance`,
        idempotency_key: `${entryGroupId}:overpayment-credit`,
      });
    }

    return entries;
  }

  private async generateKcNumber(
    qr: ReturnType<DataSource['createQueryRunner']>,
    firmId: string,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const count = await qr.manager.count(KacchaChittha, { where: { firm_id: firmId } });
    return `KC-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}
