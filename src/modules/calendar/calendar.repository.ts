import { Inject, Injectable } from '@nestjs/common';
import { ResourceRepository } from '../../common/resource.repository';
import { PrismaService } from '../../database/prisma.service';
@Injectable()
export class CalendarRepository extends ResourceRepository {
  constructor(@Inject(PrismaService) db: PrismaService) { super(db); }
}
