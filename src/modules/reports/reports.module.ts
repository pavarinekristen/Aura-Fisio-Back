import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ResourceRepository } from '../../common/resource.repository';
@Module({ controllers: [ReportsController], providers: [ReportsService, ResourceRepository] })
export class ReportsModule {}
