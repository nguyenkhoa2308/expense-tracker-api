import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IncomeService } from './income.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { PaginationQueryDto, StatsQueryDto } from '../common/dto';

@ApiTags('incomes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incomes')
export class IncomeController {
  constructor(private readonly service: IncomeService) {}

  @Post()
  @ApiOperation({ summary: 'Create new income' })
  create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateIncomeDto,
  ) {
    return this.service.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated incomes for current user' })
  findPaginated(
    @Request() req: { user: { id: string } },
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.findPaginated(req.user.id, query);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all incomes (for reports/charts)' })
  findAll(@Request() req: { user: { id: string } }) {
    return this.service.findAllByUser(req.user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get income statistics' })
  getStats(
    @Request() req: { user: { id: string } },
    @Query() query: StatsQueryDto,
  ) {
    return this.service.getStats(req.user.id, query);
  }

  @Get('export/csv')
  @ApiOperation({ summary: 'Export incomes as CSV' })
  async exportCsv(
    @Request() req: { user: { id: string } },
    @Query() query: StatsQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportCsv(req.user.id, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=incomes.csv');
    res.send('\uFEFF' + csv);
  }

  @Get('export/pdf')
  @ApiOperation({ summary: 'Export incomes as PDF report' })
  async exportPdf(
    @Request() req: { user: { id: string } },
    @Query() query: StatsQueryDto,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.service.exportPdf(req.user.id, query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=bao-cao-thu-nhap.pdf',
    );
    res.send(pdfBuffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get income by ID' })
  findOne(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.service.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update income' })
  update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateIncomeDto,
  ) {
    return this.service.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete income' })
  remove(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.service.remove(id, req.user.id);
  }
}
