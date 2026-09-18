import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { isStaff, type Principal } from '../../common/http';
import { ResourceService } from '../../common/resource.service';
import { UsersService } from '../users/users.service';
import { ActionsRepository } from './actions.repository';
import { PatientMatcher } from './patient-matcher';
import { auraAction, diffFields, executeRequest, invitePatientPayload, planRequest, registerPatientPayload, type AuraAction } from './action.schemas';

/** Uma proposta vira sucata depois disso; o profissional pede de novo à Aura. */
const PLAN_TTL_MS = 30 * 60_000;

export interface ExecResult { ids: string[]; summary: string; [key: string]: unknown }

/**
 * Executa as ações que a Aura propõe.
 *
 * Estende `ResourceService` de propósito: `prepare()` já valida com o zod do
 * registry, força `professional_id = actor.id` e confere que o paciente existe.
 * Os executores herdam tudo isso em vez de reimplementar.
 */
@Injectable()
export class ActionsService extends ResourceService {
  constructor(
    @Inject(ActionsRepository) repo: ActionsRepository,
    @Inject(UsersService) private users: UsersService,
    @Inject(PatientMatcher) private matcher: PatientMatcher,
  ) { super(repo); }

  private get db() { return this.repo.db; }

  /**
   * Registra uma proposta sem passar pelo LLM. É o caminho que o frontend usa
   * quando já sabe o que quer (ex.: salvar um protocolo já gerado) e o que os
   * testes de integração exercitam.
   */
  async plan(actor: Principal, raw: unknown) {
    if (!isStaff(actor)) throw new ForbiddenException();
    const input = planRequest.parse(raw);
    const action = auraAction.parse({ type: input.type, data: input.data });
    return this.persistPlan(actor, action, {
      sourceText: input.source_text ?? '',
      model: 'none',
      intentSource: 'direct',
      extracted: {},
    });
  }

  /** Grava a proposta. Chamado pelo `/actions/plan` e pelo planejador da Aura. */
  async persistPlan(actor: Principal, action: AuraAction, meta: { sourceText: string; model: string; intentSource: string; extracted: unknown }) {
    const data = action.data as Record<string, unknown>;
    const patientId = typeof data.patient_id === 'string' ? data.patient_id : null;
    const plan = await this.db.auraActionPlan.create({
      data: {
        professional_id: actor.id,
        patient_id: patientId,
        type: action.type,
        source_text: meta.sourceText,
        model: meta.model,
        intent_source: meta.intentSource,
        extracted: (meta.extracted ?? {}) as Prisma.InputJsonValue,
        payload: data as Prisma.InputJsonValue,
        expires_at: new Date(Date.now() + PLAN_TTL_MS),
      },
      select: { id: true, expires_at: true },
    });
    return { plan_id: plan.id, expires_at: plan.expires_at, action };
  }

  /**
   * Confirma e grava. A proposta não é confiável — o profissional pode ter
   * editado o card — então tudo é revalidado aqui, do zod à autorização.
   */
  async execute(actor: Principal, raw: unknown) {
    if (!isStaff(actor)) throw new ForbiddenException();
    const input = executeRequest.parse(raw);
    const parsed = auraAction.parse(input.action);

    return this.db.$transaction(async tx => {
      const plan = await tx.auraActionPlan.findFirst({ where: { id: input.plan_id, professional_id: actor.id } });
      if (!plan) throw new NotFoundException('Proposta não encontrada.');
      if (plan.expires_at <= new Date()) throw new BadRequestException('Proposta expirada. Peça novamente à Aura.');
      if (plan.type !== parsed.type) throw new BadRequestException('A ação confirmada não corresponde à proposta.');

      // Trava de idempotência: só executa quem conseguir mover 'pending' para
      // 'executed'. Um segundo clique bloqueia até o commit e depois encontra 0 linhas.
      const claimed = await tx.auraActionPlan.updateMany({
        where: { id: plan.id, status: 'pending' },
        data: { status: 'executed', executed_at: new Date() },
      });
      if (claimed.count !== 1) throw new ConflictException('Esta ação já foi executada.');

      // Se a execução falhar, o rollback desfaz também a marcação acima: o plano
      // volta a 'pending' e o profissional pode reconfirmar o mesmo card.
      const result = await this.run(tx, actor, parsed);
      await tx.auraActionPlan.update({
        where: { id: plan.id },
        data: {
          executed_payload: parsed.data as Prisma.InputJsonValue,
          edited_fields: diffFields(plan.payload, parsed.data as Record<string, unknown>),
          result: result as unknown as Prisma.InputJsonValue,
          patient_id: (parsed.data as { patient_id?: string | null }).patient_id ?? plan.patient_id,
        },
      });
      return { data: { plan_id: plan.id, type: parsed.type, result }, error: null };
    }, { timeout: 15000 });
  }

  private run(tx: Prisma.TransactionClient, actor: Principal, action: AuraAction): Promise<ExecResult> {
    switch (action.type) {
      case 'register_patient': return this.registerPatient(tx, actor, action.data);
      case 'invite_patient': return this.invitePatient(tx, actor, action.data);
      case 'none': throw new BadRequestException('Nada a executar.');
      default: throw new BadRequestException(`Ação ainda não suportada: ${action.type}`);
    }
  }

  /** Cria User + Profile + PatientIntake numa tacada — o intake é o que hoje se perde. */
  private async registerPatient(tx: Prisma.TransactionClient, actor: Principal, input: z.infer<typeof registerPatientPayload>): Promise<ExecResult> {
    const created = await this.users.createClinical(actor, {
      full_name: input.full_name,
      phone: input.phone,
      email: input.email,
      cpf: input.cpf,
      date_of_birth: input.date_of_birth,
    }, tx);

    const hasIntake = input.chief_complaint || input.pain_location || input.pain_intensity !== null;
    if (hasIntake) {
      await tx.patientIntake.create({ data: {
        user_id: created.user_id,
        chief_complaint: input.chief_complaint,
        pain_location: input.pain_location,
        pain_intensity: input.pain_intensity,
        intake_completed: false,
      } });
    }
    return {
      ids: [created.user_id],
      patient_id: created.user_id,
      summary: `Paciente ${input.full_name} cadastrado.`,
    };
  }

  private async invitePatient(tx: Prisma.TransactionClient, actor: Principal, input: z.infer<typeof invitePatientPayload>): Promise<ExecResult> {
    const invited = await this.users.invitePatient(actor, input.patient_id, input.email, tx);
    return {
      ids: [invited.user_id],
      patient_id: invited.user_id,
      email: invited.email,
      // Volta uma única vez para o profissional repassar; nunca é persistida.
      temporary_password: invited.temporary_password,
      summary: 'Acesso criado. Compartilhe a senha temporária com o paciente.',
    };
  }

  /** Resolve o paciente a partir do que a Aura extraiu. Usado pelo planejador. */
  resolvePatient(input: Parameters<PatientMatcher['match']>[0]) {
    return this.matcher.match(input);
  }

  /** Auditoria: o profissional só enxerga as próprias ações. */
  async history(actor: Principal, limit = 50) {
    if (!isStaff(actor)) throw new ForbiddenException();
    const data = await this.db.auraActionPlan.findMany({
      where: { professional_id: actor.id },
      orderBy: { created_at: 'desc' },
      take: Math.min(limit, 200),
      select: {
        id: true, type: true, status: true, source_text: true, intent_source: true,
        edited_fields: true, result: true, error: true, created_at: true, executed_at: true,
      },
    });
    return { data, count: data.length };
  }
}
