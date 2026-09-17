import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { isStaff, type Principal } from '../../common/http';
import { ResourceRepository } from '../../common/resource.repository';

export function toCsv(rows: Record<string, unknown>[], fields: string[]) {
  const cell = (value: unknown) => {
    let text = value instanceof Date ? value.toISOString() : value == null ? '' : String(value);
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [fields.join(','), ...rows.map(row => fields.map(field => cell(row[field])).join(','))].join('\r\n');
}
@Injectable()
export class ReportsService {
  constructor(@Inject(ResourceRepository) private repo: ResourceRepository) {}
  async export(actor: Principal, raw: unknown) {
    if (!isStaff(actor)) throw new ForbiddenException();
    const input = z.object({ type: z.enum(['sessions', 'metrics', 'plans']), patient_id: z.string().uuid().optional(), date_from: z.string().date().optional(), date_to: z.string().date().optional() }).strict().parse(raw);
    const key = { sessions: 'clinical_sessions', metrics: 'clinical_metrics', plans: 'treatment_plans' } as const;
    const fields = { sessions: ['session_number','session_date','pain_level','improvements','adaptations','observations','next_session_goals'], metrics: ['metric_type','metric_name','metric_value','metric_unit','notes','created_at'], plans: ['exercise_name','exercise_description','sets','reps','frequency','day_of_week','notes','is_active'] };
    const dateField = input.type === 'sessions' ? 'session_date' : 'created_at';
    const where = { is_deleted: false, ...(input.patient_id ? { patient_id: input.patient_id } : {}),
      ...(input.date_from || input.date_to ? { [dateField]: { ...(input.date_from ? { gte: new Date(input.date_from) } : {}), ...(input.date_to ? { lt: new Date(new Date(input.date_to).getTime() + 86400000) } : {}) } } : {}),
    };
    const rows = await this.repo.delegate(key[input.type]).findMany({ where, orderBy: { [dateField]: 'asc' } });
    return toCsv(rows, fields[input.type]);
  }
}
