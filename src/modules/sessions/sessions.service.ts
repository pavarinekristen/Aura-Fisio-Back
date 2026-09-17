import { Inject, Injectable } from '@nestjs/common';
import { ResourceService } from '../../common/resource.service';
import { SessionsRepository } from './sessions.repository';
@Injectable()
export class SessionsService extends ResourceService {
  constructor(@Inject(SessionsRepository) repo: SessionsRepository) { super(repo); }
}
