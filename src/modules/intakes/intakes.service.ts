import { Inject, Injectable } from '@nestjs/common';
import { ResourceService } from '../../common/resource.service';
import { IntakesRepository } from './intakes.repository';
@Injectable()
export class IntakesService extends ResourceService {
  constructor(@Inject(IntakesRepository) repo: IntakesRepository) { super(repo); }
}
