import { empty, found, type Extraction } from './types';
import { MONTHS, WEEKDAYS, fold } from './numbers';

/** Palavras que nunca fazem parte de um nome, mesmo capitalizadas no início da frase. */
const STOPWORDS = new Set([
  ...Object.keys(WEEKDAYS), ...Object.keys(MONTHS),
  'cadastrar', 'cadastra', 'cadastre', 'agendar', 'agenda', 'agende', 'marcar', 'marca',
  'paciente', 'cliente', 'novo', 'nova', 'sessao', 'sessoes', 'consulta', 'consultas',
  'hoje', 'amanha', 'depois', 'semana', 'mes', 'dia', 'dias', 'hora', 'horas',
  'dor', 'com', 'para', 'pra', 'pro', 'aura', 'por', 'favor', 'clinica',
]);

/** Preposições que ficam dentro de um nome: "Maria da Silva". */
const CONNECTORS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/** Palavras que costumam preceder o nome do paciente. */
const LEAD_INS = new Set(['cadastrar', 'cadastra', 'cadastre', 'paciente', 'cliente', 'agendar', 'agenda', 'agende', 'marcar', 'marca', 'para', 'pra', 'pro', 'com', 'a', 'o']);

const isTitleCase = (token: string) => /^[A-ZÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ][a-záàâãäéèêëíìîïóòôõöúùûüçñ'-]+$/.test(token);

interface Run { tokens: string[]; start: number; end: number; boosted: boolean }

/**
 * Heurística, deliberadamente de confiança baixa: o nome alimenta o matcher de
 * paciente e é sempre confirmado no card. Prefere a sequência capitalizada que
 * vem logo após um verbo de comando; no empate, a mais longa.
 */
export function extractName(text: string): Extraction<string> {
  const runs: Run[] = [];
  let current: Run | null = null;
  let precedingWord = '';

  for (const match of text.matchAll(/\S+/g)) {
    const word = match[0].replace(/^[("']+|[.,;:!?)"']+$/g, '');
    if (!word) continue;
    const folded = fold(word);
    const nameToken = isTitleCase(word) && !STOPWORDS.has(folded);
    const connector = current !== null && CONNECTORS.has(folded);

    if (nameToken && current === null) {
      current = { tokens: [word], start: match.index, end: match.index + word.length, boosted: LEAD_INS.has(precedingWord) };
    } else if (nameToken || connector) {
      current!.tokens.push(word);
      current!.end = match.index + word.length;
    } else {
      if (current) { runs.push(current); current = null; }
      precedingWord = folded;
    }
  }
  if (current) runs.push(current);

  // Descarta conectores soltos nas bordas ("da Silva" sem nome antes).
  const cleaned = runs
    .map(run => {
      const tokens = [...run.tokens];
      while (tokens.length && CONNECTORS.has(fold(tokens[0]))) tokens.shift();
      while (tokens.length && CONNECTORS.has(fold(tokens[tokens.length - 1]))) tokens.pop();
      return { ...run, tokens };
    })
    .filter(run => run.tokens.length > 0);

  if (!cleaned.length) return empty<string>();

  const best = cleaned.sort((a, b) => (Number(b.boosted) - Number(a.boosted)) || (b.tokens.length - a.tokens.length))[0];
  const confidence = best.tokens.length >= 2 ? (best.boosted ? 0.8 : 0.7) : 0.4;
  return found(best.tokens.join(' '), text.slice(best.start, best.end), [best.start, best.end], confidence);
}
