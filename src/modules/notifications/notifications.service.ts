import { Inject, Injectable } from '@nestjs/common';
import { ResourceService } from '../../common/resource.service';
import { NotificationsRepository } from './notifications.repository';
@Injectable()
export class NotificationsService extends ResourceService {
  constructor(@Inject(NotificationsRepository) repo: NotificationsRepository) { super(repo); }
}
