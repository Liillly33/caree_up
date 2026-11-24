import crypto from 'node:crypto';
import { containsTag } from './licenseCurriculum.js';
import { pyJsonDumps } from './textProcessing.js';

export const PROJECT_VERSION = 'project-curriculum-v4-typescript-drizzle';

const MAIN_TECH: Record<string, string> = {
  SB: 'Spring Boot',
  NEXT: 'Next.js',
  FASTAPI: 'FastAPI',
  TW: 'Tailwind CSS',
  REDIS: 'Redis',
  DRIZZLE: 'Drizzle ORM',
  K8S: 'Kubernetes',
  GHA: 'GitHub Actions',
  TORCH: 'PyTorch',
  VDB: 'Vector Database',
  VERCEL: 'Vercel',
  DOCKER: 'Docker',
};

const ALIASES: Record<string, string[]> = {
  'Spring Boot': ['Spring', 'SpringBoot', '스프링', '스프링부트', '스프링 부트'],
  'Next.js': ['Nextjs', 'Next js'],
  FastAPI: ['Fast API'],
  'Tailwind CSS': ['Tailwind', 'TailwindCSS', '테일윈드'],
  Redis: ['레디스'],
  'Drizzle ORM': ['Drizzle'],
  Kubernetes: ['쿠버네티스', 'K8s'],
  'GitHub Actions': ['GithubActions', '깃허브 액션'],
  PyTorch: ['파이토치'],
  'Vector Database': ['Vector DB', '벡터 데이터베이스', '벡터 DB'],
  Vercel: ['버셀'],
  Docker: ['도커'],
};

const FALLBACK: Record<string, string[]> = {
  'Spring Boot': ['Java'],
  'Next.js': ['React', 'React.js'],
  FastAPI: ['Python', '파이썬'],
  'Tailwind CSS': ['CSS'],
};

function mainTechnology(row: Record<string, unknown>): string | undefined {
  return MAIN_TECH[String(row.PJT_CODE || '').split('_')[0]];
}

function projectTitle(row: Record<string, unknown>): string {
  const main = mainTechnology(row);
  const name = String(row.PJT_NAME || '');
  return !main || name.startsWith(main + ' · ') ? name : `${main} · ${name}`;
}

export function presentProject(row: Record<string, unknown>) {
  return {
    project_id: Number(row.PJT_ID),
    project_code: row.PJT_CODE,
    project_name: projectTitle(row),
    main_technology: mainTechnology(row) ?? null,
    tech_tags: row.PJT_TECH_TAGS,
    final_goal: row.PJT_FINAL_GOAL,
    total_days: row.PJT_TOTAL_DAYS,
    mid_goals: row.PJT_MID_GOALS,
    review_days: row.PJT_REVIEW_DAYS,
    final_criteria: row.PJT_FINAL_CRITERIA,
  };
}

function seoulIsoNow(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+09:00`;
}

export class ProjectCurriculum {
  private locks = new Map<string, Promise<unknown>>();

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) || Promise.resolve();
    const run = prev.then(fn, fn);
    this.locks.set(
      key,
      run.catch(() => undefined)
    );
    return run;
  }

  private matched(text: string, tag: string): boolean {
    const canonical = Object.values(MAIN_TECH).find((m) => m.toLowerCase() === tag.toLowerCase()) || tag;
    return [canonical, ...(ALIASES[canonical] || [])].some((a) => containsTag(text, a));
  }

  candidatesFor(
    road: Record<string, unknown>,
    profile: { tech_skills?: string[] },
    catalog: Record<string, unknown>[]
  ): { gaps: string[]; candidates: Record<string, unknown>[] } {
    const groups: Record<string, Record<string, unknown>[]> = {};
    const sortedCatalog = [...catalog].sort((a, b) => Number(a.PJT_ID) - Number(b.PJT_ID));
    for (const row of sortedCatalog) {
      const main = mainTechnology(row);
      if (main) {
        if (!groups[main]) groups[main] = [];
        groups[main].push(row);
      }
    }

    const sources: [string, string[]][] = [
      ['gaps', String(road.weak || '').split(',').map((g) => g.trim()).filter(Boolean).slice(0, 3)],
      ['strengths', String(road.strong || '').split(',').map((g) => g.trim()).filter(Boolean).slice(0, 3)],
      ['profile', (profile.tech_skills || []).map((g) => String(g))],
    ];

    for (const [source, texts] of sources) {
      if (source === 'gaps' && 'Drizzle ORM' in groups) {
        const index = texts.findIndex((text) =>
          ['TypeScript', 'Type Script', '타입스크립트', '타입 스크립트'].some((alias) => containsTag(text, alias))
        );
        if (index !== -1) {
          return {
            gaps: texts,
            candidates: groups['Drizzle ORM'].map((row) => ({
              ...presentProject(row),
              basis_type: 'gaps',
              learning_target: 'TypeScript',
              evidence: [{ gap_index: index, tags: ['TypeScript', 'Drizzle ORM'] }],
            })),
          };
        }
      }

      const matches: [number, string][] = [];
      for (let idx = 0; idx < texts.length; idx++) {
        for (const main of Object.keys(groups)) {
          if (this.matched(texts[idx], main)) matches.push([idx, main]);
        }
      }
      if (!matches.length) {
        for (let idx = 0; idx < texts.length; idx++) {
          for (const [main, aliases] of Object.entries(FALLBACK)) {
            if (main in groups && aliases.some((a) => containsTag(texts[idx], a))) {
              matches.push([idx, main]);
            }
          }
        }
      }

      if (matches.length) {
        const distinctMains = Array.from(new Set(matches.map(([, m]) => m)));
        distinctMains.sort((a, b) => {
          const countA = new Set(matches.filter(([, m]) => m === a).map(([i]) => i)).size;
          const countB = new Set(matches.filter(([, m]) => m === b).map(([i]) => i)).size;
          if (countA !== countB) return countB - countA;
          const firstA = matches.find(([, m]) => m === a)![0];
          const firstB = matches.find(([, m]) => m === b)![0];
          return firstA - firstB;
        });
        const chosenMain = distinctMains[0];
        const firstIdx = matches.find(([, m]) => m === chosenMain)![0];
        return {
          gaps: texts,
          candidates: groups[chosenMain].map((row) => ({
            ...presentProject(row),
            basis_type: source,
            evidence: [{ gap_index: firstIdx, tags: [chosenMain] }],
          })),
        };
      }
    }

    const groupKeys = Object.keys(groups);
    if (!groupKeys.length) return { gaps: [], candidates: [] };
    const jobMap: Record<string, string> = {
      FE: 'Next.js',
      BE: 'Spring Boot',
      APP: 'Next.js',
      OPS: 'Docker',
      SEC: 'Docker',
      DATA: 'Vector Database',
      AIML: 'PyTorch',
      QA: 'GitHub Actions',
      NET: 'Kubernetes',
    };
    let main = jobMap[String(road.job_code || '')] || 'Spring Boot';
    if (!(main in groups)) main = groupKeys[0];
    return {
      gaps: ['목표 직무에 맞춘 프로젝트 학습'],
      candidates: groups[main].map((row) => ({
        ...presentProject(row),
        basis_type: 'job',
        evidence: [{ gap_index: 0, tags: [main] }],
      })),
    };
  }

  materialize(snapshot: Record<string, unknown>, catalog: Record<string, unknown>[]) {
    const byId = new Map(catalog.map((p) => [Number(p.PJT_ID), p]));
    const recs = ((snapshot.recommendations as Record<string, unknown>[]) || [])
      .filter((x) => byId.has(Number(x.project_id)))
      .map((x) => ({
        ...presentProject(byId.get(Number(x.project_id))!),
        ...x,
      }));
    return { ...snapshot, recommendations: recs };
  }

  recommend(
    road: Record<string, unknown>,
    profile: { tech_skills?: string[] },
    catalog: Record<string, unknown>[],
    cached: Record<string, unknown> | null = null,
    generate = false,
    force = false
  ): { result: Record<string, unknown> | null; changed: boolean } {
    const { gaps, candidates } = this.candidatesFor(road, profile, catalog);
    const evidence = { version: PROJECT_VERSION, job_id: road.job_id, gaps, candidates };
    const basis = crypto.createHash('sha256').update(pyJsonDumps(evidence), 'utf-8').digest('hex');
    const valid = Boolean(cached && typeof cached === 'object' && cached.basis_hash === basis);
    if (!force && valid && cached) {
      return { result: this.materialize(cached, catalog), changed: false };
    }
    if (!generate) return { result: null, changed: false };

    const previous = (cached && Array.isArray(cached.recommendations) ? cached.recommendations : []) as Record<
      string,
      unknown
    >[];
    const previousId = previous.length ? Number(previous[0].project_id) : null;
    const eligible = candidates.filter((p) => !force || Number(p.project_id) !== previousId);
    if (force && !eligible.length && previous.length && valid && cached) {
      return {
        result: { ...this.materialize(cached, catalog), no_alternative: true },
        changed: false,
      };
    }

    const result: Record<string, unknown> = {
      version: PROJECT_VERSION,
      basis_hash: basis,
      generated_at: seoulIsoNow(),
      selection_method: 'main_technology_random',
      recommendations: [],
    };
    if (eligible.length) {
      const project = eligible[crypto.randomInt(eligible.length)];
      const main = String(project.main_technology || '');
      const evidenceArr = project.evidence as { gap_index: number }[];
      const idx = evidenceArr[0].gap_index;
      const target = project.learning_target;
      const basisType = String(project.basis_type || '');
      const reason =
        target === 'TypeScript'
          ? 'TypeScript를 보완할 수 있도록 Drizzle ORM 기반 프로젝트를 추천합니다.'
          : basisType === 'gaps'
          ? `보완이 필요한 ${main} 기술을 연습할 수 있는 프로젝트입니다.`
          : basisType === 'strengths'
          ? `강점을 바탕으로 ${main} 프로젝트 경험을 넓힐 수 있습니다.`
          : `${main} 기술과 프로젝트 경험을 쌓을 수 있는 학습 과제입니다.`;

      result.recommendations = [
        {
          project_id: project.project_id,
          gap_index: idx,
          gap: gaps[idx],
          matching_tags: [main],
          main_technology: main,
          basis_type: basisType,
          reason,
        },
      ];
    }

    return { result: this.materialize(result, catalog), changed: true };
  }
}
