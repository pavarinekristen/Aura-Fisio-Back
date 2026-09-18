import { empty, found, type Extraction } from './types';

/** Com ou sem máscara. Ancorado para não casar no meio de um número maior. */
const CPF_PATTERN = /(?<![\d])(\d{3})[.\s]?(\d{3})[.\s]?(\d{3})[-\s]?(\d{2})(?![\d])/g;

/** Dígito verificador mod 11 do CPF, calculado sobre os `length` primeiros dígitos. */
function checkDigit(digits: string, length: number): number {
  let sum = 0;
  for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false;
  // 111.111.111-11 e afins passam no mod 11, então precisam ser barrados à parte.
  if (/^(\d)\1{10}$/.test(digits)) return false;
  return checkDigit(digits, 9) === Number(digits[9]) && checkDigit(digits, 10) === Number(digits[10]);
}

/**
 * Roda antes do telefone: um CPF sem máscara é uma sequência de 11 dígitos e
 * seria devorado pelo extrator de telefone celular.
 */
export function extractCpf(text: string): Extraction<string> {
  CPF_PATTERN.lastIndex = 0;
  let invalid: Extraction<string> | null = null;
  for (const match of text.matchAll(CPF_PATTERN)) {
    const digits = match.slice(1, 5).join('');
    const span: [number, number] = [match.index, match.index + match[0].length];
    if (isValidCpf(digits)) return found(digits, match[0], span, 1);
    // Guarda o primeiro candidato reprovado para poder avisar o profissional.
    invalid ??= { value: null, raw: match[0], span, confidence: 0, reason: 'cpf_check_digit' };
  }
  return invalid ?? empty<string>();
}
