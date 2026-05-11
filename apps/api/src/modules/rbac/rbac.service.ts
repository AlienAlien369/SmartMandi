import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { SuperAdmin } from '../super-admin/super-admin.entity';
import { ModuleDefinition } from './module-definition.entity';
import { FirmModuleAccess } from './firm-module-access.entity';
import { RoleModulePermission } from './role-module-permission.entity';
import { UserRole } from '../../common/enums';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(SuperAdmin)
    private readonly superAdminRepo: Repository<SuperAdmin>,
    @InjectRepository(ModuleDefinition)
    private readonly moduleRepo: Repository<ModuleDefinition>,
    @InjectRepository(FirmModuleAccess)
    private readonly firmModuleRepo: Repository<FirmModuleAccess>,
    @InjectRepository(RoleModulePermission)
    private readonly permissionRepo: Repository<RoleModulePermission>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ── Super Admin Auth ─────────────────────────────────────────────────────────

  async findSuperAdminByPhone(phone: string): Promise<SuperAdmin | null> {
    return this.superAdminRepo.findOne({ where: { phone, is_active: true } });
  }

  async getAllSuperAdmins(): Promise<SuperAdmin[]> {
    return this.superAdminRepo.find({ order: { created_at: 'ASC' } });
  }

  async getAllFirms(): Promise<Array<{ id: string; name: string; apmc_name: string; contact_phone: string; address: string; is_active: boolean; user_count: number; created_at: string }>> {
    return this.dataSource.query(
      `SELECT f.id, f.name, f.apmc_name, f.contact_phone, f.address, f.is_active, f.created_at,
              COUNT(u.id)::int AS user_count
       FROM firms f
       LEFT JOIN users u ON u.firm_id = f.id AND u.is_active = true
       GROUP BY f.id, f.name, f.apmc_name, f.contact_phone, f.address, f.is_active, f.created_at
       ORDER BY f.created_at DESC`,
    );
  }

  async createFirm(
    data: { name: string; apmc_name?: string; contact_phone?: string; address?: string; head_name?: string; head_phone?: string },
    createdBy: string,
  ): Promise<{ firm: any; head_user?: any }> {
    // Create firm
    const [firm] = await this.dataSource.query(
      `INSERT INTO firms (name, apmc_name, contact_phone, address)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, apmc_name, contact_phone, address, is_active, created_at`,
      [data.name.trim(), data.apmc_name ?? null, data.contact_phone ?? null, data.address ?? null],
    );

    let head_user: any = null;

    // Optionally create initial FIRM_HEAD user
    if (data.head_name && data.head_phone) {
      const phone = data.head_phone.trim();
      const existing = await this.dataSource.query(
        `SELECT id FROM users WHERE firm_id = $1 AND phone = $2 LIMIT 1`,
        [firm.id, phone],
      );
      if (existing.length === 0) {
        const [user] = await this.dataSource.query(
          `INSERT INTO users (firm_id, name, phone, role, is_active)
           VALUES ($1, $2, $3, 'FIRM_HEAD', true)
           RETURNING id, name, phone, role`,
          [firm.id, data.head_name.trim(), phone],
        );
        head_user = user;
      }
    }

    // Grant all modules to new firm by default
    const modules = await this.getAllModules();
    await this.setFirmModules(firm.id, modules.map(m => m.id), createdBy);

    return { firm, head_user };
  }

  async updateFirm(
    firmId: string,
    data: { name?: string; apmc_name?: string; contact_phone?: string; address?: string; is_active?: boolean },
  ): Promise<any> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name.trim()); }
    if (data.apmc_name !== undefined) { sets.push(`apmc_name = $${idx++}`); params.push(data.apmc_name); }
    if (data.contact_phone !== undefined) { sets.push(`contact_phone = $${idx++}`); params.push(data.contact_phone); }
    if (data.address !== undefined) { sets.push(`address = $${idx++}`); params.push(data.address); }
    if (data.is_active !== undefined) { sets.push(`is_active = $${idx++}`); params.push(data.is_active); }

    if (sets.length === 0) throw new BadRequestException('No fields to update');

    sets.push(`updated_at = NOW()`);
    params.push(firmId);

    const [firm] = await this.dataSource.query(
      `UPDATE firms SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, name, apmc_name, contact_phone, address, is_active`,
      params,
    );
    if (!firm) throw new NotFoundException(`Firm ${firmId} not found`);
    return firm;
  }

  async deactivateFirm(firmId: string): Promise<void> {
    const result = await this.dataSource.query(
      `UPDATE firms SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [firmId],
    );
    if (result[1] === 0) throw new NotFoundException(`Firm ${firmId} not found`);
  }

  // ── Module Definitions ────────────────────────────────────────────────────────

  async getAllModules(): Promise<ModuleDefinition[]> {
    return this.moduleRepo.find({ where: { is_active: true }, order: { sort_order: 'ASC' } });
  }

  // ── Firm Module Access (Super Admin manages) ──────────────────────────────────

  async getFirmModules(firmId: string): Promise<FirmModuleAccess[]> {
    return this.firmModuleRepo.find({ where: { firm_id: firmId } });
  }

  async setFirmModules(
    firmId: string,
    moduleIds: string[],
    superAdminId: string,
  ): Promise<FirmModuleAccess[]> {
    // Validate modules exist
    const modules = await this.moduleRepo.find({ where: { id: In(moduleIds) } });
    if (modules.length !== moduleIds.length) {
      throw new BadRequestException('One or more module IDs are invalid');
    }

    // Deactivate all existing access first
    await this.firmModuleRepo.update({ firm_id: firmId }, { is_active: false });

    // Upsert active access for provided modules
    for (const moduleId of moduleIds) {
      const existing = await this.firmModuleRepo.findOne({ where: { firm_id: firmId, module_id: moduleId } });
      if (existing) {
        await this.firmModuleRepo.update(existing.id, { is_active: true, granted_by: superAdminId });
      } else {
        await this.firmModuleRepo.save(
          this.firmModuleRepo.create({ firm_id: firmId, module_id: moduleId, granted_by: superAdminId, is_active: true }),
        );
      }
    }

    return this.getFirmModules(firmId);
  }

  // ── Role Module Permissions (Firm Head manages) ───────────────────────────────

  async getRolePermissions(firmId: string): Promise<RoleModulePermission[]> {
    return this.permissionRepo.find({ where: { firm_id: firmId }, order: { role: 'ASC', module_id: 'ASC' } });
  }

  async getRolePermissionsForRole(firmId: string, role: string): Promise<RoleModulePermission[]> {
    return this.permissionRepo.find({ where: { firm_id: firmId, role } });
  }

  async setRolePermission(
    firmId: string,
    role: string,
    moduleId: string,
    permissions: { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean },
    updatedBy: string,
  ): Promise<RoleModulePermission> {
    if (role === UserRole.FIRM_HEAD) {
      throw new BadRequestException('FIRM_HEAD always has full permissions — cannot be restricted');
    }

    // Verify firm has access to this module
    const moduleAccess = await this.firmModuleRepo.findOne({
      where: { firm_id: firmId, module_id: moduleId, is_active: true },
    });
    if (!moduleAccess) {
      throw new BadRequestException(`Module ${moduleId} is not enabled for this firm`);
    }

    const existing = await this.permissionRepo.findOne({
      where: { firm_id: firmId, role, module_id: moduleId },
    });

    if (existing) {
      await this.permissionRepo.update(existing.id, { ...permissions, updated_by: updatedBy, updated_at: new Date() });
      return this.permissionRepo.findOne({ where: { id: existing.id } }) as Promise<RoleModulePermission>;
    }

    return this.permissionRepo.save(
      this.permissionRepo.create({ firm_id: firmId, role, module_id: moduleId, ...permissions, updated_by: updatedBy }),
    );
  }

  async bulkSetRolePermissions(
    firmId: string,
    role: string,
    permissions: Array<{ module_id: string; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }>,
    updatedBy: string,
  ): Promise<RoleModulePermission[]> {
    for (const p of permissions) {
      await this.setRolePermission(firmId, role, p.module_id, p, updatedBy);
    }
    return this.getRolePermissionsForRole(firmId, role);
  }

  // ── Permission Check ──────────────────────────────────────────────────────────

  async checkPermission(
    firmId: string,
    role: string,
    moduleId: string,
    action: 'can_create' | 'can_read' | 'can_update' | 'can_delete',
  ): Promise<boolean> {
    if (role === UserRole.FIRM_HEAD) return true;

    // Check firm has module access
    const moduleAccess = await this.firmModuleRepo.findOne({
      where: { firm_id: firmId, module_id: moduleId, is_active: true },
    });
    if (!moduleAccess) return false;

    const perm = await this.permissionRepo.findOne({ where: { firm_id: firmId, role, module_id: moduleId } });
    if (!perm) return action === 'can_read'; // Default: read-only

    return perm[action];
  }

  // ── Get CRUD permission map for current user ─────────────────────────────────

  async getMyPermissions(
    firmId: string,
    role: string,
  ): Promise<Record<string, { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }>> {
    if (role === UserRole.FIRM_HEAD) {
      const modules = await this.getFirmModules(firmId);
      const result: Record<string, { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }> = {};
      for (const m of modules) {
        if (m.is_active) {
          result[m.module_id] = { can_create: true, can_read: true, can_update: true, can_delete: true };
        }
      }
      return result;
    }

    const perms = await this.permissionRepo.find({
      where: { firm_id: firmId, role },
    });

    const result: Record<string, { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }> = {};
    for (const p of perms) {
      result[p.module_id] = {
        can_create: p.can_create,
        can_read: p.can_read,
        can_update: p.can_update,
        can_delete: p.can_delete,
      };
    }
    return result;
  }

  // ── Get accessible modules for a user ────────────────────────────────────────

  async getAccessibleModules(firmId: string, role: string): Promise<Array<ModuleDefinition & { permissions: object }>> {
    if (role === UserRole.FIRM_HEAD) {
      const modules = await this.getAllModules();
      const firmAccess = await this.getFirmModules(firmId);
      const activeModuleIds = new Set(firmAccess.filter(a => a.is_active).map(a => a.module_id));
      return modules
        .filter(m => activeModuleIds.has(m.id))
        .map(m => ({ ...m, permissions: { can_create: true, can_read: true, can_update: true, can_delete: true } }));
    }

    const firmAccess = await this.firmModuleRepo.find({ where: { firm_id: firmId, is_active: true } });
    const activeModuleIds = firmAccess.map(a => a.module_id);

    const perms = await this.permissionRepo.find({ where: { firm_id: firmId, role, module_id: In(activeModuleIds) } });
    const permMap = new Map(perms.map(p => [p.module_id, p]));

    const modules = await this.moduleRepo.find({
      where: { id: In(activeModuleIds), is_active: true },
      order: { sort_order: 'ASC' },
    });

    return modules
      .filter(m => {
        const p = permMap.get(m.id);
        return !p || p.can_read; // Show module if can_read (or no explicit restriction)
      })
      .map(m => {
        const p = permMap.get(m.id);
        return {
          ...m,
          permissions: {
            can_create: p?.can_create ?? false,
            can_read: p?.can_read ?? true,
            can_update: p?.can_update ?? false,
            can_delete: p?.can_delete ?? false,
          },
        };
      });
  }

  // ── Firm PDF Config (SA manages) ─────────────────────────────────────────────

  async getFirmPdfConfig(firmId: string): Promise<{
    pdf_enabled: boolean;
    pdf_format: string;
    firm_short_name: string | null;
    footer_text: string | null;
  }> {
    const [row] = await this.dataSource.query(
      `SELECT pdf_enabled, pdf_format, firm_short_name, footer_text
       FROM firm_pdf_config WHERE firm_id = $1`,
      [firmId],
    );
    return row ?? { pdf_enabled: false, pdf_format: 'STANDARD', firm_short_name: null, footer_text: null };
  }

  async setFirmPdfConfig(
    firmId: string,
    data: { pdf_enabled: boolean; firm_short_name?: string; footer_text?: string },
  ): Promise<{ pdf_enabled: boolean; pdf_format: string; firm_short_name: string | null; footer_text: string | null }> {
    await this.dataSource.query(
      `INSERT INTO firm_pdf_config (firm_id, pdf_enabled, firm_short_name, footer_text, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (firm_id) DO UPDATE
         SET pdf_enabled    = EXCLUDED.pdf_enabled,
             firm_short_name = EXCLUDED.firm_short_name,
             footer_text    = EXCLUDED.footer_text,
             updated_at     = NOW()`,
      [firmId, data.pdf_enabled, data.firm_short_name ?? null, data.footer_text ?? null],
    );
    return this.getFirmPdfConfig(firmId);
  }
}
