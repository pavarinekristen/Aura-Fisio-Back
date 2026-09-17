import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarRepository } from './calendar.repository';
@Module({ controllers: [CalendarController], providers: [CalendarService, CalendarRepository], exports: [CalendarService] })
export class CalendarModule {}
