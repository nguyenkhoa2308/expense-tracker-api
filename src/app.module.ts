import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ExpenseModule } from './expense/expense.module';
import { IncomeModule } from './income/income.module';
import { EmailSyncModule } from './email-sync/email-sync.module';
import { AiModule } from './ai/ai.module';
import { NotificationModule } from './notification/notification.module';
import { BudgetModule } from './budget/budget.module';
import { RecurringModule } from './recurring/recurring.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UserModule,
    ExpenseModule,
    IncomeModule,
    BudgetModule,
    RecurringModule,
    EmailSyncModule,
    AiModule,
    NotificationModule,
    StatsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
