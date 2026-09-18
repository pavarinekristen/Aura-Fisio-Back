import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'argon2';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
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

/**
 * Cadastro feito pela Aura: o paciente nasce como prontuário, sem e-mail nem senha.
 * O acesso ao app vem depois, por `invitePatient`.
 */
export const clinicalPatientSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().email().max(254).transform(v => v.toLowerCase().trim()).nullable().optional(),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter 11 dígitos.').nullable().optional(),
  date_of_birth: z.string().date().nullable().optional(),
}).strict();

/** Aceita tanto o client normal quanto o de dentro de uma `$transaction`. */
type Db = Prisma.TransactionClient | PrismaService;

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

  /** Cria paciente sem credenciais. Aceita uma transação para compor com o intake. */
  async createClinical(actor: Principal, body: unknown, tx: Db = this.db) {
    if (!isStaff(actor)) throw new ForbiddenException();
    const input = clinicalPatientSchema.parse(body);
    const user = await tx.user.create({ data: {
      email: input.email ?? null, password_hash: null, role: 'patient',
      profile: { create: {
        full_name: input.full_name,
        phone: input.phone ?? null,
        cpf: input.cpf ?? null,
        date_of_birth: input.date_of_birth ? new Date(input.date_of_birth) : null,
      } },
    }, select: { id: true, email: true, role: true, profile: true } });
    return { user_id: user.id, email: user.email, role: user.role, full_name: user.profile?.full_name ?? '' };
  }

  /**
   * Dá acesso ao app a um paciente que até então era só prontuário.
   * A senha em claro volta uma única vez na resposta: nunca é persistida nem logada.
   */
  async invitePatient(actor: Principal, patientId: string, email: string, tx: Db = this.db) {
    if (!isStaff(actor)) throw new ForbiddenException();
    const input = z.object({ patient_id: z.string().uuid(), email: z.string().email().max(254).transform(v => v.toLowerCase().trim()) })
      .strict().parse({ patient_id: patientId, email });
    const user = await tx.user.findUnique({ where: { id: input.patient_id }, select: { id: true, role: true, password_hash: true } });
    if (!user || user.role !== 'patient') throw new NotFoundException('Paciente não encontrado.');
    if (user.password_hash) throw new ConflictException('Este paciente já tem acesso ao app.');
    const password = randomBytes(9).toString('base64url');
    await tx.user.update({ where: { id: user.id }, data: { email: input.email, password_hash: await hash(password) } });
    return { user_id: user.id, email: input.email, temporary_password: password };
  }

  async roles(actor: Principal, role?: string) {
    const users = await this.db.user.findMany({ where: {
      ...(isStaff(actor) ? {} : { id: actor.id }),
      ...(role === 'professional' ? { role: { in: ['admin', 'professional'] } } : role === 'patient' ? { role: 'patient' } : {}),
    }, select: { id: true, role: true } });
    return users.map(u => ({ user_id: u.id, role: u.role }));
  }
}
