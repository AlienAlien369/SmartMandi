import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Ramesh Kumar' })
  @IsString() @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false, example: '+919876543210' })
  @IsString() @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsString() @IsOptional()
  address?: string;

  @ApiProperty({ required: false, type: Object })
  @IsObject() @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateCustomerDto {
  @ApiProperty({ required: false })
  @IsString() @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString() @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsString() @IsOptional()
  address?: string;
}
