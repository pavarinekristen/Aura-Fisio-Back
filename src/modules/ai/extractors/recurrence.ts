import { empty, found, type Extraction, type RecurrenceValue } from './types';
import { WEEKDAYS, fold, toNumber } from './numbers';

const WEEKDAY_ALTERNATION = Object.keys(WEEKDAYS).join('|');

/**
 * "10 sessões, terças e quintas", "2x por semana", "toda segunda".
 * Junta tudo o que encontrar: dias da semana, quantidade de ocorrências e frequência.
 */
export function extractRecurrence(text: string): Extraction<RecurrenceValue> {
  const folded = fold(text);
  const spans: [number, number][] = [];

  const weekdays = new Set<number>();
  const weekdayPattern = new RegExp(`\\b(${WEEKDAY_ALTERNATION})(?:\\s*-?feira)?\\b`, 'g');
  for (const m of folded.matchAll(weekdayPattern)) {
    const day = WEEKDAYS[m[1]];
    if (day === undefined) continue;
    weekdays.add(day);
    spans.push([m.index, m.index + m[0].length]);
  }

  let occurrences: number | null = null;
  const sessions = /\b(\d{1,2}|\w+)\s+(?:sessoes|sessao|consultas?|atendimentos?|vezes)\b/g;
  const sessionsMatch = sessions.exec(folded);
  if (sessionsMatch) {
    const parsed = toNumber(sessionsMatch[1]);
    if (parsed !== null && parsed > 0 && parsed <= 52) {
      occurrences = parsed;
      spans.push([sessionsMatch.index, sessionsMatch.index + sessionsMatch[0].length]);
    }
  }

  let perWeek: number | null = null;
  const frequency = /\b(\d{1,2})\s*x\s*(?:por|na|a)\s*semana\b/g;
  const frequencyMatch = frequency.exec(folded);
  if (frequencyMatch) {
    perWeek = Number(frequencyMatch[1]);
    spans.push([frequencyMatch.index, frequencyMatch.index + frequencyMatch[0].length]);
  }

  // Um único dia da semana sem contagem é uma data ("quinta que vem"), não uma
  // série — deixamos para o extrator de data/hora. Série exige vários dias,
  // uma quantidade de sessões ou uma frequência explícita.
  const isSeries = weekdays.size >= 2 || occurrences !== null || perWeek !== null;
  if (!isSeries) return empty<RecurrenceValue>();

  const span: [number, number] = [Math.min(...spans.map(s => s[0])), Math.max(...spans.map(s => s[1]))];
  const value: RecurrenceValue = { weekdays: [...weekdays].sort((a, b) => a - b), occurrences, perWeek };
  // Sem dia da semana explícito a série não é acionável sozinha; o card pergunta.
  return found(value, text.slice(span[0], span[1]), span, weekdays.size ? 0.9 : 0.6);
}
