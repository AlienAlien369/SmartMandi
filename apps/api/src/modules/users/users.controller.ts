import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, CurrentFirmId } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';

const MODULE = 'USERS';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Post()
  @RequirePermission(MODULE, 'create')
  @ApiOperation({ summary: 'Create a user for this firm' })
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
  @RequirePermission(MODULE, 'update')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentFirmId() firmId: string) {
    return this.service.update(id, dto, firmId);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user from this firm' })
  remove(@Param('id') id: string, @CurrentFirmId() firmId: string) {
    return this.service.delete(id, firmId);
  }

  /** Register or update FCM push token for the current user */
  @Post('fcm-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Register FCM push notification token' })
  async updateFcmToken(
    @Body() body: { fcm_token: string },
    @CurrentUser() user: JwtPayload,
  ) {
    await this.service.updateFcmToken(user.sub, body.fcm_token);
  }
}
