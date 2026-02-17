import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@Injectable()
export class BudgetService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateBudgetDto) {
    const existing = await this.prisma.budget.findUnique({
      where: {
        userId_category_month_year: {
          userId,
          category: dto.category,
          month: dto.month,
          year: dto.year,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Budget for "${dto.category}" in ${dto.month}/${dto.year} already exists`,
      );
    }

    return this.prisma.budget.create({
      data: { ...dto, userId },
    });
  }

  findByMonth(userId: string, month: number, year: number) {
    return this.prisma.budget.findMany({
      where: { userId, month, year },
      orderBy: { category: 'asc' },
    });
  }

  async getOverview(userId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const [budgets, expenses] = await Promise.all([
      this.prisma.budget.findMany({
        where: { userId, month, year },
      }),
      this.prisma.expense.findMany({
        where: {
          userId,
          date: { gte: startDate, lt: endDate },
        },
      }),
    ]);

    const spentByCategory: Record<string, number> = {};
    for (const expense of expenses) {
      spentByCategory[expense.category] =
        (spentByCategory[expense.category] || 0) + Number(expense.amount);
    }

    const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
    const totalSpent = Object.values(spentByCategory).reduce((sum, v) => sum + v, 0);

    const categories = budgets.map((budget) => {
      const spent = spentByCategory[budget.category] || 0;
      const amount = Number(budget.amount);
      const percentage = amount > 0 ? Math.round((spent / amount) * 100) : 0;

      return {
        id: budget.id,
        category: budget.category,
        budget: amount,
        spent,
        remaining: amount - spent,
        percentage,
      };
    });

    return {
      month,
      year,
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      categories,
    };
  }

  async update(id: string, userId: string, dto: UpdateBudgetDto) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    return this.prisma.budget.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, userId: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    return this.prisma.budget.delete({ where: { id } });
  }
}
