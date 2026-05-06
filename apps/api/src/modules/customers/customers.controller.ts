import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentFirmId } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserRole } from '../../common/enums';

@ApiTags('customers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Post()
  @Roles(UserRole.FIRM_HEAD, UserRole.AUTHORIZER, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Create a new customer' })
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentFirmId() firmId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(dto, firmId, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List customers (with optional search)' })
  findAll(
    @CurrentFirmId() firmId: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll(firmId, { search, page, limit });
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get full purchase history + outstanding udhar for a customer' })
  getHistory(@Param('id') id: string, @CurrentFirmId() firmId: string) {
    return this.service.getCustomerHistory(id, firmId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  findOne(@Param('id') id: string, @CurrentFirmId() firmId: string) {
    return this.service.findOne(id, firmId);
  }

  @Patch(':id')
  @Roles(UserRole.FIRM_HEAD, UserRole.AUTHORIZER, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Update customer' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentFirmId() firmId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, firmId, user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.FIRM_HEAD)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a customer (Firm Head only)' })
  remove(
    @Param('id') id: string,
    @CurrentFirmId() firmId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.softDelete(id, firmId, user.sub);
  }
}
