import { extractCpf, isValidCpf } from './cpf';
import { extractPhone } from './phone';
import { extractEmail } from './email';
import { extractDateTime } from './datetime';
import { extractDuration } from './duration';
import { extractRecurrence } from './recurrence';
import { extractPainIntensity } from './pain';
import { extractName } from './name';
import { empty, stripSpans, type Extraction, type ExtractionSet, type ExtractorDefaults } from './types';

export * from './types';
export { isValidCpf, extractCpf, extractPhone, extractEmail, extractDateTime, extractDuration, extractRecurrence, extractPainIntensity, extractName };

/** Apaga um trecho preservando os offsets, para que o próximo extrator não o veja. */
const blank = (text: string, span: [number, number]) => text.slice(0, span[0]) + ' '.repeat(span[1] - span[0]) + text.slice(span[1]);

/**
 * A ordem importa. CPF vem primeiro porque, sem máscara, são 11 dígitos que o
 * extrator de telefone celular engoliria; cada extrator só enxerga o que sobrou.
 * O `remainder` final é o que vai para o LLM — por isso o prompt fica pequeno.
 */
export function extractAll(text: string, now: Date, defaults: ExtractorDefaults = {}): ExtractionSet {
  const consumed: [number, number][] = [];
  let working = text;

  const claim = <T>(extraction: Extraction<T>): Extraction<T> => {
    if (extraction.span && extraction.value !== null) {
      consumed.push(extraction.span);
      working = blank(working, extraction.span);
    }
    return extraction;
  };

  const cpf = claim(extractCpf(working));
  const email = claim(extractEmail(working));
  const phone = claim(extractPhone(working, defaults));
  // Recorrência antes de data/hora: "terças e quintas" é uma série, e o extrator
  // de data consumiria o primeiro dia da semana como se fosse uma data única.
  const recurrence = claim(extractRecurrence(working));
  const datetime = claim(extractDateTime(working, now, defaults));
  const durationMinutes = claim(extractDuration(working));
  const painIntensity = claim(extractPainIntensity(working));
  // O nome sai por último: já não restam números nem datas para confundi-lo.
  const name = claim(extractName(working));

  return {
    cpf, phone, email, datetime, recurrence, durationMinutes, painIntensity, name,
    // Ainda não extraímos data de nascimento em separado: exige desambiguar de
    // uma data de agendamento, e o card já coleta o campo.
    dateOfBirth: empty<string>(),
    consumed,
    remainder: stripSpans(text, consumed),
  };
}
