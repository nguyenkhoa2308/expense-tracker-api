import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateIncomeDto {
  @ApiProperty({ example: 15000000, description: 'Amount in VND' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional({ example: 'Monthly salary' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'salary', description: 'Income category' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ example: '2025-12-10' })
  @IsDateString()
  @IsOptional()
  date?: string;
}
