import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { configFor, type ResourceKey } from './resources';

export type Row = Record<string, unknown>;
export type Where = Record<string, unknown>;
interface Delegate {
  findMany(args: object): Promise<Row[]>;
  findFirst(args: object): Promise<Row | null>;
  count(args: object): Promise<number>;
  create(args: object): Promise<Row>;
  update(args: object): Promise<Row>;
  delete(args: object): Promise<Row>;
  updateMany(args: object): Promise<{ count: number }>;
}

@Injectable()
export class ResourceRepository {
  constructor(@Inject(PrismaService) readonly db: PrismaService) {}
  delegate(key: ResourceKey, tx: Prisma.TransactionClient = this.db): Delegate {
    return (tx as unknown as Record<string, Delegate>)[configFor(key).model];
  }
  list(key: ResourceKey, where: Where, orderBy: object | undefined, take: number) {
    return this.db.$transaction(async tx => {
      const model = this.delegate(key, tx);
      const data = await model.findMany({ where, orderBy, take, ...(key === 'profiles' ? { include: { user: { select: { role: true } } } } : {}) });
      return { data: data.map(row => {
        for (const field of ['session_date', 'date_of_birth']) {
          if (row[field] instanceof Date) row[field] = (row[field] as Date).toISOString().slice(0, 10);
        }
        if (row.metric_value != null) row.metric_value = Number(row.metric_value);
        if (key !== 'profiles') return row;
        const { user, ...profile } = row;
        return { ...profile, role: (user as { role: string }).role };
      }), count: await model.count({ where }), error: null };
    });
  }
}
