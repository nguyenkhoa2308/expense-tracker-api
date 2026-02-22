import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Integration: Register → Login → Expense → Stats', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const testEmail = `test-${Date.now()}@integration.test`;
  const testPassword = 'Test123456';
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Cleanup test data
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (user) {
      await prisma.expense.deleteMany({ where: { userId: user.id } });
      await prisma.budget.deleteMany({ where: { userId: user.id } });
      await prisma.income.deleteMany({ where: { userId: user.id } });
      await prisma.notification.deleteMany({ where: { userId: user.id } });
      await prisma.chatMessage.deleteMany({ where: { userId: user.id } });
      await prisma.recurringTransaction.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  it('should register a new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: testEmail, password: testPassword, name: 'Integration Test' })
      .expect(201);

    expect(res.body).toHaveProperty('access_token');
    accessToken = res.body.access_token;
  });

  it('should login with created user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(201);

    expect(res.body).toHaveProperty('access_token');
    accessToken = res.body.access_token;
  });

  it('should create an expense', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 50000, category: 'food', description: 'Integration test expense' })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(Number(res.body.amount)).toBe(50000);
    expect(res.body.category).toBe('food');
  });

  it('should get stats with the created expense', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/expenses/stats')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(50000);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    expect(res.body.byCategory).toHaveProperty('food');
  });
});
