import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SalaryService } from './salary.service';
import { CreateSalaryEntryDto } from './dto/salary.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, CurrentFirmId } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { FreightType } from '../../common/enums';

const MODULE = 'SALARY';

@ApiTags('freight')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('salary')
export class SalaryController {
  constructor(private readonly service: SalaryService) {}

  @Post()
  @RequirePermission(MODULE, 'create')
  @ApiOperation({ summary: 'Record freight payment (salary/inam/kiraya/parchi) — writes FIRM_CASH DEBIT + USER_SALARY CREDIT' })
  create(@Body() dto: CreateSalaryEntryDto, @CurrentFirmId() firmId: string, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, firmId, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List freight entries with optional freight_type/truck_id filter' })
  findAll(
    @CurrentFirmId() firmId: string,
    @Query('user_id') user_id?: string,
    @Query('truck_id') truck_id?: string,
    @Query('freight_type') freight_type?: FreightType,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll(firmId, { user_id, truck_id, freight_type, from, to, page, limit });
  }

  @Patch(':id')
  @RequirePermission(MODULE, 'update')
  @ApiOperation({ summary: 'Update freight entry notes' })
  update(@Param('id') id: string, @Body('notes') notes: string, @CurrentFirmId() firmId: string) {
    return this.service.update(id, notes, firmId);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete freight entry — writes reversal ledger entries' })
  delete(@Param('id') id: string, @CurrentFirmId() firmId: string, @CurrentUser() user: JwtPayload) {
    return this.service.delete(id, firmId, user.sub);
  }
}
