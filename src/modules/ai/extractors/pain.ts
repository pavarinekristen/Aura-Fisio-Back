import { empty, found, type Extraction } from './types';
import { fold } from './numbers';

/** "dor 7", "dor 7/10", "dor nível 8", "7 de dor". */
export function extractPainIntensity(text: string): Extraction<number> {
  const folded = fold(text);

  const at = (re: RegExp): Extraction<number> | null => {
    re.lastIndex = 0;
    const m = re.exec(folded);
    if (!m) return null;
    const value = Number(m[1]);
    if (!Number.isInteger(value) || value < 0 || value > 10) return null;
    return found(value, text.slice(m.index, m.index + m[0].length), [m.index, m.index + m[0].length], 0.9);
  };

  return at(/\bdor\s+(?:de\s+)?(?:nivel\s+)?(\d{1,2})\s*(?:\/\s*10)?\b/g)
    ?? at(/\b(\d{1,2})\s*\/\s*10\b/g)
    ?? at(/\b(\d{1,2})\s+de\s+dor\b/g)
    ?? empty<number>();
}
