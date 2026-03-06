import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoalService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, createGoalDto: CreateGoalDto) {
    return this.prisma.goal.create({
      data: {
        ...createGoalDto,
        deadline: new Date(createGoalDto.deadline),
        userId,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.goal.findMany({
      where: { userId },
      include: { contributions: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string, userId: string) {
    return this.prisma.goal.findUnique({
      where: { id, userId },
      include: { contributions: true },
    });
  }

  update(id: string, userId: string, updateGoalDto: UpdateGoalDto) {
    return this.prisma.goal.update({
      where: { id, userId },
      data: updateGoalDto,
    });
  }

  remove(id: string, userId: string) {
    return this.prisma.goal.delete({
      where: { id, userId },
    });
  }

  async addContribution(goalId: string, userId: string, amount: number) {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    const contribution = await this.prisma.goalContribution.create({
      data: {
        amount,
        goalId: goal.id,
      },
    });

    const result = await this.prisma.goalContribution.aggregate({
      where: { goalId: goal.id },
      _sum: { amount: true },
    });

    const totalContributed = Number(result._sum.amount ?? 0);
    const totalAmount = totalContributed + Number(goal.initialAmount);

    if (totalAmount >= Number(goal.amount)) {
      await this.prisma.goal.update({
        where: { id: goal.id },
        data: { status: 'COMPLETED' },
      });
    }

    return contribution;
  }
}
