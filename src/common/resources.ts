import { z } from 'zod';

const text = z.string().max(20000).nullable().optional();
const id = z.string().uuid();
const date = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).transform(v => new Date(v)).refine(v => !isNaN(v.getTime()), 'Data inválida');
const optionalDate = date.nullable().optional();
const pain = z.number().int().min(0).max(10).nullable().optional();
const active = { is_active: z.boolean().optional(), is_deleted: z.boolean().optional(), deleted_at: optionalDate };
const clinical = { patient_id: id, professional_id: id.optional() };
const deleted = { is_deleted: z.boolean().optional(), deleted_at: optionalDate };

export const resources = {
  profiles: { route: 'profiles', model: 'profile', owner: 'user_id', patientWrite: true,
    schema: z.object({ user_id: id, full_name: z.string().trim().min(1).max(200), phone: text, cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter 11 dígitos.').nullable().optional(), date_of_birth: optionalDate, avatar_url: text, intake_completed: z.boolean().optional() }).strict() },
  patient_intake: { route: 'intakes', model: 'patientIntake', owner: 'user_id', patientWrite: true, soft: true,
    schema: z.object({ user_id: id, chief_complaint: text, pain_location: text, pain_intensity: pain, pain_duration: text, pain_type: text, previous_treatments: text, surgeries: text, medications: text, medical_conditions: text, daily_activities: text, exercise_routine: text, goals: text, sleep_quality: text, stress_level: text, additional_notes: text, treatment_protocol: text, treatment_duration: text, intake_completed: z.boolean().optional(), ...deleted }).strict() },
  treatment_plans: { route: 'treatments', model: 'treatmentPlan', owner: 'patient_id', soft: true,
    schema: z.object({ ...clinical, exercise_name: z.string().trim().min(1).max(300), exercise_description: text, sets: text, reps: text, frequency: text, day_of_week: text, notes: text, ...active }).strict() },
  clinical_sessions: { route: 'sessions', model: 'clinicalSession', owner: 'patient_id', soft: true,
    schema: z.object({ ...clinical, session_date: date.optional(), session_number: z.number().int().min(1).optional(), pain_level: pain, improvements: text, adaptations: text, observations: text, next_session_goals: text, ...deleted }).strict() },
  clinical_metrics: { route: 'metrics', model: 'clinicalMetric', owner: 'patient_id', soft: true,
    schema: z.object({ ...clinical, session_id: id.nullable().optional(), metric_type: z.string().min(1).max(100), metric_name: z.string().min(1).max(200), metric_value: z.number().finite(), metric_unit: text, notes: text, ...deleted }).strict() },
  workout_checkins: { route: 'checkins', model: 'workoutCheckin', owner: 'patient_id', patientWrite: true,
    schema: z.object({ patient_id: id, treatment_plan_id: id, pain_reported: pain, notes: text }).strict() },
  patient_alerts: { route: 'alerts', model: 'patientAlert', owner: 'patient_id', staffOnly: true,
    schema: z.object({ is_read: z.boolean() }).strict() },
  protocol_templates: { route: 'protocols', model: 'protocolTemplate', owner: 'professional_id', staffOnly: true, ownStaff: true,
    schema: z.object({ professional_id: id.optional(), template_name: z.string().trim().min(1).max(200), description: text, exercises: z.array(z.object({ exercise_name: z.string().min(1), exercise_description: text, sets: text, reps: text, frequency: text, day_of_week: text, notes: text }).strict()).max(100), clinical_data: z.record(z.unknown()).nullable().optional() }).strict() },
  patient_notifications: { route: 'notifications', model: 'patientNotification', owner: 'patient_id', patientWrite: true,
    schema: z.object({ patient_id: id, notification_type: z.string().max(50).optional(), title: z.string().min(1).max(300), message: z.string().min(1).max(20000), is_read: z.boolean().optional(), is_dismissed: z.boolean().optional() }).strict() },
  calendar_events: { route: 'calendar-events', model: 'calendarEvent', owner: 'patient_id',
    schema: z.object({ ...clinical, title: z.string().trim().min(1).max(300), event_type: z.enum(['clinic', 'home', 'rest']), start_date: date, end_date: date, notes: text, is_published: z.boolean().optional() }).strict() },
} as const;

export type ResourceKey = keyof typeof resources;
export interface ResourceConfig {
  route: string; model: string; owner: string; schema: z.AnyZodObject;
  patientWrite?: boolean; staffOnly?: boolean; ownStaff?: boolean; soft?: boolean;
}
export const configFor = (key: ResourceKey): ResourceConfig => resources[key];

export const listQuerySchema = z.object({
  id: id.optional(), user_id: id.optional(), patient_id: id.optional(), professional_id: id.optional(),
  user_id_in: z.string().transform(v => v.split(',')).pipe(z.array(id).max(500)).optional(),
  is_read: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  is_dismissed: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  is_deleted: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  is_active: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  is_published: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  intake_completed: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  session_date: date.optional(), session_date_gte: date.optional(), session_date_lte: date.optional(),
  created_at_gte: date.optional(), created_at_lte: date.optional(),
  checked_at_gte: date.optional(), checked_at_lte: date.optional(),
  start_date_gte: date.optional(), start_date_lte: date.optional(),
  order_by: z.enum(['created_at', 'session_date', 'session_number', 'checked_at', 'start_date', 'full_name']).optional(),
  order_dir: z.enum(['asc', 'desc']).default('asc'),
  limit: z.coerce.number().int().min(1).max(1000).default(1000),
}).strict();

export function responseSchema(key: ResourceKey) {
  const shape = resources[key].schema.shape;
  const properties: Record<string, object> = { id: { type: 'string', format: 'uuid' }, created_at: { type: 'string', format: 'date-time' } };
  for (const name of Object.keys(shape)) {
    const numeric = ['pain_intensity', 'pain_level', 'pain_reported', 'session_number', 'metric_value'].includes(name);
    const boolean = name.startsWith('is_') || name === 'intake_completed';
    properties[name] = name === 'exercises' ? { type: 'array', items: { type: 'object', additionalProperties: true } }
      : name === 'clinical_data' ? { type: 'object', additionalProperties: true, nullable: true }
      : { type: numeric ? 'number' : boolean ? 'boolean' : 'string', nullable: true };
  }
  if (key === 'profiles') properties.role = { type: 'string', enum: ['admin', 'professional', 'patient'] };
  if (key === 'patient_intake') properties.updated_at = { type: 'string', format: 'date-time' };
  if (key === 'workout_checkins') properties.checked_at = { type: 'string', format: 'date-time' };
  if (key === 'patient_alerts') {
    properties.patient_id = { type: 'string' }; properties.professional_id = { type: 'string', nullable: true };
    properties.alert_type = { type: 'string' }; properties.message = { type: 'string' };
  }
  return { type: 'object' as const, properties, required: Object.keys(properties) };
}
