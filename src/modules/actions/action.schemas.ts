import { z } from 'zod';
import { protocolResult } from '../ai/ai.schemas';

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar em YYYY-MM-DD.');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora deve estar em HH:MM.');
const text = z.string().max(20000).nullable().default(null);
const pain = z.number().int().min(0).max(10).nullable().default(null);

export const registerPatientPayload = z.object({
  full_name: z.string().trim().min(2).max(200),
  /** E.164, como o extrator normaliza. */
  phone: z.string().regex(/^\+55\d{10,11}$/, 'Telefone inválido.').nullable().default(null),
  email: z.string().email().max(254).nullable().default(null),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter 11 dígitos.').nullable().default(null),
  date_of_birth: isoDate.nullable().default(null),
  chief_complaint: text,
  pain_location: z.string().max(200).nullable().default(null),
  pain_intensity: pain,
}).strict();

export const scheduleAppointmentPayload = z.object({
  /** Nulo significa paciente não resolvido: a execução recusa. */
  patient_id: uuid.nullable(),
  patient_hint: z.string().max(200).nullable().default(null),
  title: z.string().trim().min(1).max(300).default('Sessão na Clínica'),
  event_type: z.enum(['clinic', 'home', 'rest']).default('clinic'),
  date: isoDate,
  time: hhmm,
  duration_minutes: z.number().int().min(15).max(480).default(60),
  notes: text,
  publish: z.boolean().default(true),
  on_conflict: z.enum(['reject', 'shift_to_next_free']).default('reject'),
}).strict();

export const scheduleSeriesPayload = scheduleAppointmentPayload.omit({ date: true }).extend({
  start_date: isoDate,
  /** 0 = domingo ... 6 = sábado, como Date#getDay. */
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  occurrences: z.number().int().min(1).max(52),
  skip_conflicts: z.boolean().default(true),
}).strict();

export const logSessionPayload = z.object({
  patient_id: uuid.nullable(),
  patient_hint: z.string().max(200).nullable().default(null),
  session_date: isoDate,
  /** Nulo faz o executor usar o maior número já registrado do paciente + 1. */
  session_number: z.number().int().min(1).nullable().default(null),
  pain_level: pain,
  improvements: text,
  adaptations: text,
  observations: text,
  next_session_goals: text,
}).strict();

export const saveProtocolPayload = z.object({
  patient_id: uuid.nullable(),
  template_name: z.string().trim().min(1).max(200),
  description: text,
  /** Reusa o schema que a IA já produz em `ai-protocol-suggestion`. */
  phases: protocolResult.shape.phases,
  save_as_template: z.boolean().default(true),
  apply_to_patient: z.boolean().default(true),
  deactivate_existing_plans: z.boolean().default(false),
}).strict();

export const invitePatientPayload = z.object({
  patient_id: uuid,
  /** Obrigatório aqui: o cadastro pode ter criado o paciente sem e-mail nenhum. */
  email: z.string().email().max(254),
}).strict();

export const auraAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none'), data: z.object({}).strict() }),
  z.object({ type: z.literal('register_patient'), data: registerPatientPayload }),
  z.object({ type: z.literal('schedule_appointment'), data: scheduleAppointmentPayload }),
  z.object({ type: z.literal('schedule_series'), data: scheduleSeriesPayload }),
  z.object({ type: z.literal('log_session'), data: logSessionPayload }),
  z.object({ type: z.literal('save_protocol'), data: saveProtocolPayload }),
  z.object({ type: z.literal('invite_patient'), data: invitePatientPayload }),
]);
export type AuraAction = z.infer<typeof auraAction>;
export type AuraActionType = AuraAction['type'];

export const planRequest = z.object({ type: z.string().min(1).max(50), data: z.record(z.unknown()).default({}), source_text: z.string().max(10000).optional() }).strict();
export const executeRequest = z.object({ plan_id: uuid, action: z.unknown() }).strict();

/** Campos que o profissional alterou entre a proposta e a confirmação. */
export function diffFields(proposed: unknown, executed: Record<string, unknown>): string[] {
  const before = (proposed ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(before), ...Object.keys(executed)]);
  return [...keys].filter(key => JSON.stringify(before[key] ?? null) !== JSON.stringify(executed[key] ?? null)).sort();
}
