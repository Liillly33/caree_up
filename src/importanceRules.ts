import { clauses, sha, TechTokenizer } from './textProcessing.js';

export const ROLE_CORE: Record<string, Set<string>> = {
  AIML: new Set(['python', 'pytorch', 'tensorflow', 'r', 'scikit-learn', 'onnx', 'cuda']),
  BE: new Set(['python', 'java', 'c', 'c++', 'c#', 'go', 'rust', 'kotlin', 'php', 'ruby', 'spring', 'fastapi', 'django', 'flask', 'node.js', '.net', 'express', 'nestjs']),
  FE: new Set(['javascript', 'typescript', 'react', 'vue.js', 'angular', 'angularjs', 'next.js', 'html', 'css', 'tailwind css']),
  APP: new Set(['swift', 'kotlin', 'java', 'objective-c', 'flutter', 'dart', 'react native']),
  OPS: new Set(['aws', 'azure', 'gcp', 'linux', 'docker', 'kubernetes', 'terraform', 'ansible', 'ci/cd', 'github actions', 'jenkins', 'argo cd']),
  DATA: new Set(['python', 'r', 'sql', 'spark', 'hadoop', 'airflow', 'kafka', 'mysql', 'postgresql', 'oracle', 'sql server', 'mongodb', 'snowflake']),
  ERP: new Set(['java', 'c#', '.net', 'spring', 'sql', 'oracle', 'sql server', 'sap', 'abap']),
  IOT: new Set(['c', 'c++', 'rust', 'linux', 'rtos', 'freertos', 'fpga', 'cuda']),
  NET: new Set(['tcp/ip', 'ethernet', 'linux', 'cisco', 'wireshark', 'ccna', 'ccnp']),
  SEC: new Set(['linux', 'tcp/ip', 'http', 'ssl', 'wireshark', 'python', 'c', 'c++']),
  QA: new Set(['python', 'java', 'javascript', 'selenium', 'appium', 'jmeter', 'pytest', 'postman']),
  GAME: new Set(['c++', 'c#', 'unity', 'unreal engine', 'lua']),
};

const ACTION = /개발|구현|설계|운영|구축|배포|분석|활용|작성|관리|최적화|실무|경험|능숙|이해|숙련|가능|다룰|기반/i;
const OPTIONAL = /우대|있으면|선호|좋(?:아요|습니다|겠)|플러스|preferred|nice.to.have/i;
const MANDATORY = /필수|반드시|꼭.{0,8}(?:필요|있어야)|must|required/i;
const STACK = /기술\s*스택|사용\s*언어|개발환경|tech\s*stack/i;

export const RULE_VERSION = sha({
  role_core: Object.fromEntries(Object.entries(ROLE_CORE).map(([k, v]) => [k, Array.from(v).sort()])),
  action: ACTION.source,
  optional: OPTIONAL.source,
  mandatory: MANDATORY.source,
  stack: STACK.source,
  precedence_version: 1,
});

export interface ImportanceAssignment {
  label: string;
  source: string;
  reason: string;
  evidence: { source_column: string; text: string; stack_list: boolean }[];
}

export function assignImportance(
  job: Record<string, unknown>,
  terms: Set<string>,
  human: Record<string, string>,
  tokenizer: TechTokenizer
): Record<string, ImportanceAssignment> {
  const mentions: Record<string, { source_column: string; text: string; stack_list: boolean }[]> = {};
  for (const t of terms) mentions[t] = [];

  for (const col of ['JOB_REQUIRE', 'JOB_RESPONSIBILITIES', 'JOB_PREFERRD_QUALIFICATION']) {
    let inStack = false;
    for (const text of clauses(job[col])) {
      if (STACK.test(text)) inStack = true;
      else if (/^\s*[\[【○]/.test(text)) inStack = false;
      for (const t of new Set(tokenizer.tokens(text))) {
        if (terms.has(t)) {
          mentions[t].push({ source_column: col, text, stack_list: inStack });
        }
      }
    }
  }

  const role = ROLE_CORE[String(job.JOB_CODE || '')] ?? new Set<string>();
  const out: Record<string, ImportanceAssignment> = {};

  for (const token of Array.from(terms).sort()) {
    const rows = mentions[token];
    if (token in human) {
      out[token] = { label: human[token], source: 'USER', reason: '사용자 검토 판정 우선', evidence: rows.slice(0, 3) };
      continue;
    }
    const req = rows.filter((r) => r.source_column === 'JOB_REQUIRE' && !OPTIONAL.test(r.text));
    const duty = rows.filter((r) => r.source_column === 'JOB_RESPONSIBILITIES' && !OPTIONAL.test(r.text));
    const pref = rows.filter((r) => r.source_column === 'JOB_PREFERRD_QUALIFICATION' || OPTIONAL.test(r.text));
    const explicit = req.filter((r) => MANDATORY.test(r.text) && !r.stack_list);
    const direct = duty.filter((r) => role.has(token) && ACTION.test(r.text) && !r.stack_list);
    const required = req.filter((r) => ACTION.test(r.text) && !r.stack_list);

    let label: string;
    let reason: string;
    let evidence: typeof rows;
    if (explicit.length) {
      label = '핵심'; reason = '자격요건의 명시적인 필수 요구'; evidence = explicit;
    } else if (direct.length) {
      label = '핵심'; reason = '목표 직무의 대표 기술이며 주요업무 수행에 직접 등장'; evidence = direct;
    } else if (required.length) {
      label = '핵심'; reason = '자격요건에서 해당 기술의 경험·활용 역량을 요구'; evidence = required;
    } else if (req.length && role.has(token)) {
      label = '핵심'; reason = '자격요건에 등장하며 직무별 대표 기술과 일치하는 추정'; evidence = req;
    } else if (pref.length) {
      label = '보조'; reason = '우대사항 또는 우대 표현에 등장'; evidence = pref;
    } else {
      label = '판단 불가'; reason = '직무·요구 문맥만으로 중요도를 확정하기 어려움'; evidence = rows;
    }
    out[token] = { label, source: 'AUTO_RULE', reason, evidence: evidence.slice(0, 3) };
  }
  return out;
}
