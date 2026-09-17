import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/bootstrap';
import { PrismaService } from '../src/database/prisma.service';
import { OllamaProvider } from '../src/modules/ai/ollama.provider';

let app: INestApplication;
let db: PrismaService;
let admin: string;
let professional: string;
let patient: string;
let patientId: string;
let otherId: string;
let planId: string;
let sessionId: string;
let eventId: string;
const password = 'Patient-password-123';
const origin = 'http://localhost:8080';
const api = () => request(app.getHttpServer());
const login = async (email: string, pass = password) => {
  const res = await api().post('/api/v1/auth/login').set('Origin', origin).send({ email, password: pass }).expect(200);
  return res.headers['set-cookie'][0].split(';')[0] as string;
};
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('biohub_test')) throw new Error('Integration tests require the disposable test database.');
  ({ app } = await createApp(false));
  await app.init();
  db = app.get(PrismaService);
});
afterAll(async () => { await app?.close(); });

describe.sequential('PostgreSQL migration and clinic workflows', () => {
  it('creates an empty clinical database and an idempotent admin seed', async () => {
    expect(await db.user.count()).toBe(1);
    expect(await db.patientIntake.count()).toBe(0);
    const user = await db.user.findUniqueOrThrow({ where: { email: 'admin@test.local' } });
    expect(user.role).toBe('admin'); expect(user.password_hash).toMatch(/^\$argon2id\$/);
    await api().get('/api/v1/health').expect(200);
    await api().get('/api/v1/profiles').expect(401);
    admin = await login('admin@test.local', 'Test-only-password-123');
    const me = await api().get('/api/v1/auth/me').set('Cookie', admin).expect(200);
    expect(me.body.role).toBe('admin'); expect(me.body.password_hash).toBeUndefined();
  });
  it('enforces origin checks and creates professionals and patients atomically', async () => {
    await api().post('/api/v1/patients').set('Cookie', admin).set('Origin', 'https://untrusted.example').send({}).expect(403);
    await api().post('/api/v1/users').set('Cookie', admin).set('Origin', origin).send({ email: 'professional@test.local', password, full_name: 'Professional', role: 'professional' }).expect(201);
    professional = await login('professional@test.local');
    for (const [email, name] of [['patient@test.local','Patient'], ['other@test.local','Other']]) {
      const result = await api().post('/api/v1/patients').set('Cookie', professional).set('Origin', origin).send({ email, password, full_name: name }).expect(201);
      if (name === 'Patient') patientId = result.body.data.user_id; else otherId = result.body.data.user_id;
    }
    patient = await login('patient@test.local');
    await api().post('/api/v1/users').set('Cookie', professional).set('Origin', origin).send({ email: 'forged@test.local', password, full_name: 'Forged', role: 'professional' }).expect(403);
    await api().post('/api/v1/patients').set('Cookie', patient).set('Origin', origin).send({ email: 'forged@test.local', password, full_name: 'Forged' }).expect(403);
  });
  it('isolates patient data and rejects unrecognized filters', async () => {
    const own = await api().get('/api/v1/profiles').set('Cookie', patient).expect(200);
    expect(own.body.data).toHaveLength(1); expect(own.body.data[0].user_id).toBe(patientId);
    const other = await api().get(`/api/v1/profiles?user_id=${otherId}`).set('Cookie', patient).expect(200);
    expect(other.body.data).toHaveLength(0);
    await api().get('/api/v1/profiles?password_hash=anything').set('Cookie', admin).expect(400);
    await api().get('/api/v1/alerts').set('Cookie', patient).expect(403);
  });
  it('saves clinical records, validates pain and enforces session ownership', async () => {
    await api().post('/api/v1/intakes').set('Cookie', professional).set('Origin', origin).send({ user_id: patientId, pain_location: 'ombro', pain_intensity: 11 }).expect(400);
    await api().post('/api/v1/intakes').set('Cookie', professional).set('Origin', origin).send({ user_id: patientId, pain_location: 'ombro', pain_intensity: 5, intake_completed: true }).expect(201);
    const intake = await api().get('/api/v1/intakes?intake_completed=true').set('Cookie', professional).expect(200);
    expect(intake.body.data).toHaveLength(1);
    const plan = await api().post('/api/v1/treatments').set('Cookie', professional).set('Origin', origin).send({ patient_id: patientId, exercise_name: 'Mobilidade', sets: '3', reps: '10' }).expect(201);
    planId = plan.body.data[0].id;
    const session = await api().post('/api/v1/sessions').set('Cookie', professional).set('Origin', origin).send({ patient_id: patientId, session_date: '2026-09-16', pain_level: 5 }).expect(201);
    sessionId = session.body.data[0].id;
    await api().post('/api/v1/metrics').set('Cookie', professional).set('Origin', origin).send({ patient_id: otherId, session_id: sessionId, metric_type: 'ADM', metric_name: 'Ombro', metric_value: 90 }).expect(400);
    await api().post('/api/v1/metrics').set('Cookie', professional).set('Origin', origin).send({ patient_id: patientId, session_id: sessionId, metric_type: 'ADM', metric_name: 'Ombro', metric_value: 90 }).expect(201);
    const records = await api().get('/api/v1/sessions').set('Cookie', patient).expect(200);
    expect(records.body.data[0].session_date).toBe('2026-09-16');
  });
  it('creates a pain alert with the check-in transaction and rejects another patient exercise', async () => {
    await api().post('/api/v1/checkins').set('Cookie', patient).set('Origin', origin).send({ patient_id: otherId, treatment_plan_id: planId, pain_reported: 8 }).expect(403);
    await api().post('/api/v1/checkins').set('Cookie', patient).set('Origin', origin).send({ patient_id: patientId, treatment_plan_id: planId, pain_reported: 8 }).expect(201);
    expect(await db.patientAlert.count({ where: { patient_id: patientId } })).toBe(1);
    expect(await db.workoutCheckin.count({ where: { patient_id: patientId } })).toBe(1);
  });
  it('hides calendar drafts and publishes atomically without duplicating events', async () => {
    const event = { patient_id: patientId, title: 'Sessão', event_type: 'clinic', start_date: '2026-09-17T12:00:00.000Z', end_date: '2026-09-17T13:00:00.000Z' };
    await api().post('/api/v1/calendar-events').set('Cookie', professional).set('Origin', origin).send({ ...event, end_date: event.start_date }).expect(400);
    const draft = await api().post('/api/v1/calendar-events').set('Cookie', professional).set('Origin', origin).send(event).expect(201);
    eventId = draft.body.data[0].id;
    expect((await api().get('/api/v1/calendar-events').set('Cookie', patient).expect(200)).body.data).toHaveLength(0);
    for (let i = 0; i < 2; i++) await api().post('/api/v1/calendar-events/publish').set('Cookie', professional).set('Origin', origin).send([{ ...event, id: eventId, is_published: true }]).expect(201);
    expect((await api().get('/api/v1/calendar-events').set('Cookie', patient).expect(200)).body.data).toHaveLength(1);
    expect(await db.calendarEvent.count()).toBe(1);
  });
  it('keeps protocol templates scoped to their professional and exports CSV', async () => {
    await api().post('/api/v1/protocols').set('Cookie', professional).set('Origin', origin).send({ template_name: 'Mobilidade', exercises: [{ exercise_name: 'Mobilidade', sets: '3', reps: '10' }], clinical_data: { pain_location: 'ombro' } }).expect(201);
    expect((await api().get('/api/v1/protocols').set('Cookie', admin).expect(200)).body.data).toHaveLength(0);
    const csv = await api().get(`/api/v1/reports/export?type=sessions&patient_id=${patientId}`).set('Cookie', professional).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv'); expect(csv.text).toContain('session_number');
    await api().get('/api/v1/reports/export?type=sessions').set('Cookie', patient).expect(403);
  });
  it('loads AI context on the server, persists notifications and restricts writes', async () => {
    const provider = app.get(OllamaProvider);
    const mock = vi.spyOn(provider, 'text').mockResolvedValue('{"notifications":[{"type":"motivation","title":"Continue","message":"Siga o plano orientado."}]}');
    await api().post('/api/v1/ai/ai-care-bot').set('Cookie', patient).set('Origin', origin).send({ patient_id: otherId }).expect(403);
    expect(mock).not.toHaveBeenCalled();
    await api().post('/api/v1/ai/ai-care-bot').set('Cookie', patient).set('Origin', origin).send({ patient_id: patientId }).expect(201);
    expect(JSON.stringify(mock.mock.calls[0][0])).toContain('Mobilidade');
    const notifs = await api().get('/api/v1/notifications').set('Cookie', patient).expect(200);
    expect(notifs.body.data).toHaveLength(1);
    const id = notifs.body.data[0].id;
    await api().patch(`/api/v1/notifications?id=${id}`).set('Cookie', patient).set('Origin', origin).send({ patient_id: otherId }).expect(400);
    await api().patch(`/api/v1/notifications?patient_id=${patientId}&is_read=false`).set('Cookie', patient).set('Origin', origin).send({ is_read: true }).expect(200);
    expect((await db.patientNotification.findUniqueOrThrow({ where: { id } })).is_read).toBe(true);
    mock.mockRestore();
  });
  it('keeps soft-deleted records out of all lists and blocks further check-ins', async () => {
    await api().delete(`/api/v1/treatments?id=${planId}`).set('Cookie', professional).set('Origin', origin).expect(200);
    expect((await api().get('/api/v1/treatments').set('Cookie', patient).expect(200)).body.data).toHaveLength(0);
    expect((await db.treatmentPlan.findUniqueOrThrow({ where: { id: planId } })).is_deleted).toBe(true);
    await api().post('/api/v1/checkins').set('Cookie', patient).set('Origin', origin).send({ patient_id: patientId, treatment_plan_id: planId }).expect(400);
  });
  it('revokes sessions on logout and rejects expired sessions', async () => {
    await api().post('/api/v1/auth/logout').set('Cookie', patient).set('Origin', origin).expect(204);
    await api().get('/api/v1/auth/me').set('Cookie', patient).expect(401);
    await db.authSession.updateMany({ data: { expires_at: new Date(0) } });
    await api().get('/api/v1/auth/me').set('Cookie', admin).expect(401);
  });
});
