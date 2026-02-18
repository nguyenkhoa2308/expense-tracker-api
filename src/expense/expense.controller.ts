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
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { PaginationQueryDto, StatsQueryDto } from '../common/dto';

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpenseController {
  constructor(private readonly service: ExpenseService) {}

  @Post()
  @ApiOperation({ summary: 'Create new expense' })
  create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateExpenseDto,
  ) {
    return this.service.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated expenses for current user' })
  findPaginated(
    @Request() req: { user: { id: string } },
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.findPaginated(req.user.id, query);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all expenses (for reports/charts)' })
  findAll(@Request() req: { user: { id: string } }) {
    return this.service.findAllByUser(req.user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get expense statistics' })
  getStats(
    @Request() req: { user: { id: string } },
    @Query() query: StatsQueryDto,
  ) {
    return this.service.getStats(req.user.id, query);
  }

  @Get('export/csv')
  @ApiOperation({ summary: 'Export expenses as CSV' })
  async exportCsv(
    @Request() req: { user: { id: string } },
    @Query() query: StatsQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportCsv(req.user.id, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=expenses.csv');
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8
  }

  @Get('export/pdf')
  @ApiOperation({ summary: 'Export expenses as PDF report' })
  async exportPdf(
    @Request() req: { user: { id: string } },
    @Query() query: StatsQueryDto,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.service.exportPdf(req.user.id, query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=bao-cao-chi-tieu.pdf');
    res.send(pdfBuffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get expense by ID' })
  findOne(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.service.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update expense' })
  update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.service.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete expense' })
  remove(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.service.remove(id, req.user.id);
  }
}
