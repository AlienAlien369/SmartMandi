import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentFirmId } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserRole } from '../../common/enums';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Post()
  @Roles(UserRole.FIRM_HEAD)
  @ApiOperation({ summary: 'Create a user for this firm (FIRM_HEAD only)' })
  create(@Body() dto: CreateUserDto, @CurrentFirmId() firmId: string, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, firmId, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List all users for this firm' })
  findAll(@CurrentFirmId() firmId: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.service.findAll(firmId, page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentFirmId() firmId: string) {
    return this.service.findOne(id, firmId);
  }

  @Patch(':id')
  @Roles(UserRole.FIRM_HEAD)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentFirmId() firmId: string) {
    return this.service.update(id, dto, firmId);
  }

  @Delete(':id')
  @Roles(UserRole.FIRM_HEAD)
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(@Param('id') id: string, @CurrentFirmId() firmId: string) {
    return this.service.deactivate(id, firmId);
  }
}
