import { Module } from '@nestjs/common';
import { CheckinsController } from './checkins.controller';
import { CheckinsService } from './checkins.service';
import { CheckinsRepository } from './checkins.repository';
@Module({ controllers: [CheckinsController], providers: [CheckinsService, CheckinsRepository], exports: [CheckinsService] })
export class CheckinsModule {}
