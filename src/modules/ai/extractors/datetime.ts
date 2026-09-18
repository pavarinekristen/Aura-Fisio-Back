import { empty, found, type DateTimeValue, type Extraction, type ExtractorDefaults, type PartOfDay } from './types';
import { MONTHS, WEEKDAYS, fold } from './numbers';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

/** Só a parte da data de `now`, sem hora, para aritmética de calendário. */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

interface Hit { value: string; raw: string; span: [number, number]; confidence: number }

/**
 * "quinta que vem" é ambíguo em pt-BR. Adotamos: a quinta da semana seguinte,
 * nunca amanhã. Sem o "que vem", é a próxima ocorrência do dia (hoje não conta).
 */
function weekdayTarget(today: Date, weekday: number, nextWeek: boolean): Date {
  if (nextWeek) {
    const mondayThisWeek = addDays(today, -((today.getDay() + 6) % 7));
    const mondayNextWeek = addDays(mondayThisWeek, 7);
    return addDays(mondayNextWeek, (weekday + 6) % 7);
  }
  const delta = (weekday - today.getDay() + 7) % 7;
  return addDays(today, delta === 0 ? 7 : delta);
}

/** Datas relativas e absolutas em pt-BR. Tabela própria; chrono entra só como último recurso. */
export function extractRelativeDate(text: string, now: Date): Hit | null {
  const today = startOfDay(now);
  const folded = fold(text);

  const at = (re: RegExp, build: (m: RegExpExecArray) => Date | null): Hit | null => {
    re.lastIndex = 0;
    const m = re.exec(folded);
    if (!m) return null;
    const date = build(m);
    if (!date || Number.isNaN(date.getTime())) return null;
    return { value: isoDate(date), raw: text.slice(m.index, m.index + m[0].length), span: [m.index, m.index + m[0].length], confidence: 0.95 };
  };

  return at(/\bdepois de amanha\b/g, () => addDays(today, 2))
    ?? at(/\bamanha\b/g, () => addDays(today, 1))
    ?? at(/\bhoje\b/g, () => today)
    // "daqui a 3 dias" / "daqui a 2 semanas"
    ?? at(/\bdaqui a (\d{1,2}) (dias?|semanas?)\b/g, m => addDays(today, Number(m[1]) * (m[2].startsWith('semana') ? 7 : 1)))
    // "quinta que vem", "proxima terca", "terca da semana que vem"
    ?? at(new RegExp(`\\b(?:(proxim[ao])\\s+)?(${Object.keys(WEEKDAYS).join('|')})(?:\\s*-?feira)?(\\s+(?:que vem|da semana que vem|da proxima semana))?\\b`, 'g'), m => {
      const weekday = WEEKDAYS[m[2]];
      if (weekday === undefined) return null;
      return weekdayTarget(today, weekday, Boolean(m[1] || m[3]));
    })
    // "24/03", "24/03/2026"
    ?? at(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g, m => {
      const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : today.getFullYear();
      const candidate = new Date(year, Number(m[2]) - 1, Number(m[1]));
      // Sem ano explícito e já passou: assume o ano que vem.
      if (!m[3] && candidate < today) return new Date(year + 1, Number(m[2]) - 1, Number(m[1]));
      return candidate;
    })
    // "dia 24 de março", "24 de março"
    ?? at(new RegExp(`\\b(?:dia\\s+)?(\\d{1,2})\\s+de\\s+(${Object.keys(MONTHS).join('|')})(?:\\s+de\\s+(\\d{4}))?\\b`, 'g'), m => {
      const year = m[3] ? Number(m[3]) : today.getFullYear();
      const candidate = new Date(year, MONTHS[m[2]], Number(m[1]));
      if (!m[3] && candidate < today) return new Date(year + 1, MONTHS[m[2]], Number(m[1]));
      return candidate;
    })
    // "dia 24", sem mês
    ?? at(/\bdia (\d{1,2})\b/g, m => {
      const day = Number(m[1]);
      if (day < 1 || day > 31) return null;
      const candidate = new Date(today.getFullYear(), today.getMonth(), day);
      return candidate < today ? new Date(today.getFullYear(), today.getMonth() + 1, day) : candidate;
    });
}

/** "14h", "14h30", "às 14:00", "2 da tarde", "meio-dia". */
export function extractTime(text: string): (Hit & { partOfDay: PartOfDay | null }) | null {
  const folded = fold(text);

  const build = (re: RegExp, toTime: (m: RegExpExecArray) => string | null, confidence = 0.95) => {
    re.lastIndex = 0;
    const m = re.exec(folded);
    if (!m) return null;
    const value = toTime(m);
    if (!value) return null;
    return { value, raw: text.slice(m.index, m.index + m[0].length), span: [m.index, m.index + m[0].length] as [number, number], confidence, partOfDay: null };
  };

  const clamp = (h: number, min: number) => (h > 23 || min > 59 ? null : `${pad(h)}:${pad(min)}`);

  const hit = build(/\bmeio-?dia\b/g, () => '12:00')
    ?? build(/\b(?:as\s+)?(\d{1,2})[h:](\d{2})\b/g, m => clamp(Number(m[1]), Number(m[2])))
    ?? build(/\b(?:as\s+)?(\d{1,2})\s*h\b/g, m => clamp(Number(m[1]), 0))
    // "2 da tarde" / "8 da noite": converte para 24h.
    ?? build(/\b(\d{1,2})\s+da\s+(tarde|noite)\b/g, m => {
      const h = Number(m[1]);
      return clamp(h < 12 ? h + 12 : h, 0);
    })
    ?? build(/\b(\d{1,2})\s+da\s+manha\b/g, m => clamp(Number(m[1]), 0))
    ?? build(/\bas\s+(\d{1,2})\b/g, m => clamp(Number(m[1]), 0), 0.7);
  if (hit) return hit;

  // Sem hora explícita, mas com período do dia: resolvido depois pelas configurações da clínica.
  const period = /\b(de manha|pela manha|de tarde|a tarde|pela tarde|de noite|a noite|pela noite)\b/g;
  period.lastIndex = 0;
  const m = period.exec(folded);
  if (!m) return null;
  const partOfDay: PartOfDay = m[1].includes('manha') ? 'manha' : m[1].includes('tarde') ? 'tarde' : 'noite';
  return { value: '', raw: text.slice(m.index, m.index + m[0].length), span: [m.index, m.index + m[0].length], confidence: 0.8, partOfDay };
}

/**
 * Data + hora combinadas. `partOfDay` sem hora explícita é resolvido pelo chamador
 * a partir de `clinic_settings`, nunca por valor cravado aqui.
 */
export function extractDateTime(text: string, now: Date, defaults: ExtractorDefaults = {}): Extraction<DateTimeValue> {
  const date = extractRelativeDate(text, now);
  const time = extractTime(text);
  if (!date && !time) return empty<DateTimeValue>();

  const hourFor = (part: PartOfDay): string | null => {
    if (part === 'manha') return defaults.morningHour ?? null;
    if (part === 'tarde') return defaults.afternoonHour ?? null;
    return defaults.eveningHour ?? null;
  };

  const partOfDay = time?.partOfDay ?? null;
  const resolvedTime = time?.value || (partOfDay ? hourFor(partOfDay) : null);
  const spans = [date?.span, time?.span].filter(Boolean) as [number, number][];
  const span: [number, number] = [Math.min(...spans.map(s => s[0])), Math.max(...spans.map(s => s[1]))];
  const raw = text.slice(span[0], span[1]);
  const confidence = Math.min(date?.confidence ?? 0.5, time?.confidence ?? 0.5);

  return found({ date: date?.value ?? null, time: resolvedTime, partOfDay }, raw, span, confidence);
}
