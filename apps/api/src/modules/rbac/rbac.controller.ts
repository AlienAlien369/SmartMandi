import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UnauthorizedException, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { RbacService } from './rbac.service';
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
}
