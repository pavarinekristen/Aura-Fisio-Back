import { Inject, Injectable } from '@nestjs/common';
import { ResourceService } from '../../common/resource.service';
import { AlertsRepository } from './alerts.repository';
@Injectable()
export class AlertsService extends ResourceService {
  constructor(@Inject(AlertsRepository) repo: AlertsRepository) { super(repo); }
}
