import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SalaryService } from './salary.service';
import { CreateSalaryEntryDto } from './dto/salary.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentFirmId } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserRole } from '../../common/enums';

@ApiTags('salary')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('salary')
export class SalaryController {
  constructor(private readonly service: SalaryService) {}

  @Post()
  @Roles(UserRole.FIRM_HEAD)
  @ApiOperation({ summary: 'Record salary payment — writes FIRM_CASH DEBIT + USER_SALARY CREDIT' })
  create(@Body() dto: CreateSalaryEntryDto, @CurrentFirmId() firmId: string, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, firmId, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List salary entries' })
  findAll(
    @CurrentFirmId() firmId: string,
    @Query('user_id') user_id?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll(firmId, { user_id, from, to, page, limit });
  }
}
