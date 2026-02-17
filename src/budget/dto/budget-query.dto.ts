import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class BudgetQueryDto {
  @ApiProperty({ example: 2, description: 'Month (1-12)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ example: 2026, description: 'Year' })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;
}
