import fs from 'node:fs';
import path from 'node:path';
import { norm, TechTokenizer } from './textProcessing.js';
import { ProfileFragmentRecord } from './profileContext.js';

interface ExplanationGroup {
  id: string;
  title: string;
  tokens?: string[];
  categories?: string[];
}

interface ExplanationRules {
  version: string;
  groups: ExplanationGroup[];
  language_roles: Record<string, string>;
}

let cachedRules: ExplanationRules | null = null;
let cachedTokenGroup: Record<string, ExplanationGroup> = {};

function getRules(dataDir?: string): { rules: ExplanationRules; tokenGroup: Record<string, ExplanationGroup> } {
  if (!cachedRules) {
    const rulesPath = path.resolve(dataDir || path.join(process.cwd(), 'data'), 'explanation_rules.json');
    cachedRules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8')) as ExplanationRules;
    cachedTokenGroup = {};
    for (const g of cachedRules.groups) {
      for (const t of g.tokens || []) {
        cachedTokenGroup[norm(t)] = g;
      }
    }
  }
  return { rules: cachedRules, tokenGroup: cachedTokenGroup };
}

const PAST_ACTION = /(?:구현|개발|구축|제작|배포|운영|완성)\s*(?:했|함|완료|경험|$)|프로젝트.{0,15}(?:완료|구축|개발)|\b(?:built|implemented|deployed|operated|developed)\b/i;

function groupFor(token: string, tokenizer: TechTokenizer): ExplanationGroup {
  const { rules, tokenGroup } = getRules();
  if (tokenizer.categories[token] === 'certificate') {
    return rules.groups.find((g) => g.id === 'certificate')!;
  }
  if (token in tokenGroup) return tokenGroup[token];
  const cat = tokenizer.categories[token];
  return rules.groups.find((g) => (g.categories || []).includes(cat)) || rules.groups[rules.groups.length - 1];
}

function displayTokens(tokens: string[], tokenizer: TechTokenizer): string {
  const display: Record<string, string> = {};
  for (const e of tokenizer.config.entries) {
    display[norm(e.canonical)] = e.canonical;
  }
  return tokens.slice(0, 3).map((t) => display[t] || t).join(' / ') + (tokens.length > 3 ? ' 등' : '');
}

export interface SectionRecord {
  text: string;
  match_text?: string;
  item_id: string;
  label: string;
  source?: string;
  label_origin?: string;
  source_column?: string;
  tokens: string[];
  section?: string;
}

function metadata(
  records: SectionRecord[],
  tokens: string[],
  profile: ProfileFragmentRecord[],
  matched: boolean,
  group: ExplanationGroup
) {
  const first = records[0];
  const evidence = Array.from(new Set(records.map((r) => r.text)));
  const tokenSet = new Set(tokens);
  return {
    technology: tokens.find((t) => first.tokens.includes(t)) ?? tokens[0],
    technologies: tokens,
    domain: group.id,
    section: first.section,
    item_id: first.item_id,
    item_ids: Array.from(new Set(records.map((r) => r.item_id))),
    source_column: first.source_column || (first.section === 'requirements' ? 'JOB_REQUIRE' : 'JOB_PREFERRD_QUALIFICATION'),
    job_evidence: evidence[0],
    job_evidences: evidence,
    technical_evidence: first.match_text || first.text,
    profile_evidence: matched
      ? Array.from(new Set(profile.filter((r) => r.technologies.some((t) => tokenSet.has(t))).map((r) => r.text)))
      : [],
    label_origin: first.label_origin ?? null,
    evidence_type: matched ? 'technology' : 'job_requirement',
  };
}

export function buildExplanation(
  sections: Record<string, { included: SectionRecord[] }>,
  profileRecords: ProfileFragmentRecord[],
  queryTokens: Set<string>,
  tokenizer: TechTokenizer,
  idf: Record<string, number>,
  jobCode?: string | null
) {
  const { rules } = getRules();
  const records: SectionRecord[] = [];
  for (const section of ['requirements', 'preferences']) {
    for (const r of sections[section]?.included || []) {
      records.push({ ...r, section });
    }
  }

  const priority = (r: SectionRecord): [number, number, string] => {
    const idfSum = Array.from(new Set(r.tokens)).reduce((s, t) => s + (idf[t] || 0), 0);
    return [r.section !== 'requirements' ? 1 : 0, -idfSum, r.item_id];
  };

  records.sort((a, b) => {
    const pa = priority(a);
    const pb = priority(b);
    if (pa[0] !== pb[0]) return pa[0] - pb[0];
    if (pa[1] !== pb[1]) return pa[1] - pb[1];
    return pa[2] < pb[2] ? -1 : pa[2] > pb[2] ? 1 : 0;
  });

  const groups: Record<string, { group: ExplanationGroup; tokens: Set<string>; records: Map<string, SectionRecord> }> = {};
  for (const record of records) {
    for (const token of new Set(record.tokens)) {
      if (!queryTokens.has(token)) continue;
      const group = groupFor(token, tokenizer);
      if (!groups[group.id]) {
        groups[group.id] = { group, tokens: new Set(), records: new Map() };
      }
      groups[group.id].tokens.add(token);
      if (!groups[group.id].records.has(record.item_id)) {
        groups[group.id].records.set(record.item_id, record);
      }
    }
  }

  const ranked = Object.values(groups).sort((a, b) => {
    const minA = Math.min(...Array.from(a.records.values()).map((r) => priority(r)[0]));
    const minB = Math.min(...Array.from(b.records.values()).map((r) => priority(r)[0]));
    if (minA !== minB) return minA - minB;
    const sumA = Array.from(a.tokens).reduce((s, t) => s + (idf[t] || 0), 0);
    const sumB = Array.from(b.tokens).reduce((s, t) => s + (idf[t] || 0), 0);
    if (sumA !== sumB) return sumB - sumA;
    return a.group.id < b.group.id ? -1 : a.group.id > b.group.id ? 1 : 0;
  });

  const strengths: Record<string, unknown>[] = [];
  for (const bucket of ranked.slice(0, 3)) {
    const group = bucket.group;
    const source = Array.from(bucket.records.values()).sort((a, b) => {
      const pa = priority(a);
      const pb = priority(b);
      if (pa[0] !== pb[0]) return pa[0] - pb[0];
      if (pa[1] !== pb[1]) return pa[1] - pb[1];
      return pa[2] < pb[2] ? -1 : pa[2] > pb[2] ? 1 : 0;
    });
    const tokens = Array.from(bucket.tokens).sort((a, b) => (idf[b] || 0) - (idf[a] || 0) || (a < b ? -1 : a > b ? 1 : 0));
    const names = displayTokens(tokens, tokenizer);
    const item = metadata(source, tokens, profileRecords, true, group) as Record<string, unknown>;

    const experience: Record<string, string[]> = {};
    for (const t of tokens) {
      experience[t] = profileRecords.filter((r) => r.technologies.includes(t) && PAST_ACTION.test(r.text)).map((r) => r.text);
    }
    const hasExperience = Object.values(experience).every((texts) => texts.length > 0);
    let message: string;
    if (group.id === 'certificate') {
      message = `${names} 자격 보유`;
    } else if (hasExperience) {
      const deploy = Object.values(experience).every((texts) =>
        texts.some((text) => text.includes('배포') || /\bdeployed\b/i.test(text))
      );
      message = deploy ? `${names} 기반 서비스 배포 경험` : `${names} 활용 개발·구현 경험`;
    } else {
      const title = group.id === 'language' && jobCode && rules.language_roles[jobCode]
        ? rules.language_roles[jobCode]
        : group.title;
      message = `${names} 기반 ${title}`;
    }
    Object.assign(item, {
      message,
      evidence_level: hasExperience ? 'reported_experience' : 'reported_technology',
      explanation_version: rules.version,
    });
    strengths.push(item);
  }

  const improvements: Record<string, unknown>[] = [];
  const used = new Set<string>();
  for (const record of records) {
    const missing = Array.from(new Set(record.tokens)).filter((t) => !queryTokens.has(t));
    const fresh = missing.filter((t) => !used.has(t));
    if (!missing.length || !fresh.length) continue;
    const tokens = fresh.sort((a, b) => (idf[b] || 0) - (idf[a] || 0) || (a < b ? -1 : a > b ? 1 : 0));
    const names = displayTokens(tokens, tokenizer);
    const group = groupFor(tokens[0], tokenizer);
    const item = metadata([record], tokens, profileRecords, false, group) as Record<string, unknown>;
    const text = record.text;
    const experience = /경험|실무|프로젝트|포트폴리오|experience/i.test(text);
    let message: string;
    if (tokens.every((t) => tokenizer.categories[t] === 'certificate')) {
      message = `${names} 자격 취득 준비`;
    } else if (text.includes('포트폴리오')) {
      message = `${names} 활용 포트폴리오 구성`;
    } else if (text.includes('배포')) {
      message = `${names} 기반 서비스 배포 ${experience ? '경험 보완' : '연습'}`;
    } else if (text.includes('운영')) {
      message = `${names} 기반 운영 ${experience ? '경험 보완' : '연습'}`;
    } else if (text.includes('설계')) {
      message = `${names} 기반 설계 ${experience ? '경험 보완' : '연습'}`;
    } else if (text.includes('프로젝트')) {
      message = `${names} 활용 프로젝트 구현 경험 보완`;
    } else if (experience) {
      message = `${names} 활용 경험 보완`;
    } else {
      message = `${names} 관련 기술 보완`;
    }
    Object.assign(item, {
      message,
      raw_message: text,
      all_missing_technologies: [...missing].sort(),
      recommendation: true,
      explanation_version: rules.version,
    });
    improvements.push(item);
    for (const m of missing) used.add(m);
    if (improvements.length === 3) break;
  }

  return {
    strengths,
    improvements,
    explanation_version: rules.version,
    note: '공고와 사용자 입력에 근거한 기술 요약입니다. 과목 이수·경력연수·숙련도·합격 가능성을 추정하지 않습니다.',
    limited_evidence: strengths.length < 3 || improvements.length < 3,
  };
}
