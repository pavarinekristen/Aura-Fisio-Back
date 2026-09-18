import { empty, found, type Extraction } from './types';

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function extractEmail(text: string): Extraction<string> {
  EMAIL_PATTERN.lastIndex = 0;
  const match = EMAIL_PATTERN.exec(text);
  if (!match) return empty<string>();
  return found(match[0].toLowerCase(), match[0], [match.index, match.index + match[0].length], 1);
}
