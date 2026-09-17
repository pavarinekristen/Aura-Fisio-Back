import { Module } from '@nestjs/common';
import { IntakesController } from './intakes.controller';
import { IntakesService } from './intakes.service';
import { IntakesRepository } from './intakes.repository';
@Module({ controllers: [IntakesController], providers: [IntakesService, IntakesRepository], exports: [IntakesService] })
export class IntakesModule {}
