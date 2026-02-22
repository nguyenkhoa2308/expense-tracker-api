import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BudgetService', () => {
  let service: BudgetService;
  let prisma: {
    budget: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    expense: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      budget: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      expense: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<BudgetService>(BudgetService);
  });

  describe('create', () => {
    it('should create a budget when no duplicate exists', async () => {
      const mockBudget = {
        id: 'b-1',
        category: 'food',
        amount: 2000000,
        month: 2,
        year: 2026,
        userId: 'user-1',
      };
      prisma.budget.findUnique.mockResolvedValue(null);
      prisma.budget.create.mockResolvedValue(mockBudget);

      const result = await service.create('user-1', {
        category: 'food',
        amount: 2000000,
        month: 2,
        year: 2026,
      });

      expect(result).toEqual(mockBudget);
      expect(prisma.budget.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when budget already exists', async () => {
      prisma.budget.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create('user-1', {
          category: 'food',
          amount: 2000000,
          month: 2,
          year: 2026,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getOverview', () => {
    it('should calculate correct percentage for over-budget category', async () => {
      prisma.budget.findMany.mockResolvedValue([
        { id: 'b-1', category: 'food', amount: 1000000 },
      ]);
      prisma.expense.findMany.mockResolvedValue([
        { category: 'food', amount: 1200000 },
      ]);

      const result = await service.getOverview('user-1', 2, 2026);

      expect(result.categories[0].percentage).toBe(120);
      expect(result.categories[0].remaining).toBe(-200000);
      expect(result.totalSpent).toBe(1200000);
      expect(result.totalBudget).toBe(1000000);
    });
  });
});
