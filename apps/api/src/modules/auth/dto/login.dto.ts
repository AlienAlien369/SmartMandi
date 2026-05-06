import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString() @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString() @IsNotEmpty() @MinLength(6)
  otp: string;

  @ApiProperty({ example: 'uuid-of-firm' })
  @IsString() @IsNotEmpty()
  firm_id: string;

  @ApiProperty({ required: false })
  @IsString() @IsOptional()
  device_id?: string;
}
