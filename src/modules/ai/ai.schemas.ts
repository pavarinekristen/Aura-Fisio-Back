import { z } from 'zod';
const textPart = z.object({ type: z.literal('text'), text: z.string().max(30000) }).strict();
const imagePart = z.object({ type: z.literal('image_url'), image_url: z.object({ url: z.string().max(10_000_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/) }).strict() }).strict();
export const messageSchema = z.object({ role: z.enum(['user', 'assistant']), content: z.union([z.string().max(30000), z.array(z.union([textPart, imagePart])).min(1).max(3)]) }).strict();
export const aiInput = z.object({
  patient_id: z.string().uuid().optional(),
  messages: z.array(messageSchema).min(1).max(80).optional(),
  mode: z.enum(['patient', 'professional', 'calendar']).optional(),
  message: z.string().trim().min(1).max(10000).optional(),
  history: z.array(messageSchema).max(20).optional(),
  prompt: z.string().max(20000).optional(),
}).strict();
export type AiInput = z.infer<typeof aiInput>;
export const professionalResult = z.object({ message: z.string().min(1), action: z.discriminatedUnion('type', [
  z.object({ type: z.literal('none'), data: z.object({}) }),
  z.object({ type: z.literal('new_patient'), data: z.object({ full_name: z.string(), phone: z.string().optional(), chief_complaint: z.string().optional() }) }),
  z.object({ type: z.literal('schedule_appointment'), data: z.object({ patient_name: z.string(), patient_id: z.string().uuid().nullable().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/), duration_minutes: z.number().int().min(1).max(480), title: z.string() }) }),
]) });
export const protocolResult = z.object({ phases: z.array(z.object({ name: z.string(), duration_weeks: z.number().positive(), frequency: z.string(), objectives: z.string(), exercises: z.array(z.object({ name: z.string(), description: z.string(), sets: z.string(), reps: z.string(), notes: z.string() })).max(20) })).min(1).max(10) });
export const careResult = z.object({ notifications: z.array(z.object({ type: z.string().max(50), title: z.string().min(1).max(300), message: z.string().min(1).max(20000) })).max(5) });

export function parseJsonOutput<T>(text: string, schema: z.ZodType<T>): T {
  const clean = text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  return schema.parse(JSON.parse(clean));
}
