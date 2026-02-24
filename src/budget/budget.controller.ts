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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BudgetService } from './budget.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { BudgetQueryDto } from './dto/budget-query.dto';

@ApiTags('budgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetController {
  constructor(private readonly service: BudgetService) {}

  @Post()
  @ApiOperation({ summary: 'Create a budget for a category/month' })
  create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateBudgetDto,
  ) {
    return this.service.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all budgets for a month' })
  findByMonth(
    @Request() req: { user: { id: string } },
    @Query() query: BudgetQueryDto,
  ) {
    return this.service.findByMonth(req.user.id, query.month, query.year);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get budget overview with actual spending' })
  getOverview(
    @Request() req: { user: { id: string } },
    @Query() query: BudgetQueryDto,
  ) {
    return this.service.getOverview(req.user.id, query.month, query.year);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a budget' })
  update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.service.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a budget' })
  remove(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.service.remove(id, req.user.id);
  }
}
