/**
 * Extratores determinísticos: funções puras, sem Nest, sem banco e — importante —
 * sem importar `config/env`, porque `test/unit.test.ts` mocka esse módulo com
 * apenas três chaves. Toda configuração entra por `ExtractorDefaults`.
 */

export interface Extraction<T> {
  value: T | null;
  /** Trecho literal que casou, útil para depurar e para montar o remainder. */
  raw: string | null;
  /** Offsets no texto de origem. */
  span: [number, number] | null;
  /** 0..1. 1 significa auto-verificável (ex.: CPF com dígito verificador correto). */
  confidence: number;
  /** Por que foi rejeitado, ex.: 'cpf_check_digit'. */
  reason?: string;
}

export type PartOfDay = 'manha' | 'tarde' | 'noite';

export interface DateTimeValue {
  /** ISO local, YYYY-MM-DD. */
  date: string | null;
  /** HH:MM em 24h. */
  time: string | null;
  partOfDay: PartOfDay | null;
}

export interface RecurrenceValue {
  /** 0 = domingo ... 6 = sábado, como Date#getDay. */
  weekdays: number[];
  occurrences: number | null;
  perWeek: number | null;
}

export interface ExtractorDefaults {
  /** DDD assumido quando o telefone vem sem ele. */
  ddd?: string | null;
  /** Horários que resolvem "de manhã" / "à tarde" / "à noite". */
  morningHour?: string;
  afternoonHour?: string;
  eveningHour?: string;
  defaultDurationMinutes?: number;
}

export interface ExtractionSet {
  cpf: Extraction<string>;
  phone: Extraction<string>;
  email: Extraction<string>;
  dateOfBirth: Extraction<string>;
  datetime: Extraction<DateTimeValue>;
  durationMinutes: Extraction<number>;
  recurrence: Extraction<RecurrenceValue>;
  painIntensity: Extraction<number>;
  name: Extraction<string>;
  /** Todos os trechos reivindicados, em ordem. */
  consumed: [number, number][];
  /** Texto de origem com os trechos reivindicados removidos. É o que vai para o LLM. */
  remainder: string;
}

export const empty = <T>(reason?: string): Extraction<T> => ({ value: null, raw: null, span: null, confidence: 0, ...(reason ? { reason } : {}) });

export const found = <T>(value: T, raw: string, span: [number, number], confidence: number): Extraction<T> => ({ value, raw, span, confidence });

/** Remove os trechos já reivindicados, preservando os offsets restantes. */
export function stripSpans(text: string, spans: [number, number][]): string {
  if (!spans.length) return text.trim();
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  let out = '';
  let cursor = 0;
  for (const [start, end] of sorted) {
    if (start < cursor) { cursor = Math.max(cursor, end); continue; }
    out += text.slice(cursor, start) + ' ';
    cursor = end;
  }
  out += text.slice(cursor);
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').trim();
}
