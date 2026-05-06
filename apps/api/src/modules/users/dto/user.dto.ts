import {
  IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums';

export class CreateUserDto {
  @ApiProperty({ example: '9876543210' })
  @IsString() @IsNotEmpty() @MaxLength(15)
  phone: string;

  @ApiProperty({ example: 'Ravi Sharma' })
  @IsString() @IsNotEmpty() @MaxLength(100)
  name: string;

  @ApiProperty({ enum: UserRole, default: UserRole.OPERATOR })
  @IsEnum(UserRole)
  role: UserRole;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional() @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  is_active?: boolean;
}
