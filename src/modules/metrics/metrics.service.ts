import { Inject, Injectable } from '@nestjs/common';
import { ResourceService } from '../../common/resource.service';
import { MetricsRepository } from './metrics.repository';
@Injectable()
export class MetricsService extends ResourceService {
  constructor(@Inject(MetricsRepository) repo: MetricsRepository) { super(repo); }
}
