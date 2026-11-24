import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

export const EMPTY = new Set([
  '', '-', '--', '---', '없음', '미기재', '자격요건미기재', '우대사항미기재',
  '원문정보소실', 'null', 'n/a', 'na', '해당없음',
]);

export const STOP = new Set(
  'a an the and or with in on of to for as at by from is are be have has ability skills skill experience experienced required preferred knowledge understanding strong good basic excellent work team teams teamwork communication communicate collaboration responsible responsibility personality motivated responsive driven willingness must can able using used use including etc developer development language framework based hands project projects relevant related degree university bachelor master major years year minimum more than 및 등 관련 기반 경험 이해 보유자 우대 가능자 업무 담당 수행 필수 자격 요건 사항 이상'.split(' ')
);

export function norm(text: string): string {
  return text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function pyJsonDumps(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(pyJsonDumps).join(', ') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return '{' + keys.map((k) => `${JSON.stringify(k)}: ${pyJsonDumps(obj[k])}`).join(', ') + '}';
  }
  return 'null';
}

export function sha(value: unknown): string {
  return crypto.createHash('sha256').update(pyJsonDumps(value), 'utf-8').digest('hex').slice(0, 24);
}

export function itemId(text: string): string {
  return crypto.createHash('sha256').update(norm(text), 'utf-8').digest('hex').slice(0, 24);
}

export function empty(text: unknown): boolean {
  return EMPTY.has(String(text ?? '').replace(/\s+/g, '').toLowerCase());
}

export function* leaves(value: unknown): Generator<string> {
  if (value === null || value === undefined) return;
  if (typeof value === 'object' && !Array.isArray(value)) {
    for (const v of Object.values(value as Record<string, unknown>)) {
      yield* leaves(v);
    }
  } else if (Array.isArray(value)) {
    for (const v of value) {
      yield* leaves(v);
    }
  } else if (typeof value === 'string') {
    const text = value.trim();
    if (empty(text)) return;
    if (text.startsWith('{') || text.startsWith('[') || text.startsWith('"')) {
      let parsed: unknown = null;
      let ok = false;
      try {
        parsed = JSON.parse(text);
        ok = true;
      } catch {
        try {
          parsed = JSON.parse(text.replace(/\\"/g, '"'));
          ok = true;
        } catch {
          ok = false;
        }
      }
      if (ok && ((typeof parsed === 'object' && parsed !== null) || (typeof parsed === 'string' && parsed !== value))) {
        yield* leaves(parsed);
        return;
      }
    }
    yield text;
  } else {
    yield String(value);
  }
}

export function clauses(value: unknown): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const rawText of leaves(value)) {
    const text = rawText.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r/g, '\n');
    const parts = text.split(/[\n;•●▪ㆍ]+|(?<=\s)·(?=\s)/);
    for (let line of parts) {
      line = line.replace(/^\s*(?:[-*·ㆍ?]+|\d+[.)])\s*/, '').trim();
      if (empty(line) || /^\[[^\]]+\]\s*:?$|^[-—–]+$/.test(line)) continue;
      const key = norm(line);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(line);
      }
    }
  }
  return result;
}

export interface TechEntry {
  canonical: string;
  category: string;
  aliases: string[];
  score_enabled?: boolean;
}

export interface TechDictionaryConfig {
  version: number;
  entries: TechEntry[];
}

export interface TokenAnalysis {
  tokens: string[];
  explicit: string[];
  projection: string;
  excluded_terms: string[];
  unregistered_terms: string[];
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class TechTokenizer {
  config: TechDictionaryConfig;
  aliases: Record<string, string> = {};
  categories: Record<string, string> = {};
  scoring: Record<string, boolean> = {};
  pattern: RegExp;
  version: string;

  constructor(dictPath: string) {
    this.config = JSON.parse(fs.readFileSync(dictPath, 'utf-8')) as TechDictionaryConfig;
    for (const entry of this.config.entries) {
      const canonical = norm(entry.canonical);
      this.categories[canonical] = entry.category;
      this.scoring[canonical] = entry.score_enabled ?? true;
      for (const rawAlias of entry.aliases) {
        const alias = norm(rawAlias);
        if (alias in this.aliases && this.aliases[alias] !== canonical) {
          throw new Error('사전 별칭 중복: ' + alias);
        }
        this.aliases[alias] = canonical;
      }
    }
    const sorted = Object.keys(this.aliases).sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
    const alternatives = sorted.map(escapeRegExp).join('|');
    this.pattern = new RegExp(`(?<![a-z0-9_+#])(?:${alternatives})(?![a-z0-9_+#])`, 'g');
    this.version = sha(this.config);
  }

  analyze(rawText: string): TokenAnalysis {
    const text = norm(rawText);
    const tokens: string[] = [];
    const excluded: string[] = [];
    const chars = Array.from(text);
    this.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = this.pattern.exec(text)) !== null) {
      const matchedStr = match[0];
      const token = this.aliases[matchedStr];
      if (this.scoring[token]) {
        tokens.push(token);
      } else {
        excluded.push(token);
      }
      for (let i = match.index; i < match.index + matchedStr.length; i++) {
        chars[i] = ' ';
      }
    }
    const masked = chars.join('');
    const unknownMatches = masked.match(/[a-z][a-z0-9]*(?:[.+/#_-][a-z0-9]+)*/g) ?? [];
    const unknown = Array.from(new Set(unknownMatches.filter((t) => !STOP.has(t) && t.length > 1))).sort();
    const dedupedTokens = Array.from(new Set(tokens));
    const explicit = [...dedupedTokens].sort();
    return {
      tokens: dedupedTokens,
      explicit,
      projection: dedupedTokens.join(' '),
      excluded_terms: Array.from(new Set(excluded)).sort(),
      unregistered_terms: unknown,
    };
  }

  tokens(text: string): string[] {
    return this.analyze(text).tokens;
  }
}

export interface LabelRow {
  item_id: string;
  text: string;
  label: string;
  match_text?: string;
  split?: string;
  notes?: string;
  sources?: string;
  label_source?: string;
}

export function loadLabels(csvPath: string): Record<string, LabelRow> {
  const raw = fs.readFileSync(path.resolve(csvPath), 'utf-8').replace(/^\uFEFF/, '');
  const rows = parse(raw, { columns: true, skip_empty_lines: true }) as LabelRow[];
  const result: Record<string, LabelRow> = {};
  for (const row of rows) {
    row.label = (row.label || '').trim().toUpperCase();
    if (!['TECH', 'NONTECH', 'REVIEW'].includes(row.label)) continue;
    if (row.item_id !== itemId(row.text)) {
      throw new Error('라벨 ID/원문 불일치');
    }
    if (row.item_id in result) {
      throw new Error('라벨 ID 중복');
    }
    result[row.item_id] = row;
  }
  return result;
}
