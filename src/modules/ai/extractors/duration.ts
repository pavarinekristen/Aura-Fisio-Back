import { empty, found, type Extraction } from './types';
import { fold, toNumber } from './numbers';

/** "50 min", "1h", "1h30", "uma hora e meia", "meia hora". */
export function extractDuration(text: string): Extraction<number> {
  const folded = fold(text);

  const at = (re: RegExp, toMinutes: (m: RegExpExecArray) => number | null, confidence = 0.95): Extraction<number> | null => {
    re.lastIndex = 0;
    const m = re.exec(folded);
    if (!m) return null;
    const minutes = toMinutes(m);
    if (minutes === null || minutes <= 0 || minutes > 480) return null;
    return found(minutes, text.slice(m.index, m.index + m[0].length), [m.index, m.index + m[0].length], confidence);
  };

  return at(/\bmeia hora\b/g, () => 30)
    // "1h30", "1 h 30" — precisa vir antes de "1h" solto.
    ?? at(/\b(\d{1,2})\s*h(?:oras?)?\s*(\d{2})\b/g, m => Number(m[1]) * 60 + Number(m[2]))
    ?? at(/\b(\w+|\d{1,2})\s*horas?\s+e\s+meia\b/g, m => { const h = toNumber(m[1]); return h === null ? null : h * 60 + 30; })
    ?? at(/\b(\d{1,3})\s*(?:min|minutos?)\b/g, m => Number(m[1]))
    ?? at(/\b(\w+|\d{1,2})\s*h(?:oras?)?\b/g, m => { const h = toNumber(m[1]); return h === null ? null : h * 60; })
    ?? empty<number>();
}
