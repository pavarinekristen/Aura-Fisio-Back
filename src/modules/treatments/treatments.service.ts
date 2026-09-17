import { Inject, Injectable } from '@nestjs/common';
import { ResourceService } from '../../common/resource.service';
import { TreatmentsRepository } from './treatments.repository';
@Injectable()
export class TreatmentsService extends ResourceService {
  constructor(@Inject(TreatmentsRepository) repo: TreatmentsRepository) { super(repo); }
}
