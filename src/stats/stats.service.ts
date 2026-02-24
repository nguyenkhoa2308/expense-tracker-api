import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SummaryType } from './dto/summary-query.dto';

export interface PeriodStats {
  total: number;
  byCategory: Record<string, number>;
  count: number;
}

export interface ExtraFilters {
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  category?: string;
}

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(
    userId: string,
    type: SummaryType,
    month: number,
    year: number,
    filters?: ExtraFilters,
  ) {
    const currentStart = new Date(year, month - 1, 1);
    const currentEnd = new Date(year, month, 1);

    // Previous month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const previousStart = new Date(prevYear, prevMonth - 1, 1);
    const previousEnd = new Date(prevYear, prevMonth, 1);

    const hasFilters =
      filters &&
      (filters.dateFrom ||
        filters.dateTo ||
        filters.amountMin !== undefined ||
        filters.amountMax !== undefined ||
        filters.category);

    let current: PeriodStats;
    let previous: PeriodStats;

    if (type === SummaryType.EXPENSE) {
      [current, previous] = await Promise.all([
        this.getExpenseStats(
          userId,
          currentStart,
          currentEnd,
          hasFilters ? filters : undefined,
        ),
        this.getExpenseStats(userId, previousStart, previousEnd),
      ]);
    } else if (type === SummaryType.INCOME) {
      [current, previous] = await Promise.all([
        this.getIncomeStats(
          userId,
          currentStart,
          currentEnd,
          hasFilters ? filters : undefined,
        ),
        this.getIncomeStats(userId, previousStart, previousEnd),
      ]);
    } else {
      const [curExp, curInc, prevExp, prevInc] = await Promise.all([
        this.getExpenseStats(
          userId,
          currentStart,
          currentEnd,
          hasFilters ? filters : undefined,
        ),
        this.getIncomeStats(
          userId,
          currentStart,
          currentEnd,
          hasFilters ? filters : undefined,
        ),
        this.getExpenseStats(userId, previousStart, previousEnd),
        this.getIncomeStats(userId, previousStart, previousEnd),
      ]);

      const change =
        prevInc.total - prevExp.total !== 0
          ? ((curInc.total - curExp.total - (prevInc.total - prevExp.total)) /
              Math.abs(prevInc.total - prevExp.total)) *
            100
          : 0;

      return {
        current: {
          expense: curExp,
          income: curInc,
          balance: curInc.total - curExp.total,
        },
        previous: {
          expense: prevExp,
          income: prevInc,
          balance: prevInc.total - prevExp.total,
        },
        change: Math.round(change * 100) / 100,
      };
    }

    const change =
      previous.total !== 0
        ? ((current.total - previous.total) / Math.abs(previous.total)) * 100
        : 0;

    return {
      current,
      previous,
      change: Math.round(change * 100) / 100,
    };
  }

  private buildExtraWhere(filters?: ExtraFilters) {
    const extra: Record<string, unknown> = {};
    if (!filters) return extra;

    if (filters.category) {
      extra.category = filters.category;
    }

    if (filters.dateFrom || filters.dateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        dateFilter.lt = endDate;
      }
      extra.date = dateFilter;
    }

    if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
      const amountFilter: Prisma.DecimalFilter = {};
      if (filters.amountMin !== undefined) amountFilter.gte = filters.amountMin;
      if (filters.amountMax !== undefined) amountFilter.lte = filters.amountMax;
      extra.amount = amountFilter;
    }

    return extra;
  }

  private async getExpenseStats(
    userId: string,
    start: Date,
    end: Date,
    filters?: ExtraFilters,
  ): Promise<PeriodStats> {
    const extraWhere = this.buildExtraWhere(filters);

    // If filters include custom date range, use that instead of month range
    const dateWhere = extraWhere.date ?? { gte: start, lt: end };
    delete extraWhere.date;

    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: dateWhere as Prisma.DateTimeFilter,
        ...extraWhere,
      },
    });

    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const byCategory: Record<string, number> = {};
    expenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
    });

    return { total, byCategory, count: expenses.length };
  }

  private async getIncomeStats(
    userId: string,
    start: Date,
    end: Date,
    filters?: ExtraFilters,
  ): Promise<PeriodStats> {
    const extraWhere = this.buildExtraWhere(filters);

    const dateWhere = extraWhere.date ?? { gte: start, lt: end };
    delete extraWhere.date;

    const incomes = await this.prisma.income.findMany({
      where: {
        userId,
        date: dateWhere as Prisma.DateTimeFilter,
        ...extraWhere,
      },
    });

    const total = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const byCategory: Record<string, number> = {};
    incomes.forEach((i) => {
      byCategory[i.category] = (byCategory[i.category] || 0) + Number(i.amount);
    });

    return { total, byCategory, count: incomes.length };
  }
}
