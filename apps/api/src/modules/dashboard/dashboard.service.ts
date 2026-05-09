import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { DashboardMetrics } from './dashboard-metrics.entity';
import { SummarySheet } from './summary-sheet.entity';
import { KacchaChittha } from '../kaccha-chittha/entities/kaccha-chittha.entity';
import { Truck } from '../trucks/truck.entity';
import { TruckStatus, KCStatus } from '../../common/enums';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(DashboardMetrics)
    private readonly metricsRepo: Repository<DashboardMetrics>,
    @InjectRepository(SummarySheet)
    private readonly summaryRepo: Repository<SummarySheet>,
    @InjectRepository(KacchaChittha)
    private readonly kcRepo: Repository<KacchaChittha>,
    @InjectRepository(Truck)
    private readonly truckRepo: Repository<Truck>,
    private readonly dataSource: DataSource,
  ) {}

  /** Live computation for a date range (no caching). */
  async getDashboardRange(firmId: string, dateFrom?: string, dateTo?: string): Promise<Partial<DashboardMetrics> & { computed_at: Date }> {
    const from = dateFrom ?? new Date().toISOString().slice(0, 10);
    const to   = dateTo   ?? new Date().toISOString().slice(0, 10);

    const [truckCounts, kcCounts, financials, udhar] = await Promise.all([
      this.computeTruckCountsRange(firmId, from, to),
      this.computeKcCountsRange(firmId, from, to),
      this.computeFinancialsRange(firmId, from, to),
      this.computeUdhar(firmId),
    ]);

    return { firm_id: firmId, ...truckCounts, ...kcCounts, ...financials, total_udhar_outstanding: udhar, computed_at: new Date() };
  }

  private async computeTruckCountsRange(firmId: string, from: string, to: string) {
    const base = { firm_id: firmId } as any;
    const [s, a, c] = await Promise.all([
      this.truckRepo.createQueryBuilder('t').where('t.firm_id = :firmId', { firmId }).andWhere('t.sale_date BETWEEN :from AND :to', { from, to }).andWhere('t.status = :s', { s: TruckStatus.SCHEDULED }).getCount(),
      this.truckRepo.createQueryBuilder('t').where('t.firm_id = :firmId', { firmId }).andWhere('t.sale_date BETWEEN :from AND :to', { from, to }).andWhere('t.status = :s', { s: TruckStatus.ARRIVED }).getCount(),
      this.truckRepo.createQueryBuilder('t').where('t.firm_id = :firmId', { firmId }).andWhere('t.sale_date BETWEEN :from AND :to', { from, to }).andWhere('t.status = :s', { s: TruckStatus.CLOSED }).getCount(),
    ]);
    return { trucks_scheduled: s, trucks_arrived: a, trucks_closed: c, trucks_in_progress: a };
  }

  private async computeKcCountsRange(firmId: string, from: string, to: string) {
    const [total, authorized] = await Promise.all([
      this.kcRepo.createQueryBuilder('kc').where('kc.firm_id = :firmId', { firmId }).andWhere('kc.sale_date BETWEEN :from AND :to', { from, to }).getCount(),
      this.kcRepo.createQueryBuilder('kc').where('kc.firm_id = :firmId', { firmId }).andWhere('kc.sale_date BETWEEN :from AND :to', { from, to }).andWhere('kc.status = :s', { s: KCStatus.AUTHORIZED }).getCount(),
    ]);
    return { total_kc_count: total, total_kc_authorized: authorized };
  }

  private async computeFinancialsRange(firmId: string, from: string, to: string) {
    const result = await this.kcRepo
      .createQueryBuilder('kc')
      .select([
        'COALESCE(SUM(kc.total_gross_amount::numeric), 0) as total_sales_amount',
        'COALESCE(SUM(kc.total_commission::numeric), 0) as total_commission_earned',
        'COALESCE(SUM(kc.total_weight_kg::numeric), 0) as total_weight_sold_kg',
      ])
      .where('kc.firm_id = :firmId', { firmId })
      .andWhere('kc.sale_date BETWEEN :from AND :to', { from, to })
      .andWhere('kc.status = :status', { status: KCStatus.AUTHORIZED })
      .getRawOne();

    return {
      total_sales_amount: new Decimal(result?.total_sales_amount ?? '0').toFixed(2),
      total_commission_earned: new Decimal(result?.total_commission_earned ?? '0').toFixed(2),
      total_weight_sold_kg: new Decimal(result?.total_weight_sold_kg ?? '0').toFixed(3),
    };
  }

  /** Get or compute today's dashboard metrics for a firm. */
  async getDashboard(firmId: string, date?: string): Promise<DashboardMetrics> {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    const currentHour = new Date().getHours();

    let metrics = await this.metricsRepo.findOne({
      where: { firm_id: firmId, metric_date: targetDate, metric_hour: currentHour },
    });

    // Compute if not cached or stale (older than 60s)
    const staleThreshold = 60 * 1000;
    if (
      !metrics ||
      !metrics.computed_at ||
      Date.now() - new Date(metrics.computed_at).getTime() > staleThreshold
    ) {
      metrics = await this.computeAndSave(firmId, targetDate, metrics);
    }

    return metrics;
  }

  /** Full recomputation — called by event consumers and scheduled job. */
  async computeAndSave(
    firmId: string,
    date: string,
    existing?: DashboardMetrics | null,
  ): Promise<DashboardMetrics> {
    const currentHour = new Date().getHours();
    const [truckCounts, kcCounts, financials, udhar] = await Promise.all([
      this.computeTruckCounts(firmId, date),
      this.computeKcCounts(firmId, date),
      this.computeFinancials(firmId, date),
      this.computeUdhar(firmId),
    ]);

    const data = {
      firm_id: firmId,
      metric_date: date,
      metric_hour: currentHour,
      ...truckCounts,
      ...kcCounts,
      ...financials,
      total_udhar_outstanding: udhar,
      computed_at: new Date(),
    };

    if (existing) {
      Object.assign(existing, data);
      return this.metricsRepo.save(existing);
    }

    const created = this.metricsRepo.create(data);
    return this.metricsRepo.save(created);
  }

  private async computeTruckCounts(firmId: string, date: string) {
    const trucks_scheduled = await this.truckRepo.count({
      where: { firm_id: firmId, sale_date: date, status: TruckStatus.SCHEDULED },
    });
    const trucks_arrived = await this.truckRepo.count({
      where: { firm_id: firmId, sale_date: date, status: TruckStatus.ARRIVED },
    });
    const trucks_closed = await this.truckRepo.count({
      where: { firm_id: firmId, sale_date: date, status: TruckStatus.CLOSED },
    });
    const trucks_in_progress = trucks_arrived; // ARRIVED = in progress
    return { trucks_scheduled, trucks_arrived, trucks_closed, trucks_in_progress };
  }

  private async computeKcCounts(firmId: string, date: string) {
    const total_kc_count = await this.kcRepo.count({
      where: { firm_id: firmId, sale_date: date },
    });
    const total_kc_authorized = await this.kcRepo.count({
      where: { firm_id: firmId, sale_date: date, status: KCStatus.AUTHORIZED },
    });
    return { total_kc_count, total_kc_authorized };
  }

  private async computeFinancials(firmId: string, date: string) {
    const result = await this.kcRepo
      .createQueryBuilder('kc')
      .select([
        'COALESCE(SUM(kc.total_gross_amount::numeric), 0) as total_sales_amount',
        'COALESCE(SUM(kc.total_commission::numeric), 0) as total_commission_earned',
        'COALESCE(SUM(kc.total_weight_kg::numeric), 0) as total_weight_sold_kg',
      ])
      .where('kc.firm_id = :firmId', { firmId })
      .andWhere('kc.sale_date = :date', { date })
      .andWhere('kc.status = :status', { status: KCStatus.AUTHORIZED })
      .getRawOne();

    return {
      total_sales_amount: new Decimal(result?.total_sales_amount ?? '0').toFixed(2),
      total_commission_earned: new Decimal(result?.total_commission_earned ?? '0').toFixed(2),
      total_weight_sold_kg: new Decimal(result?.total_weight_sold_kg ?? '0').toFixed(3),
    };
  }

  /** Udhar = net outstanding across all customers (from KC payments, not ledger) */
  private async computeUdhar(firmId: string): Promise<string> {
    // Compute directly from kaccha_chitthas + kc_payments so dashboard is accurate
    // even when ledger_entries haven't been generated yet (e.g. seeded data).
    const result = await this.dataSource.query(
      `SELECT COALESCE(SUM(kc.total_net_payable - COALESCE(paid.total_paid, 0)), 0) AS net
       FROM kaccha_chitthas kc
       LEFT JOIN (
         SELECT p.kc_id, SUM(p.amount) AS total_paid
         FROM kc_payments p
         GROUP BY p.kc_id
       ) paid ON paid.kc_id = kc.id
       WHERE kc.firm_id = $1
         AND kc.status = 'AUTHORIZED'
         AND kc.total_net_payable > COALESCE(paid.total_paid, 0)`,
      [firmId],
    );

    const net = new Decimal(result?.[0]?.net ?? '0');
    return net.gt(0) ? net.toFixed(2) : '0.00';
  }

  /** Generate an immutable summary sheet for a sale_date. */
  async generateSummarySheet(firmId: string, date: string, userId: string): Promise<SummarySheet> {
    const trucks = await this.truckRepo
      .createQueryBuilder('t')
      .where('t.firm_id = :firmId', { firmId })
      .andWhere('t.sale_date = :date', { date })
      .getMany();

    const kcs = await this.kcRepo
      .createQueryBuilder('kc')
      .leftJoinAndSelect('kc.line_items', 'li')
      .where('kc.firm_id = :firmId', { firmId })
      .andWhere('kc.sale_date = :date', { date })
      .andWhere('kc.status = :status', { status: KCStatus.AUTHORIZED })
      .getMany();

    let totalGross = new Decimal(0);
    let totalCommission = new Decimal(0);
    let totalApmc = new Decimal(0);
    let totalNetPayable = new Decimal(0);

    for (const kc of kcs) {
      totalGross = totalGross.plus(new Decimal(kc.total_gross_amount ?? '0'));
      totalCommission = totalCommission.plus(new Decimal(kc.total_commission ?? '0'));
      totalApmc = totalApmc.plus(new Decimal(kc.total_apmc_fee ?? '0'));
      totalNetPayable = totalNetPayable.plus(new Decimal(kc.total_net_payable ?? '0'));
    }

    const sheet = this.summaryRepo.create({
      firm_id: firmId,
      sale_date: date,
      snapshot: { trucks, kcs },
      total_trucks: trucks.length,
      total_gross_sales: totalGross.toFixed(2),
      total_commission: totalCommission.toFixed(2),
      total_apmc_fees: totalApmc.toFixed(2),
      total_net_payable: totalNetPayable.toFixed(2),
      generated_by: userId,
    });

    return this.summaryRepo.save(sheet);
  }

  async getSummarySheets(firmId: string, page = 1, limit = 20): Promise<{ data: SummarySheet[]; meta: object }> {
    const [data, total] = await this.summaryRepo.findAndCount({
      where: { firm_id: firmId },
      order: { sale_date: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { total, page, limit } };
  }
}
