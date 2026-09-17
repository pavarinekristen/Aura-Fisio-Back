import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { hash } from 'argon2';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { isStaff, type Principal } from '../../common/http';

export const createUserSchema = z.object({
  email: z.string().email().max(254).transform(v => v.toLowerCase().trim()),
  full_name: z.string().trim().min(1).max(200),
  phone: z.string().max(40).optional(),
  password: z.string().min(8).max(256),
  role: z.enum(['professional', 'patient']).default('patient'),
}).strict();

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private db: PrismaService) {}
  async create(actor: Principal, body: unknown, patientsOnly = false) {
    const input = createUserSchema.parse(body);
    if (!isStaff(actor) || (actor.role !== 'admin' && input.role !== 'patient') || (patientsOnly && input.role !== 'patient')) throw new ForbiddenException();
    const user = await this.db.user.create({ data: {
      email: input.email, password_hash: await hash(input.password), role: input.role,
      profile: { create: { full_name: input.full_name, phone: input.phone, intake_completed: true } },
    }, select: { id: true, email: true, role: true, profile: true } });
    return { user_id: user.id, email: user.email, role: user.role, full_name: user.profile?.full_name };
  }
  async roles(actor: Principal, role?: string) {
    const users = await this.db.user.findMany({ where: {
      ...(isStaff(actor) ? {} : { id: actor.id }),
      ...(role === 'professional' ? { role: { in: ['admin', 'professional'] } } : role === 'patient' ? { role: 'patient' } : {}),
    }, select: { id: true, role: true } });
    return users.map(u => ({ user_id: u.id, role: u.role }));
  }
}
