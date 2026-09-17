import { Inject, Injectable } from '@nestjs/common';
import { ResourceService } from '../../common/resource.service';
import { PatientsRepository } from './patients.repository';
@Injectable()
export class PatientsService extends ResourceService {
  constructor(@Inject(PatientsRepository) repo: PatientsRepository) { super(repo); }
}
