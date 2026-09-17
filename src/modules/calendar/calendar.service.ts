import { Inject, Injectable } from '@nestjs/common';
import { ResourceService } from '../../common/resource.service';
import { CalendarRepository } from './calendar.repository';
@Injectable()
export class CalendarService extends ResourceService {
  constructor(@Inject(CalendarRepository) repo: CalendarRepository) { super(repo); }
}
