import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UnauthorizedException, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { RbacService } from './rbac.service';
import { ConfiguratorService } from '../config/configurator.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentFirmId } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserRole } from '../../common/enums';

// ── Firm-level RBAC endpoints (authenticated users) ─────────────────────────

@ApiTags('rbac')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rbac')
export class RbacController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly jwtService: JwtService,
  ) {}

  /** Get modules this user can access (with their permissions) */
  @Get('my-modules')
  @ApiOperation({ summary: 'Get accessible modules and CRUD permissions for current user' })
  getMyModules(@CurrentFirmId() firmId: string, @CurrentUser() user: JwtPayload) {
    return this.rbacService.getAccessibleModules(firmId, user.role);
  }

  /** Get CRUD permissions for the current user's role and firm */
  @Get('my-permissions')
  @ApiOperation({ summary: 'Get CRUD permissions for current user role' })
  getMyPermissions(@CurrentFirmId() firmId: string, @CurrentUser() user: JwtPayload) {
    return this.rbacService.getMyPermissions(firmId, user.role);
  }

  /** Get all role permissions for the firm (Firm Head only) */
  @Get('permissions')
  @Roles(UserRole.FIRM_HEAD)
  @ApiOperation({ summary: 'Get all role permissions for this firm (FIRM_HEAD only)' })
  getAllPermissions(@CurrentFirmId() firmId: string) {
    return this.rbacService.getRolePermissions(firmId);
  }

  /** Get permissions for a specific role */
  @Get('permissions/:role')
  @Roles(UserRole.FIRM_HEAD)
  getPermissionsForRole(@Param('role') role: string, @CurrentFirmId() firmId: string) {
    return this.rbacService.getRolePermissionsForRole(firmId, role);
  }

  /** Bulk update permissions for a role (Firm Head only) */
  @Put('permissions/:role')
  @Roles(UserRole.FIRM_HEAD)
  @ApiOperation({ summary: 'Set all module permissions for a role (FIRM_HEAD only)' })
  setRolePermissions(
    @Param('role') role: string,
    @Body() body: { permissions: Array<{ module_id: string; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }> },
    @CurrentFirmId() firmId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rbacService.bulkSetRolePermissions(firmId, role, body.permissions, user.sub);
  }

  /** Get all modules (for building configurator UI) */
  @Get('modules')
  getAllModules() {
    return this.rbacService.getAllModules();
  }

  /** Get this firm's enabled modules */
  @Get('firm-modules')
  @Roles(UserRole.FIRM_HEAD)
  getFirmModules(@CurrentFirmId() firmId: string) {
    return this.rbacService.getFirmModules(firmId);
  }
}

// ── Super Admin endpoints (separate token required) ──────────────────────────

@ApiTags('super-admin')
@Controller('super-admin')
export class SuperAdminController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly jwtService: JwtService,
    private readonly configuratorService: ConfiguratorService,
  ) {}

  private verifySAToken(token: string): { sub: string } {
    if (!token) throw new UnauthorizedException('Super admin token required');
    let payload: any;
    try { payload = this.jwtService.verify(token); } catch {
      throw new UnauthorizedException('Invalid super admin token');
    }
    if (payload.role !== 'SUPER_ADMIN') throw new UnauthorizedException('Not a super admin');
    return payload;
  }

  /** Super Admin Login (phone-based, any OTP in dev) */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Super Admin login (platform level)' })
  async login(@Body() body: { phone: string; otp: string }) {
    const admin = await this.rbacService.findSuperAdminByPhone(body.phone);
    if (!admin) throw new UnauthorizedException('Invalid super admin credentials');
    const token = this.jwtService.sign(
      { sub: admin.id, role: 'SUPER_ADMIN', name: admin.name },
      { expiresIn: '8h' },
    );
    return { access_token: token, admin: { id: admin.id, name: admin.name, phone: admin.phone } };
  }

  /** List all platform modules */
  @Public()
  @Get('modules')
  getAllModules() {
    return this.rbacService.getAllModules();
  }

  /** List all firms */
  @Public()
  @Get('firms')
  async listFirms(@Query('admin_token') adminToken: string) {
    this.verifySAToken(adminToken);
    return this.rbacService.getAllFirms();
  }

  /** Create a new firm (+ optional initial FIRM_HEAD user) */
  @Public()
  @Post('firms')
  @HttpCode(HttpStatus.CREATED)
  async createFirm(
    @Query('admin_token') adminToken: string,
    @Body() body: {
      name: string;
      apmc_name?: string;
      contact_phone?: string;
      address?: string;
      head_name?: string;
      head_phone?: string;
    },
  ) {
    const sa = this.verifySAToken(adminToken);
    if (!body.name?.trim()) throw new BadRequestException('Firm name is required');
    return this.rbacService.createFirm(body, sa.sub);
  }

  /** Update firm details */
  @Public()
  @Put('firms/:firmId')
  async updateFirm(
    @Param('firmId') firmId: string,
    @Query('admin_token') adminToken: string,
    @Body() body: { name?: string; apmc_name?: string; contact_phone?: string; address?: string; is_active?: boolean },
  ) {
    this.verifySAToken(adminToken);
    return this.rbacService.updateFirm(firmId, body);
  }

  /** Soft-delete a firm (sets is_active = false) */
  @Public()
  @Delete('firms/:firmId')
  async deleteFirm(
    @Param('firmId') firmId: string,
    @Query('admin_token') adminToken: string,
  ) {
    this.verifySAToken(adminToken);
    await this.rbacService.deactivateFirm(firmId);
    return { message: 'Firm deactivated successfully' };
  }

  /** Get a firm's module access */
  @Public()
  @Get('firms/:firmId/modules')
  async getFirmModules(@Param('firmId') firmId: string) {
    const records = await this.rbacService.getFirmModules(firmId);
    return { module_ids: records.filter(r => r.is_active).map(r => r.module_id) };
  }

  /** Set modules for a firm */
  @Public()
  @Put('firms/:firmId/modules')
  async setFirmModules(
    @Param('firmId') firmId: string,
    @Body() body: { module_ids: string[] },
    @Query('admin_token') adminToken: string,
  ) {
    const sa = this.verifySAToken(adminToken);
    const records = await this.rbacService.setFirmModules(firmId, body.module_ids, sa.sub);
    return { module_ids: records.filter(r => r.is_active).map(r => r.module_id) };
  }

  /** Get all super admins */
  @Public()
  @Get('admins')
  getAdmins() {
    return this.rbacService.getAllSuperAdmins();
  }

  /** Get role permissions for a firm (SA) */
  @Public()
  @Get('firms/:firmId/role-permissions')
  async getRolePermissions(
    @Param('firmId') firmId: string,
    @Query('admin_token') adminToken: string,
  ) {
    this.verifySAToken(adminToken);
    return this.rbacService.getRolePermissions(firmId);
  }

  /** Set permissions for a specific role in a firm (SA) */
  @Public()
  @Put('firms/:firmId/role-permissions/:role')
  async setRolePermissions(
    @Param('firmId') firmId: string,
    @Param('role') role: string,
    @Query('admin_token') adminToken: string,
    @Body() body: { permissions: Array<{ module_id: string; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }> },
  ) {
    const sa = this.verifySAToken(adminToken);
    return this.rbacService.bulkSetRolePermissions(firmId, role, body.permissions, sa.sub);
  }

  // ── Firm Config: APMC Fee ─────────────────────────────────────────────────

  /** Get current APMC fee config for a firm */
  @Public()
  @Get('firms/:firmId/config/apmc-fee')
  @ApiOperation({ summary: 'Get APMC fee config for a firm (SA only)' })
  async getApmcFeeConfig(
    @Param('firmId') firmId: string,
    @Query('admin_token') adminToken: string,
  ) {
    this.verifySAToken(adminToken);
    const config = await this.configuratorService.getApmcFeeConfigForFirm(firmId);
    return config ?? { fee_type: null, fee_value: null, min_fee: null, max_fee: null };
  }

  /** Set APMC fee config for a firm (closes old, creates new) */
  @Public()
  @Put('firms/:firmId/config/apmc-fee')
  @ApiOperation({ summary: 'Set APMC fee config for a firm (SA only)' })
  async setApmcFeeConfig(
    @Param('firmId') firmId: string,
    @Query('admin_token') adminToken: string,
    @Body() body: { fee_type: string; fee_value: number; min_fee?: number | null; max_fee?: number | null },
  ) {
    const sa = this.verifySAToken(adminToken);
    if (!body.fee_type || body.fee_value == null) throw new BadRequestException('fee_type and fee_value are required');
    return this.configuratorService.upsertApmcFeeConfig(firmId, body, sa.sub);
  }

  // ── Firm Config: Commission ───────────────────────────────────────────────

  /** Get current commission config for a firm */
  @Public()
  @Get('firms/:firmId/config/commission')
  @ApiOperation({ summary: 'Get commission config for a firm (SA only)' })
  async getCommissionConfig(
    @Param('firmId') firmId: string,
    @Query('admin_token') adminToken: string,
  ) {
    this.verifySAToken(adminToken);
    const config = await this.configuratorService.getCommissionConfigForFirm(firmId);
    return config ?? { commission_type: null, commission_value: null, rounding_strategy: 'ROUND_HALF_UP', min_commission: null, max_commission: null };
  }

  /** Set commission config for a firm (closes old, creates new) */
  @Public()
  @Put('firms/:firmId/config/commission')
  @ApiOperation({ summary: 'Set commission config for a firm (SA only)' })
  async setCommissionConfig(
    @Param('firmId') firmId: string,
    @Query('admin_token') adminToken: string,
    @Body() body: {
      commission_type: string;
      commission_value: number;
      rounding_strategy?: string;
      min_commission?: number | null;
      max_commission?: number | null;
    },
  ) {
    const sa = this.verifySAToken(adminToken);
    if (!body.commission_type || body.commission_value == null) throw new BadRequestException('commission_type and commission_value are required');
    return this.configuratorService.upsertCommissionConfig(firmId, body, sa.sub);
  }

  // ── Firm Config: Baardana ─────────────────────────────────────────────────

  /** Get current baardana config for a firm */
  @Public()
  @Get('firms/:firmId/config/baardana')
  @ApiOperation({ summary: 'Get baardana config for a firm (SA only)' })
  async getBaardanaConfig(
    @Param('firmId') firmId: string,
    @Query('admin_token') adminToken: string,
  ) {
    this.verifySAToken(adminToken);
    const config = await this.configuratorService.getBaardanaConfigForFirm(firmId);
    return config ?? { baardana_provider: 'FIRM', default_bags: 1, cost_per_unit: null, unit_label: 'bag' };
  }

  /** Set baardana config for a firm (closes old, creates new) */
  @Public()
  @Put('firms/:firmId/config/baardana')
  @ApiOperation({ summary: 'Set baardana config for a firm (SA only)' })
  async setBaardanaConfig(
    @Param('firmId') firmId: string,
    @Query('admin_token') adminToken: string,
    @Body() body: {
      cost_per_unit: number;
      unit_label?: string;
      baardana_provider: 'FIRM' | 'CUSTOMER';
      default_bags: number;
      rate_mode?: 'PER_KG' | 'PER_NAG';
    },
  ) {
    const sa = this.verifySAToken(adminToken);
    if (!body.baardana_provider) throw new BadRequestException('baardana_provider is required');
    if (body.default_bags == null || body.default_bags < 0) throw new BadRequestException('default_bags must be a non-negative integer');
    return this.configuratorService.upsertBaardanaConfig(firmId, body, sa.sub);
  }

  // ── Firm Config: Grades ───────────────────────────────────────────────────

  /** List all grades for a firm (SA) — includes active and inactive */
  @Public()
  @Get('firms/:firmId/config/grades')
  @ApiOperation({ summary: 'List all grade configs for a firm (SA only)' })
  async getFirmGrades(
    @Param('firmId') firmId: string,
    @Query('admin_token') adminToken: string,
  ) {
    this.verifySAToken(adminToken);
    return this.configuratorService.getAllGradesForFirm(firmId);
  }

  /** Create a new grade for a firm (SA) */
  @Public()
  @Post('firms/:firmId/config/grades')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a grade config for a firm (SA only)' })
  async createFirmGrade(
    @Param('firmId') firmId: string,
    @Query('admin_token') adminToken: string,
    @Body() body: { grade_code: string; grade_label: string; sort_order?: number },
  ) {
    this.verifySAToken(adminToken);
    if (!body.grade_code?.trim()) throw new BadRequestException('grade_code is required');
    if (!body.grade_label?.trim()) throw new BadRequestException('grade_label is required');
    return this.configuratorService.createGradeForFirm(firmId, body);
  }

  /** Update a grade's code/label/sort_order (SA) */
  @Public()
  @Put('firms/:firmId/config/grades/:gradeId')
  @ApiOperation({ summary: 'Update a grade config for a firm (SA only)' })
  async updateFirmGrade(
    @Param('firmId') firmId: string,
    @Param('gradeId') gradeId: string,
    @Query('admin_token') adminToken: string,
    @Body() body: { grade_code?: string; grade_label?: string; sort_order?: number },
  ) {
    this.verifySAToken(adminToken);
    return this.configuratorService.updateGradeForFirm(firmId, gradeId, body);
  }

  // ── Firm Config: PDF ──────────────────────────────────────────────────────

  /** Get PDF config for a firm (SA) */
  @Public()
  @Get('firms/:firmId/config/pdf')
  @ApiOperation({ summary: 'Get PDF config for a firm (SA only)' })
  async getFirmPdfConfig(
    @Param('firmId') firmId: string,
    @Query('admin_token') adminToken: string,
  ) {
    this.verifySAToken(adminToken);
    return this.rbacService.getFirmPdfConfig(firmId);
  }

  /** Set PDF config for a firm (SA) */
  @Public()
  @Put('firms/:firmId/config/pdf')
  @ApiOperation({ summary: 'Set PDF config for a firm (SA only)' })
  async setFirmPdfConfig(
    @Param('firmId') firmId: string,
    @Query('admin_token') adminToken: string,
    @Body() body: {
      pdf_enabled: boolean;
      buyer_summary_pdf_enabled?: boolean;
      daybook_pdf_enabled?: boolean;
      firm_short_name?: string;
      footer_text?: string;
    },
  ) {
    this.verifySAToken(adminToken);
    return this.rbacService.setFirmPdfConfig(firmId, body);
  }
}

