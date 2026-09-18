import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { isStaff, type Principal } from './http';
import { configFor, listQuerySchema, type ResourceKey } from './resources';
import { ResourceRepository, type Row, type Where } from './resource.repository';

@Injectable()
export class ResourceService {
  constructor(@Inject(ResourceRepository) protected repo: ResourceRepository) {}
  scope(key: ResourceKey, actor: Principal): Where {
    const cfg = configFor(key);
    if (cfg.staffOnly && !isStaff(actor)) throw new ForbiddenException();
    return {
      ...(cfg.soft ? { is_deleted: false } : {}),
      ...(!isStaff(actor) || cfg.ownStaff ? { [cfg.owner]: actor.id } : {}),
      ...(key === 'calendar_events' && !isStaff(actor) ? { is_published: true } : {}),
    };
  }
  filters(key: ResourceKey, raw: unknown) {
    const input = listQuerySchema.parse(raw);
    const cfg = configFor(key);
    const allowed = new Set(['id', 'created_at', ...Object.keys(cfg.schema.shape)]);
    if (key === 'workout_checkins') allowed.add('checked_at');
    if (key === 'patient_alerts') { allowed.add('patient_id'); allowed.add('professional_id'); }
    const where: Where = {};
    for (const [name, value] of Object.entries(input)) {
      if (['order_by', 'order_dir', 'limit'].includes(name)) continue;
      const match = name.match(/^(.*)_(gte|lte|in)$/);
      const field = match?.[1] ?? name;
      if (!allowed.has(field)) throw new BadRequestException(`Filtro inválido: ${name}`);
      where[field] = match ? { ...(where[field] as object), [match[2]]: value } : value;
    }
    if (input.order_by && !allowed.has(input.order_by)) throw new BadRequestException('Ordenação inválida.');
    return { where, orderBy: input.order_by ? { [input.order_by]: input.order_dir } : undefined, take: input.limit };
  }
  list(key: ResourceKey, actor: Principal, raw: unknown) {
    const query = this.filters(key, raw);
    return this.repo.list(key, { AND: [this.scope(key, actor), query.where] }, query.orderBy, query.take);
  }
  /** `protected` para que os executores da Aura herdem estas regras em vez de duplicá-las. */
  protected async prepare(key: ResourceKey, actor: Principal, raw: unknown, patch: boolean, tx: Prisma.TransactionClient, existing?: Row): Promise<Row> {
    const cfg = configFor(key);
    if (!isStaff(actor) && !cfg.patientWrite) throw new ForbiddenException();
    if (key === 'patient_alerts') {
      if (!patch || !isStaff(actor)) throw new ForbiddenException();
      return z.object({ is_read: z.boolean() }).strict().parse(raw);
    }
    if (key === 'patient_notifications' && patch) return z.object({ is_read: z.boolean().optional(), is_dismissed: z.boolean().optional() }).strict().parse(raw);
    if (key === 'patient_notifications' && !isStaff(actor)) throw new ForbiddenException('Notificações são geradas pelo servidor.');
    if (key === 'workout_checkins' && patch) throw new ForbiddenException();
    const parsed = (patch ? cfg.schema.partial() : cfg.schema).parse(raw) as Row;
    if (!isStaff(actor)) {
      if (parsed[cfg.owner] && parsed[cfg.owner] !== actor.id) throw new ForbiddenException();
      if (parsed.is_deleted !== undefined) throw new ForbiddenException();
      parsed[cfg.owner] = actor.id;
    }
    if (existing && parsed[cfg.owner] && parsed[cfg.owner] !== existing[cfg.owner]) throw new BadRequestException('Não é possível trocar o titular do registro.');
    if ('professional_id' in cfg.schema.shape) {
      if (!patch) parsed.professional_id = actor.id;
      else delete parsed.professional_id;
    }
    const ownerId = parsed[cfg.owner] ?? existing?.[cfg.owner];
    if (ownerId) {
      const owner = await tx.user.findUnique({ where: { id: String(ownerId) } });
      if (!owner || (cfg.owner === 'patient_id' && owner.role !== 'patient')) throw new BadRequestException('Paciente inválido.');
    }
    if (key === 'calendar_events') {
      const start = parsed.start_date ?? existing?.start_date;
      const end = parsed.end_date ?? existing?.end_date;
      if (!(start instanceof Date) || !(end instanceof Date) || end <= start) throw new BadRequestException('O fim deve ser posterior ao início.');
    }
    if (key === 'clinical_metrics' && parsed.session_id) {
      const session = await tx.clinicalSession.findFirst({ where: { id: String(parsed.session_id), patient_id: String(ownerId), is_deleted: false } });
      if (!session) throw new BadRequestException('Sessão não pertence ao paciente.');
    }
    if (key === 'workout_checkins') {
      const plan = await tx.treatmentPlan.findFirst({ where: { id: String(parsed.treatment_plan_id), patient_id: String(ownerId), is_deleted: false, is_active: true } });
      if (!plan) throw new BadRequestException('Exercício não disponível para este paciente.');
    }
    if (parsed.is_deleted === true) parsed.deleted_at = new Date();
    return parsed;
  }
  async create(key: ResourceKey, actor: Principal, body: unknown) {
    this.scope(key, actor);
    const rows = Array.isArray(body) ? z.array(z.unknown()).min(1).max(200).parse(body) : [body];
    const data = await this.repo.db.$transaction(async tx => {
      const saved: Row[] = [];
      for (const raw of rows) {
        const parsed = await this.prepare(key, actor, raw, false, tx);
        const row = await this.repo.delegate(key, tx).create({ data: parsed });
        saved.push(row);
        if (key === 'workout_checkins' && Number(parsed.pain_reported) >= 7) {
          const plan = await tx.treatmentPlan.findUniqueOrThrow({ where: { id: String(parsed.treatment_plan_id) } });
          const profile = await tx.profile.findUnique({ where: { user_id: String(parsed.patient_id) } });
          await tx.patientAlert.create({ data: { patient_id: plan.patient_id, professional_id: plan.professional_id, message: `Paciente ${profile?.full_name ?? ''} reportou dor ${parsed.pain_reported}/10 durante exercício.` } });
        }
      }
      return saved;
    });
    return { data, error: null };
  }
  async update(key: ResourceKey, actor: Principal, query: unknown, body: unknown) {
    const { where } = this.filters(key, query);
    const scope = this.scope(key, actor);
    if (!where.id && !(key === 'patient_intake' || key === 'profiles') && key !== 'patient_notifications') throw new BadRequestException('Informe o identificador.');
    if ((key === 'patient_intake' || key === 'profiles') && !where.id && !where.user_id) throw new BadRequestException('Informe o usuário.');
    if (key === 'patient_notifications' && !where.id && where.patient_id !== actor.id) throw new ForbiddenException();
    return this.repo.db.$transaction(async tx => {
      const model = this.repo.delegate(key, tx);
      const matches = await model.findMany({ where: { AND: [scope, where] } });
      if (!matches.length && where.id) throw new NotFoundException();
      const data = [];
      for (const row of matches) {
        const parsed = await this.prepare(key, actor, body, true, tx, row);
        data.push(await model.update({ where: { id: row.id }, data: parsed }));
      }
      return { data, error: null };
    });
  }
  async remove(key: ResourceKey, actor: Principal, query: unknown) {
    const { where } = this.filters(key, query);
    if (!where.id || !isStaff(actor)) throw new ForbiddenException();
    if (configFor(key).soft) return this.update(key, actor, query, { is_deleted: true });
    if (key !== 'protocol_templates' && key !== 'calendar_events') throw new ForbiddenException();
    return this.repo.db.$transaction(async tx => {
      const model = this.repo.delegate(key, tx);
      const row = await model.findFirst({ where: { AND: [this.scope(key, actor), where] } });
      if (!row) throw new NotFoundException();
      await model.delete({ where: { id: row.id } });
      return { data: [], error: null };
    });
  }
  async publish(actor: Principal, body: unknown) {
    if (!isStaff(actor)) throw new ForbiddenException();
    const rows = z.array(z.record(z.unknown())).min(1).max(200).parse(body);
    return this.repo.db.$transaction(async tx => {
      const saved: Row[] = [];
      for (const raw of rows) {
        const { id, ...data } = raw;
        const existing = id ? await this.repo.delegate('calendar_events', tx).findFirst({ where: { id: z.string().uuid().parse(id) } }) : null;
        if (id && !existing) throw new NotFoundException('Evento não encontrado.');
        const parsed = await this.prepare('calendar_events', actor, { ...data, is_published: true }, !!existing, tx, existing ?? undefined);
        const row = existing ? await this.repo.delegate('calendar_events', tx).update({ where: { id }, data: parsed }) : await this.repo.delegate('calendar_events', tx).create({ data: parsed });
        saved.push(row);
      }
      return { data: saved, error: null };
    });
  }
}
