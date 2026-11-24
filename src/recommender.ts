import fs from 'node:fs';
import path from 'node:path';
import { buildExplanation, SectionRecord } from './explanations.js';
import { assignImportance, ImportanceAssignment, RULE_VERSION } from './importanceRules.js';
import { importanceCoverage } from './importanceScoring.js';
import { positiveProfileFragments, UNCERTAIN } from './profileContext.js';
import { loadReviews, ReviewSummary } from './technologyImportance.js';
import { clauses, itemId, LabelRow, loadLabels, norm, sha, TechTokenizer } from './textProcessing.js';

export const MODEL_NAME = 'jhgan/ko-sroberta-multitask';
export const RANKING_VERSION = 'project-semantic-v7';
export const PROJECT_SEMANTIC_VERSION = 'project-task-cosine-v1';

export class LexicalOnlyEncoder {
  mode = 'lexical_only';
  name = 'none';
  revision: string | null = null;
}

interface FilterDecision {
  label: string;
  source: string;
  label_origin?: string;
  match_text: string;
  neighbors: unknown[];
}

export class ExampleFilter {
  labels: Record<string, LabelRow>;
  encoder: LexicalOnlyEncoder;
  references: LabelRow[];

  constructor(labels: Record<string, LabelRow>, encoder: LexicalOnlyEncoder) {
    this.labels = labels;
    this.encoder = encoder;
    this.references = Object.values(labels).filter(
      (r) => ['USER', 'USER_PREVIOUS'].includes(r.label_source || 'USER') && ['TECH', 'NONTECH'].includes(r.label)
    );
    const refLabels = new Set(this.references.map((r) => r.label));
    if (!refLabels.has('TECH') || !refLabels.has('NONTECH')) {
      throw new Error('사람이 작성한 TECH/NONTECH 예시가 모두 필요합니다.');
    }
  }

  classifyMany(texts: string[], allowExact = true): Record<string, FilterDecision> {
    const results: Record<string, FilterDecision> = {};
    const seen = new Set<string>();
    for (const text of texts) {
      if (seen.has(text)) continue;
      seen.add(text);
      const known = allowExact ? this.labels[itemId(text)] : undefined;
      if (known) {
        results[text] = {
          label: known.label,
          source: 'csv_exact',
          label_origin: known.label_source || 'USER',
          match_text: (known.match_text || '').trim() || text,
          neighbors: [],
        };
      } else {
        results[text] = {
          label: 'REVIEW',
          source: 'unseen_in_lexical_mode',
          match_text: '',
          neighbors: [],
        };
      }
    }
    return results;
  }
}

export class JobBM25 {
  documents: Map<string, number>[];
  n: number;
  k1: number;
  b: number;
  lengths: number[];
  avgdl: number;
  df: Record<string, number> = {};
  idf: Record<string, number> = {};
  weights: Record<string, number>[] = [];

  constructor(documents: string[][], k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.n = documents.length;
    this.documents = documents.map((doc) => {
      const counts = new Map<string, number>();
      for (const t of doc) counts.set(t, (counts.get(t) || 0) + 1);
      return counts;
    });
    this.lengths = this.documents.map((doc) => {
      let sum = 0;
      for (const v of doc.values()) sum += v;
      return sum;
    });
    const totalLen = this.lengths.reduce((a, b) => a + b, 0);
    this.avgdl = this.n ? totalLen / this.n : 0;

    for (const doc of this.documents) {
      for (const t of doc.keys()) {
        this.df[t] = (this.df[t] || 0) + 1;
      }
    }
    for (const [t, v] of Object.entries(this.df)) {
      this.idf[t] = Math.log(1 + (this.n - v + 0.5) / (v + 0.5));
    }
    for (let i = 0; i < this.documents.length; i++) {
      const doc = this.documents[i];
      const length = this.lengths[i];
      const w: Record<string, number> = {};
      for (const [t, tf] of doc.entries()) {
        w[t] = (this.idf[t] * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * length) / (this.avgdl || 1)));
      }
      this.weights.push(w);
    }
  }

  scoreAgainstReference(
    jobIndex: number,
    itemTokens: Set<string>,
    profileTokens: Set<string>,
    referenceMass: number,
    referenceCount: number
  ) {
    let raw = 0;
    const w = this.weights[jobIndex];
    for (const t of itemTokens) {
      if (profileTokens.has(t) && t in w) raw += w[t];
    }
    const lengthFactor = 1 - this.b + (this.b * referenceCount) / (this.avgdl || 1);
    const reference = (referenceMass * (this.k1 + 1)) / (1 + this.k1 * lengthFactor);
    return {
      raw,
      reference_score: reference,
      normalized: reference ? Math.min(1, raw / reference) : 0.0,
      clipped: Boolean(reference && raw > reference),
      reference_basis: 'fixed_corpus_role',
      document_length: this.lengths[jobIndex],
      average_document_length: this.avgdl,
    };
  }
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface ScoringPolicy {
  version: number;
  technical_points: number;
  preference_bonuses: number[];
  company_scale_bonuses: Record<string, number>;
  unknown_company_bonus: number;
  semantic_weight: number;
  section_weights: Record<string, number>;
  bm25_weight: number;
  importance_weights: { core: number; auxiliary: number; neutral: number };
  project_semantic: {
    section_weights: Record<string, number>;
    similarity_floor: number;
    similarity_ceiling: number;
    duplicate_cosine: number;
  };
}

interface RoleReference {
  idf_mass: number;
  technology_count: number;
  sample_count: number;
  basis: string;
}

interface IndexedRecord extends SectionRecord {
  excluded_terms?: string[];
  unregistered_terms?: string[];
  explicit?: string[];
  projection?: string;
  human_excluded_technologies?: string[];
  technology_importance?: Record<string, ImportanceAssignment | string>;
}

export interface UserProfile {
  tech_skills?: string[];
  licenses?: string[];
  project_experience?: string;
}

export class Recommender {
  policy: ScoringPolicy;
  encoder: LexicalOnlyEncoder;
  tokenizer: TechTokenizer;
  labels: Record<string, LabelRow>;
  filter: ExampleFilter;
  jobs: Record<string, unknown>[];
  importanceReviews: Record<number, Record<string, string>>;
  importanceSummary: ReviewSummary;
  importanceVersion: string | null;
  index: Record<string, IndexedRecord[]>[];
  importanceAssignments: Record<string, ImportanceAssignment>[];
  bm25: JobBM25;
  unseenIdf: number;
  jobTechnologies: Set<string>[];
  globalReference!: RoleReference;
  roleReferences: Record<string, RoleReference> = {};
  version: string;

  constructor(
    jobs: Record<string, unknown>[],
    labelsPath: string,
    dictionaryPath: string,
    policyPath?: string
  ) {
    const resolvedPolicyPath = policyPath || path.join(path.dirname(dictionaryPath), 'scoring_policy.json');
    this.policy = JSON.parse(fs.readFileSync(resolvedPolicyPath, 'utf-8')) as ScoringPolicy;
    this.encoder = new LexicalOnlyEncoder();
    this.tokenizer = new TechTokenizer(dictionaryPath);
    this.labels = loadLabels(labelsPath);
    this.filter = new ExampleFilter(this.labels, this.encoder);

    const seenIds = new Set<number>();
    for (const j of jobs) {
      if (typeof j.JOB_ANN_ID !== 'number' || !Number.isInteger(j.JOB_ANN_ID)) {
        throw new Error('공고 ID는 정수여야 합니다.');
      }
      if (seenIds.has(j.JOB_ANN_ID)) throw new Error('중복 공고 ID가 있습니다.');
      seenIds.add(j.JOB_ANN_ID);
    }
    this.jobs = [...jobs].sort((a, b) => Number(a.JOB_ANN_ID) - Number(b.JOB_ANN_ID));

    const reviewsLoaded = loadReviews(
      path.join(path.dirname(dictionaryPath), 'technology_importance_reviews.json'),
      this.jobs
    );
    this.importanceReviews = reviewsLoaded.reviews;
    this.importanceSummary = reviewsLoaded.summary;
    this.importanceVersion = reviewsLoaded.version;

    const allTexts: string[] = [];
    for (const j of this.jobs) {
      for (const col of ['JOB_REQUIRE', 'JOB_PREFERRD_QUALIFICATION']) {
        allTexts.push(...clauses(j[col]));
      }
    }
    const decisions = this.filter.classifyMany(allTexts);

    this.index = [];
    const documents: string[][] = [];

    for (const job of this.jobs) {
      const jid = Number(job.JOB_ANN_ID);
      const reviewed = this.importanceReviews[jid] || {};
      const excludedTechnologies = new Set(
        Object.entries(reviewed)
          .filter(([, label]) => label === '제외')
          .map(([t]) => t)
      );
      const sections: Record<string, IndexedRecord[]> = {};
      const document: string[] = [];

      for (const [section, column] of [
        ['requirements', 'JOB_REQUIRE'],
        ['preferences', 'JOB_PREFERRD_QUALIFICATION'],
      ] as const) {
        const records: IndexedRecord[] = [];
        for (const text of clauses(job[column])) {
          const decision: FilterDecision = { ...decisions[text] };
          const verified = this.tokenizer.tokens(text).filter((t) => ['핵심', '보조'].includes(reviewed[t]));
          if (verified.length && decision.label !== 'TECH') {
            decision.label = 'TECH';
            decision.source = 'human_importance_review';
            decision.match_text = text;
            decision.label_origin = 'USER';
          }
          const record: IndexedRecord = {
            text,
            ...decision,
            item_id: itemId(text),
            source_column: column,
            tokens: [],
          };
          if (decision.label === 'TECH') {
            const analysis = this.tokenizer.analyze(decision.match_text);
            const removed = analysis.tokens.filter((t) => excludedTechnologies.has(t));
            analysis.tokens = analysis.tokens.filter((t) => !excludedTechnologies.has(t));
            analysis.explicit = Array.from(new Set(analysis.tokens)).sort();
            analysis.projection = analysis.tokens.join(' ');
            record.human_excluded_technologies = Array.from(new Set(removed)).sort();
            const techImp: Record<string, string> = {};
            for (const t of analysis.tokens) {
              if (t in reviewed) techImp[t] = reviewed[t];
            }
            record.technology_importance = techImp;
            if (analysis.tokens.length) {
              Object.assign(record, analysis);
              document.push(...analysis.tokens);
            } else if (removed.length) {
              record.label = 'NONTECH';
              record.source = 'human_excluded_technologies';
            } else {
              record.label = 'REVIEW';
              record.source = 'no_scoring_tokens';
            }
          }
          records.push(record);
        }
        sections[section] = records;
      }

      const existing = new Set<string>();
      for (const records of Object.values(sections)) {
        for (const r of records) {
          if (r.label === 'TECH') {
            for (const t of r.tokens) existing.add(t);
          }
        }
      }
      for (const text of clauses(job.JOB_RESPONSIBILITIES)) {
        const tokens = this.tokenizer
          .tokens(text)
          .filter((t) => ['핵심', '보조'].includes(reviewed[t]) && !existing.has(t));
        if (!tokens.length) continue;
        const techImp: Record<string, string> = {};
        for (const t of tokens) techImp[t] = reviewed[t];
        sections.requirements.push({
          text,
          match_text: text,
          item_id: itemId(text),
          label: 'TECH',
          source: 'human_importance_review',
          label_origin: 'USER',
          source_column: 'JOB_RESPONSIBILITIES',
          tokens,
          explicit: [...tokens].sort(),
          projection: tokens.join(' '),
          excluded_terms: [],
          unregistered_terms: [],
          technology_importance: techImp,
        });
        document.push(...tokens);
        for (const t of tokens) existing.add(t);
      }

      this.index.push(sections);
      documents.push(document);
    }

    this.importanceAssignments = [];
    for (let i = 0; i < this.jobs.length; i++) {
      const job = this.jobs[i];
      const sections = this.index[i];
      const docSet = new Set(documents[i]);
      const assignments = assignImportance(
        job,
        docSet,
        this.importanceReviews[Number(job.JOB_ANN_ID)] || {},
        this.tokenizer
      );
      this.importanceAssignments.push(assignments);
      for (const records of Object.values(sections)) {
        for (const record of records) {
          if (record.label === 'TECH') {
            const map: Record<string, ImportanceAssignment> = {};
            for (const t of record.tokens) map[t] = assignments[t];
            record.technology_importance = map;
          }
        }
      }
    }

    this.bm25 = new JobBM25(documents);
    this.unseenIdf = Math.log(1 + (documents.length + 0.5) / 0.5);
    this.jobTechnologies = documents.map((d) => new Set(d));
    this._buildRoleReferences();

    this.version = sha({
      jobs: this.jobs,
      labels: Object.values(this.labels),
      dictionary: this.tokenizer.config,
      importance_reviews: this.importanceVersion,
      ranking_version: RANKING_VERSION,
      project_semantic_version: PROJECT_SEMANTIC_VERSION,
      importance_rule_version: RULE_VERSION,
      policy: this.policy,
      non_performed_pattern: UNCERTAIN.source,
      model: this.encoder.name,
      revision: this.encoder.revision,
      mode: this.encoder.mode,
    });
  }

  private _buildRoleReferences() {
    const groups: Record<string, [number, number][]> = {};
    const allValues: [number, number][] = [];
    for (let i = 0; i < this.jobs.length; i++) {
      const terms = this.jobTechnologies[i];
      if (!terms.size) continue;
      let idfMass = 0;
      for (const t of terms) idfMass += this.bm25.idf[t] || 0;
      const val: [number, number] = [idfMass, terms.size];
      const code = String(this.jobs[i].JOB_CODE || '');
      if (!groups[code]) groups[code] = [];
      groups[code].push(val);
      allValues.push(val);
    }
    const ref = (values: [number, number][], basis: string): RoleReference => ({
      idf_mass: values.length ? median(values.map((v) => v[0])) : 0.0,
      technology_count: values.length ? median(values.map((v) => v[1])) : 0,
      sample_count: values.length,
      basis,
    });
    this.globalReference = ref(allValues, 'global_corpus_median');
    this.roleReferences = {};
    for (const [code, values] of Object.entries(groups)) {
      this.roleReferences[code] = ref(values, 'job_code_median');
    }
  }

  private _companyBonus(scale: unknown): number {
    const normalized = norm(String(scale || ''));
    for (const [k, v] of Object.entries(this.policy.company_scale_bonuses)) {
      if (norm(k) === normalized) return v;
    }
    return this.policy.unknown_company_bonus;
  }

  explainJob(profile: UserProfile, jobId: number) {
    const index = this.jobs.findIndex((j) => Number(j.JOB_ANN_ID) === jobId);
    if (index === -1) {
      const err = new Error(String(jobId)) as Error & { code?: string };
      err.code = 'JOB_NOT_FOUND';
      throw err;
    }
    const values: string[] = [];
    for (const key of ['tech_skills', 'licenses'] as const) {
      const rows = profile[key] ?? [];
      if (!Array.isArray(rows) || rows.some((t) => typeof t !== 'string')) {
        throw new Error('스펙은 문자열 배열이어야 합니다.');
      }
      for (const t of rows) {
        if (t.trim()) values.push(t.trim());
      }
    }
    const fragments = positiveProfileFragments(values, this.tokenizer);
    const query = new Set<string>();
    for (const r of fragments.records) {
      for (const t of r.technologies) query.add(t);
    }
    const sections: Record<string, { included: SectionRecord[] }> = {};
    for (const [name, records] of Object.entries(this.index[index])) {
      sections[name] = { included: records.filter((r) => r.label === 'TECH') };
    }
    return buildExplanation(
      sections,
      fragments.records,
      query,
      this.tokenizer,
      this.bm25.idf,
      String(this.jobs[index].JOB_CODE || '')
    );
  }

  recommend(
    profile: UserProfile,
    jobCodes: string[] | null = null,
    topK = 5,
    method: 'exact' | 'bm25' | 'hybrid' = 'hybrid',
    deduplicate = true,
    includeUnmatched = false
  ) {
    if (!Number.isInteger(topK) || topK < 1 || topK > 1000) {
      throw new Error('top_k는 1~1000 정수여야 합니다.');
    }
    if (jobCodes !== null) {
      if (
        !Array.isArray(jobCodes) ||
        jobCodes.length > 3 ||
        jobCodes.some((c) => typeof c !== 'string') ||
        new Set(jobCodes).size !== jobCodes.length
      ) {
        throw new Error('선호직무는 중복 없이 최대 3개여야 합니다.');
      }
    }
    const preferenceBonus = new Map<string, number>();
    (jobCodes || []).forEach((code, idx) => {
      preferenceBonus.set(code, this.policy.preference_bonuses[idx] ?? 0);
    });

    const values: string[] = [];
    for (const key of ['tech_skills', 'licenses'] as const) {
      const value = profile[key] ?? [];
      if (!Array.isArray(value) || value.some((t) => typeof t !== 'string')) {
        throw new Error('스펙은 문자열 배열이어야 합니다.');
      }
      for (const t of value) {
        if (t.trim()) values.push(t.trim());
      }
    }
    if (!values.length) {
      throw new Error('마이페이지에 보유 기술 스택·자격증 또는 수행한 프로젝트 역할을 입력해주세요.');
    }

    const profileEvidence = positiveProfileFragments(values, this.tokenizer);
    const profileRecords = profileEvidence.records;
    const query = new Set<string>();
    for (const r of profileRecords) {
      for (const t of r.technologies) query.add(t);
    }
    if (!query.size) {
      throw new Error('구체적인 기술명이나 실제 수행한 프로젝트 역할을 입력해주세요.');
    }

    const effectiveWeights = (): [number, number, number] => {
      if (method === 'exact') return [1.0, 0.0, 0.0];
      const base = this.policy.importance_weights.core + this.policy.importance_weights.auxiliary;
      const bm = this.policy.bm25_weight;
      const total = base + bm;
      return [base / total, bm / total, 0.0];
    };
    const [coverageWeight, bm25Weight, semanticWeight] = effectiveWeights();
    const results: Record<string, unknown>[] = [];

    for (let i = 0; i < this.jobs.length; i++) {
      const job = this.jobs[i];
      const sections = this.index[i];
      const context = this.roleReferences[String(job.JOB_CODE || '')] ?? this.globalReference;
      const jobTechs = this.jobTechnologies[i];
      const scopedQuery = Array.from(query).filter((t) => jobTechs.has(t));

      const [rowCoverageWeight, rowBm25Weight, rowSemanticWeight] = effectiveWeights();
      const importanceLabels: Record<string, string> = {};
      for (const [t, r] of Object.entries(this.importanceAssignments[i])) {
        importanceLabels[t] = r.label;
      }
      const { contributions: importancePoints, details: importanceDetails } = importanceCoverage(
        jobTechs,
        query,
        importanceLabels,
        this.bm25.idf,
        context.technology_count,
        rowCoverageWeight,
        this.policy.importance_weights
      );

      const out: Record<string, { included: SectionRecord[]; [k: string]: unknown }> = {};
      let weightSum = 0.0;
      let reviewCount = 0;
      const knownMatches = new Set<string>();
      let bm25Sum = 0.0;

      for (const [section, weight] of Object.entries(this.policy.section_weights)) {
        const scored: (IndexedRecord & { matched_tokens: string[] })[] = [];
        const excluded: IndexedRecord[] = [];
        for (const record of sections[section]) {
          if (record.label !== 'TECH') {
            excluded.push(record);
            if (record.label === 'REVIEW') reviewCount += 1;
            continue;
          }
          const matched = record.tokens.filter((t) => query.has(t));
          for (const m of matched) knownMatches.add(m);
          scored.push({ ...record, matched_tokens: Array.from(new Set(matched)).sort() });
        }
        const terms = new Set<string>();
        for (const r of scored) for (const t of r.tokens) terms.add(t);
        const bm25 = this.bm25.scoreAgainstReference(i, terms, query, context.idf_mass, context.technology_count);
        const contributions: Record<string, number> = {
          ...importancePoints,
          bm25: 100 * rowBm25Weight * bm25.normalized,
          sbert: 0,
        };
        const sectionScore = scored.length ? Object.values(contributions).reduce((a, b) => a + b, 0) : null;
        out[section] = {
          score_100: sectionScore !== null ? Number(sectionScore.toFixed(4)) : null,
          included: scored,
          excluded,
        };
        if (sectionScore !== null) {
          weightSum += weight;
          bm25Sum += weight * bm25.normalized;
        }
      }

      const eligible = knownMatches.size > 0;
      const technicalAvailable = jobTechs.size > 0;
      const normalizedComponents: Record<string, number> = {
        ...importancePoints,
        bm25: 100 * rowBm25Weight * (weightSum ? bm25Sum / weightSum : 0),
        sbert: 0,
      };
      const technical = technicalAvailable
        ? Object.values(normalizedComponents).reduce((a, b) => a + b, 0)
        : null;
      const bonus = eligible ? preferenceBonus.get(String(job.JOB_CODE)) || 0 : 0;
      const companyBonus = eligible ? this._companyBonus(job.JOB_CORP_SCALE) : 0;
      const points = technical !== null ? (technical * this.policy.technical_points) / 100 : null;
      const finalScore = points !== null ? points + bonus + companyBonus : null;

      results.push({
        job_id: job.JOB_ANN_ID,
        job_code: job.JOB_CODE,
        company: job.JOB_CORP_NAME,
        title: job.JOB_ANN_TITLE,
        responsibilities: job.JOB_RESPONSIBILITIES,
        url: job.JOB_URL,
        score_100: finalScore !== null ? Number(finalScore.toFixed(2)) : null,
        technical_score_100: technical !== null ? Number(technical.toFixed(2)) : null,
        technical_points: points !== null ? Number(points.toFixed(2)) : null,
        technical_max_points: this.policy.technical_points,
        scoped_profile_tokens: scopedQuery.sort(),
        company_scale: job.JOB_CORP_SCALE,
        company_bonus: companyBonus,
        importance: importanceDetails,
        project_semantic: { status: 'SEMANTIC_DISABLED', score: null, evidence: [], sections: {} },
        effective_weights: { coverage: rowCoverageWeight, bm25: rowBm25Weight, sbert: rowSemanticWeight },
        preference_bonus: bonus,
        preference_rank: jobCodes && jobCodes.includes(String(job.JOB_CODE)) ? jobCodes.indexOf(String(job.JOB_CODE)) + 1 : null,
        eligible,
        status: eligible ? 'SCORED' : technicalAvailable ? 'NO_TECH_OVERLAP' : 'INSUFFICIENT_TECH',
        provisional: Boolean(reviewCount || importanceDetails.groups.neutral.technologies.length),
        explanation: buildExplanation(
          out,
          profileRecords,
          query,
          this.tokenizer,
          this.bm25.idf,
          String(job.JOB_CODE || '')
        ),
      });
    }

    results.sort((a, b) => {
      const aNull = a.score_100 === null ? 1 : 0;
      const bNull = b.score_100 === null ? 1 : 0;
      if (aNull !== bNull) return aNull - bNull;
      const diff = Number(b.score_100 || 0) - Number(a.score_100 || 0);
      if (diff !== 0) return diff;
      return Number(a.job_id) - Number(b.job_id);
    });

    const eligibleCount = results.filter((r) => r.eligible).length;
    let filtered = includeUnmatched ? results : results.filter((r) => r.eligible);
    const rawCount = filtered.length;
    if (deduplicate) {
      const seen = new Set<string>();
      const unique: Record<string, unknown>[] = [];
      for (const row of filtered) {
        const key = row.job_id !== undefined && row.job_id !== null ? 'id:' + String(row.job_id) : 'content:' + sha(row);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(row);
      }
      filtered = unique;
    }

    return {
      index_version: this.version,
      ranking_version: RANKING_VERSION,
      method,
      encoder_mode: this.encoder.mode,
      encoder_model: this.encoder.name,
      sbert_enabled: false,
      active_weights: { coverage: coverageWeight, bm25: bm25Weight, sbert: semanticWeight },
      corpus_job_count: this.bm25.n,
      raw_candidate_count: rawCount,
      eligible_job_count: eligibleCount,
      candidate_count: filtered.length,
      profile_tokens: Array.from(query).sort(),
      results: filtered.slice(0, topK),
    };
  }

  static fromFolder(folder: string): Recommender {
    const jobs = JSON.parse(fs.readFileSync(path.join(folder, 'data/jobs.json'), 'utf-8')) as Record<string, unknown>[];
    const excludedData = JSON.parse(
      fs.readFileSync(path.join(folder, 'data/excluded_jobs.json'), 'utf-8')
    ) as { excluded_ids: number[] };
    const excluded = new Set(excludedData.excluded_ids);
    return new Recommender(
      jobs.filter((j) => !excluded.has(Number(j.JOB_ANN_ID))),
      path.join(folder, 'data/labels.csv'),
      path.join(folder, 'data/tech_dictionary.json'),
      path.join(folder, 'data/scoring_policy.json')
    );
  }
}
