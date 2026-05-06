import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { Customer } from './customer.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../../common/enums';

interface CustomerFilters {
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateCustomerDto, firmId: string, userId: string): Promise<Customer> {
    const customer = this.repo.create({ ...dto, firm_id: firmId });
    const saved = await this.repo.save(customer);

    await this.auditService.log({
      firm_id: firmId, entity: 'customers', entity_id: saved.id,
      action: AuditAction.CREATE, new_value: saved as unknown as Record<string, unknown>,
      changed_by: userId,
    });

    return saved;
  }

  async findAll(
    firmId: string,
    filters: CustomerFilters = {},
  ): Promise<{ data: Customer[]; meta: { total: number; page: number } }> {
    const page = Math.max(1, Number(filters.page ?? 1) || 1);
    const limit = Math.min(Math.max(1, Number(filters.limit ?? 50) || 50), 100);

    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.firm_id = :firmId', { firmId })
      .andWhere('c.deleted_at IS NULL')
      .orderBy('c.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.search) {
      qb.andWhere('(c.name ILIKE :s OR c.phone ILIKE :s)', {
        s: `%${filters.search}%`,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page } };
  }

  async findOne(id: string, firmId: string): Promise<Customer> {
    const customer = await this.repo.findOne({
      where: { id, firm_id: firmId, deleted_at: IsNull() },
    });
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);
    return customer;
  }

  async update(
    id: string, dto: UpdateCustomerDto, firmId: string, userId: string,
  ): Promise<Customer> {
    const customer = await this.findOne(id, firmId);
    const old = { ...customer };

    Object.assign(customer, dto);
    customer.version += 1;
    const saved = await this.repo.save(customer);

    await this.auditService.log({
      firm_id: firmId, entity: 'customers', entity_id: id,
      action: AuditAction.UPDATE,
      old_value: old as unknown as Record<string, unknown>,
      new_value: saved as unknown as Record<string, unknown>,
      changed_by: userId,
    });

    return saved;
  }

  /** Soft-delete — never hard-delete customers */
  async softDelete(id: string, firmId: string, userId: string): Promise<void> {
    const customer = await this.findOne(id, firmId);
    await this.repo.update(id, { deleted_at: new Date() });

    await this.auditService.log({
      firm_id: firmId, entity: 'customers', entity_id: id,
      action: AuditAction.DELETE,
      old_value: customer as unknown as Record<string, unknown>,
      changed_by: userId,
    });
  }

  /** Full purchase history + outstanding udhar for a customer */
  async getCustomerHistory(customerId: string, firmId: string): Promise<{
    customer: Customer;
    outstanding_udhar: number;
    total_purchase_amount: number;
    total_kcs: number;
    kcs: any[];
  }> {
    const customer = await this.findOne(customerId, firmId);

    // All KCs for this customer
    const kcs = await this.dataSource.query(
      `SELECT
         kc.id, kc.kc_number, kc.sale_date, kc.status,
         kc.total_weight_kg, kc.total_gross_amount, kc.total_apmc_fee,
         kc.total_commission, kc.total_baardana_cost, kc.total_net_payable,
         kc.created_at, kc.authorized_at, kc.cancellation_reason,
         t.truck_number, t.produce_name,
         u.name AS created_by_name
       FROM kaccha_chitthas kc
       LEFT JOIN trucks t ON t.id = kc.truck_id
       LEFT JOIN users u ON u.id = kc.created_by
       WHERE kc.customer_id = $1 AND kc.firm_id = $2
         AND kc.cancelled_at IS NULL
       ORDER BY kc.sale_date DESC, kc.created_at DESC`,
      [customerId, firmId],
    );

    // Line items for all KCs
    const kcIds = kcs.map((k: any) => k.id);
    let lineItems: any[] = [];
    let payments: any[] = [];

    if (kcIds.length > 0) {
      const placeholders = kcIds.map((_: any, i: number) => `$${i + 1}`).join(',');

      lineItems = await this.dataSource.query(
        `SELECT li.kc_id, li.quantity_bags, li.weight_per_bag_kg, li.total_weight_kg,
                li.rate_per_kg, li.gross_amount, li.baardana_cost,
                gc.grade_label AS grade_name, gc.grade_code
         FROM kc_line_items li
         LEFT JOIN grade_configs gc ON gc.id = li.grade_config_id
         WHERE li.kc_id IN (${placeholders}) AND li.firm_id = $${kcIds.length + 1}
         ORDER BY li.sort_order ASC`,
        [...kcIds, firmId],
      );

      payments = await this.dataSource.query(
        `SELECT p.kc_id, p.amount, p.is_udhar, p.payment_date, p.udhar_due_date,
                p.payment_reference, p.notes,
                pm.mode_label AS payment_mode
         FROM kc_payments p
         LEFT JOIN payment_mode_configs pm ON pm.id = p.payment_mode_id
         WHERE p.kc_id IN (${placeholders}) AND p.firm_id = $${kcIds.length + 1}`,
        [...kcIds, firmId],
      );
    }

    // Group line items and payments by kc_id
    const liByKc = lineItems.reduce((acc: any, li: any) => {
      (acc[li.kc_id] = acc[li.kc_id] || []).push(li);
      return acc;
    }, {});
    const pmtByKc = payments.reduce((acc: any, p: any) => {
      (acc[p.kc_id] = acc[p.kc_id] || []).push(p);
      return acc;
    }, {});

    // Calculate outstanding udhar = sum of all udhar payments across all KCs
    const outstanding_udhar = payments
      .filter((p: any) => p.is_udhar)
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

    const total_purchase_amount = kcs.reduce(
      (sum: number, kc: any) => sum + Number(kc.total_net_payable || 0), 0,
    );

    const enrichedKcs = kcs.map((kc: any) => ({
      ...kc,
      line_items: liByKc[kc.id] || [],
      payments: pmtByKc[kc.id] || [],
      udhar_amount: (pmtByKc[kc.id] || [])
        .filter((p: any) => p.is_udhar)
        .reduce((s: number, p: any) => s + Number(p.amount), 0),
    }));

    return {
      customer,
      outstanding_udhar,
      total_purchase_amount,
      total_kcs: kcs.length,
      kcs: enrichedKcs,
    };
  }
}
