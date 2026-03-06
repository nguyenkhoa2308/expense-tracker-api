import { Test, TestingModule } from '@nestjs/testing';
import { GoalService } from './goal.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GoalService', () => {
  let service: GoalService;
  let prisma: {
    goal: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    goalContribution: { create: jest.Mock; aggregate: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      goal: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      goalContribution: {
        create: jest.fn(),
        aggregate: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoalService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<GoalService>(GoalService);
  });

  describe('create', () => {
    it('should create a goal with userId', async () => {
      const mockGoal = {
        id: 'goal-1',
        name: 'Save for vacation',
        amount: 100000,
        initialAmount: 0,
        userId: 'user-1',
        deadline: new Date('2026-03-01'),
      };
      prisma.goal.create.mockResolvedValue(mockGoal);

      const result = await service.create('user-1', {
        name: 'Save for vacation',
        amount: 100000,
        initialAmount: 0,
        deadline: '2026-03-01',
      });
      expect(result).toEqual(mockGoal);
      expect(prisma.goal.create).toHaveBeenCalledWith({
        data: {
          name: 'Save for vacation',
          amount: 100000,
          initialAmount: 0,
          userId: 'user-1',
          deadline: new Date('2026-03-01'),
        },
      });
    });
  });

  describe('addContribution', () => {
    it('should add contribution and return total contributed', async () => {
      const mockGoal = {
        id: 'goal-1',
        name: 'Save for vacation',
        amount: 100000,
        initialAmount: 0,
        userId: 'user-1',
        deadline: new Date('2026-03-01'),
      };
      prisma.goal.findUnique.mockResolvedValue(mockGoal);
      prisma.goalContribution.create.mockResolvedValue({
        id: 'contribution-1',
        amount: 50000,
        goalId: 'goal-1',
      });
      prisma.goalContribution.aggregate.mockResolvedValue({
        _sum: { amount: 50000 },
      });

      const result = await service.addContribution('goal-1', 'user-1', 50000);

      expect(result).toEqual({
        id: 'contribution-1',
        amount: 50000,
        goalId: 'goal-1',
      });
    });

    it('should throw NotFoundException when goal not found', async () => {
      prisma.goal.findUnique.mockResolvedValue(null);

      await expect(
        service.addContribution('goal-1', 'user-1', 50000),
      ).rejects.toThrow('Goal not found');
    });

    it('should update status to COMPLETE when total reaches goal amount', async () => {
      prisma.goal.findUnique.mockResolvedValue({
        id: 'goal-1',
        name: 'Save for vacation',
        amount: 100000,
        initialAmount: 50000,
        userId: 'user-1',
        deadline: new Date('2026-03-01'),
      });
      prisma.goalContribution.create.mockResolvedValue({
        id: 'contribution-1',
        amount: 60000,
        goalId: 'goal-1',
      });

      prisma.goalContribution.aggregate.mockResolvedValue({
        _sum: { amount: 60000 },
      });

      await service.addContribution('goal-1', 'user-1', 60000);

      expect(prisma.goal.update).toHaveBeenCalledWith({
        where: { id: 'goal-1' },
        data: { status: 'COMPLETED' },
      });
    });
  });
});
