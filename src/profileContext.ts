import { clauses, norm, TechTokenizer } from './textProcessing.js';

export const UNCERTAIN = new RegExp(
  '(?:경험|해본\\s*적|사용해본\\s*적).{0,12}(?:없|않)|미경험|못했|못함|' +
    '예정|계획|목표|배우고\\s*싶|해보고\\s*싶|희망|준비\\s*중|학습\\s*중|공부\\s*중|' +
    '(?:하지|해보지|사용하지|수행하지|한\\s*적이)\\s*않|안\\s*(?:했|함|해봄)|' +
    '\\b(?:no\\s+experience|never|not\\s+(?:deployed|implemented|used|operated)|plan\\s+to|planning|want\\s+to|hope\\s+to)\\b'
);

export interface ProfileFragmentRecord {
  text: string;
  technologies: string[];
}

export function positiveProfileFragments(
  values: string[],
  tokenizer: TechTokenizer
): { records: ProfileFragmentRecord[]; ignored: string[] } {
  const records: ProfileFragmentRecord[] = [];
  const ignored: string[] = [];
  for (const value of values) {
    for (const clause of clauses(value)) {
      const parts = clause.split(/[,，]|[.!?](?=\s|$)|하지만|그러나|반면/);
      for (const part of parts) {
        const text = part.trim();
        if (!text) continue;
        const tokens = tokenizer.tokens(text);
        if (!tokens.length) continue;
        if (UNCERTAIN.test(norm(text))) {
          ignored.push(text);
          continue;
        }
        records.push({ text, technologies: Array.from(new Set(tokens)).sort() });
      }
    }
  }
  return { records, ignored };
}
