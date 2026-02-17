import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StatsService } from './stats.service';
import { SummaryQueryDto, SummaryType } from './dto/summary-query.dto';

@ApiTags('stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly service: StatsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get monthly summary with previous month comparison' })
  getSummary(
    @Request() req: { user: { id: string } },
    @Query() query: SummaryQueryDto,
  ) {
    const now = new Date();
    const month = query.month ?? now.getMonth() + 1;
    const year = query.year ?? now.getFullYear();
    const type = query.type ?? SummaryType.ALL;

    return this.service.getSummary(req.user.id, type, month, year, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      amountMin: query.amountMin,
      amountMax: query.amountMax,
      category: query.category,
    });
  }
}
