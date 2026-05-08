import {
  Controller, Get, Post, Delete, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TrucksService } from './trucks.service';
import { CreateTruckDto, MarkArrivedDto, CloseTruckDto, TruckFiltersDto } from './dto/truck.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, CurrentFirmId } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';

const MODULE = 'TRUCKS';

@ApiTags('trucks')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('trucks')
export class TrucksController {
  constructor(private readonly service: TrucksService) {}

  @Post()
  @RequirePermission(MODULE, 'create')
  @ApiOperation({ summary: 'Schedule a new truck (SCHEDULED status)' })
  create(@Body() dto: CreateTruckDto, @CurrentFirmId() firmId: string, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, firmId, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List trucks with filters (status, date, customer)' })
  findAll(@CurrentFirmId() firmId: string, @Query() filters: TruckFiltersDto) {
    return this.service.findAll(firmId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get truck detail with purchase entries' })
  findOne(@Param('id') id: string, @CurrentFirmId() firmId: string) {
    return this.service.findOne(id, firmId);
  }

  @Post(':id/arrive')
  @RequirePermission(MODULE, 'update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark truck as ARRIVED, set gate weight, auto-create estimated purchase entry' })
  markArrived(
    @Param('id') id: string,
    @Body() dto: MarkArrivedDto,
    @CurrentFirmId() firmId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.markArrived(id, dto, firmId, user.sub);
  }

  @Post(':id/close')
  @RequirePermission(MODULE, 'update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close truck — finalize weight, rate, inam. Publishes TRUCK_CLOSED event.' })
  close(
    @Param('id') id: string,
    @Body() dto: CloseTruckDto,
    @CurrentFirmId() firmId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.closeTruck(id, dto, firmId, user.sub);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a SCHEDULED truck (no financial records). Cannot delete ARRIVED/CLOSED trucks.' })
  delete(@Param('id') id: string, @CurrentFirmId() firmId: string, @CurrentUser() user: JwtPayload) {
    return this.service.delete(id, firmId, user.sub);
  }
}
