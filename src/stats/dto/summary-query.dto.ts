import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export enum SummaryType {
  ALL = 'all',
  EXPENSE = 'expense',
  INCOME = 'income',
}

export class SummaryQueryDto {
  @ApiPropertyOptional({ description: 'Type of summary', enum: SummaryType, default: SummaryType.ALL })
  @IsOptional()
  @IsEnum(SummaryType)
  type?: SummaryType = SummaryType.ALL;

  @ApiPropertyOptional({ description: 'Month (1-12)', minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ description: 'Year', minimum: 2020 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year?: number;

  @ApiPropertyOptional({ description: 'Filter from date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter to date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Minimum amount', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountMin?: number;

  @ApiPropertyOptional({ description: 'Maximum amount', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountMax?: number;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;
}
