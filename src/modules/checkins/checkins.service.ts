import { Inject, Injectable } from '@nestjs/common';
import { ResourceService } from '../../common/resource.service';
import { CheckinsRepository } from './checkins.repository';
@Injectable()
export class CheckinsService extends ResourceService {
  constructor(@Inject(CheckinsRepository) repo: CheckinsRepository) { super(repo); }
}
