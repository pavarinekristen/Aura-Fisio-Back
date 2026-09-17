import { Inject, Injectable } from '@nestjs/common';
import { ResourceService } from '../../common/resource.service';
import { ProtocolsRepository } from './protocols.repository';
@Injectable()
export class ProtocolsService extends ResourceService {
  constructor(@Inject(ProtocolsRepository) repo: ProtocolsRepository) { super(repo); }
}
