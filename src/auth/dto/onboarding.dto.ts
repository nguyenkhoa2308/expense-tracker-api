import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsNumber, IsArray, ValidateNested, Min } from 'class-validator';

class BudgetItemDto {
  @ApiProperty({ example: 'food' })
  @IsString()
  category: string;

  @ApiProperty({ example: 2000000 })
  @IsNumber()
  @Min(0)
  amount: number;
}

export class OnboardingDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 15000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salary?: number;

  @ApiPropertyOptional({ type: [BudgetItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetItemDto)
  budgets?: BudgetItemDto[];
}
