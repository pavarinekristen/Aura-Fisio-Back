import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsRepository } from './metrics.repository';
@Module({ controllers: [MetricsController], providers: [MetricsService, MetricsRepository], exports: [MetricsService] })
export class MetricsModule {}
