import { Module } from '@nestjs/common';
import { TreatmentsController } from './treatments.controller';
import { TreatmentsService } from './treatments.service';
import { TreatmentsRepository } from './treatments.repository';
@Module({ controllers: [TreatmentsController], providers: [TreatmentsService, TreatmentsRepository], exports: [TreatmentsService] })
export class TreatmentsModule {}
