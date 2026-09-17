import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { UsersModule } from './modules/users/users.module';
import { PatientsCreateController } from './modules/patients/patients-create.controller';
import { NotificationStreamController } from './modules/notifications/notification-stream.controller';
import { AiModule } from './modules/ai/ai.module';
import { ReportsModule } from './modules/reports/reports.module';
import { HealthController } from './common/health.controller';
import { PatientsModule } from './modules/patients/patients.module';
import { IntakesModule } from './modules/intakes/intakes.module';
import { TreatmentsModule } from './modules/treatments/treatments.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { CheckinsModule } from './modules/checkins/checkins.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { ProtocolsModule } from './modules/protocols/protocols.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CalendarModule } from './modules/calendar/calendar.module';
@Module({ imports: [DatabaseModule, AuthModule, UsersModule, AiModule, ReportsModule, PatientsModule, IntakesModule, TreatmentsModule, SessionsModule, MetricsModule, CheckinsModule, AlertsModule, ProtocolsModule, NotificationsModule, CalendarModule],
  controllers: [PatientsCreateController, NotificationStreamController, HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
