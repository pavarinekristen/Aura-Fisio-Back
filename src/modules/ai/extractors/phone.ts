import { empty, found, type Extraction, type ExtractorDefaults } from './types';

/** DDDs que existem de fato. Barra "(00)" e afins. */
const VALID_DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** +55 opcional, DDD opcional entre parênteses, 8 ou 9 dígitos com separador opcional. */
const PHONE_PATTERN = /(?<![\d])(?:\+?55[\s-]?)?(?:\(?(\d{2})\)?[\s.-]?)?(\d{4,5})[\s.-]?(\d{4})(?![\d])/g;

/**
 * Normaliza para E.164 (+55DDDNNNNNNNNN). Deve rodar depois do CPF, cujos
 * trechos já saíram do texto, para não confundir 11 dígitos de CPF com celular.
 */
export function extractPhone(text: string, defaults: ExtractorDefaults = {}): Extraction<string> {
  PHONE_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(PHONE_PATTERN)) {
    const [raw, rawDdd, prefix, suffix] = match;
    const ddd = rawDdd ?? defaults.ddd ?? null;
    if (!ddd || !VALID_DDD.has(Number(ddd))) continue;
    const local = `${prefix}${suffix}`;
    // Celular tem 9 dígitos e começa com 9; fixo tem 8 e começa entre 2 e 5.
    if (local.length === 9 && !local.startsWith('9')) continue;
    if (local.length === 8 && !/^[2-5]/.test(local)) continue;
    if (local.length !== 8 && local.length !== 9) continue;
    const span: [number, number] = [match.index, match.index + raw.length];
    // Sem DDD explícito ficamos no chute do default: confiança baixa, o card confirma.
    return found(`+55${ddd}${local}`, raw, span, rawDdd ? 0.95 : 0.5);
  }
  return empty<string>();
}
