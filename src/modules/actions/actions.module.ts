import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';
import { ActionsRepository } from './actions.repository';
import { PatientMatcher } from './patient-matcher';
@Module({
  imports: [UsersModule],
  controllers: [ActionsController],
  providers: [ActionsService, ActionsRepository, PatientMatcher],
  exports: [ActionsService, PatientMatcher],
})
export class ActionsModule {}
