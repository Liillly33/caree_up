import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_KEY, DEFAULT_URL } from './supabaseReader.js';

const FIELDS = [
  'JOB_ANN_ID',
  'JOB_ANN_TITLE',
  'JOB_CORP_NAME',
  'JOB_CORP_SCALE',
  'JOB_SALARY',
  'JOB_LOCATION',
  'JOB_TYPE',
  'JOB_EXPERIENCE',
  'JOB_RESPONSIBILITIES',
  'JOB_REQUIRE',
  'JOB_PREFERRD_QUALIFICATION',
  'JOB_URL',
  'JOB_CODE',
];
const CODES = new Set(['FE', 'BE', 'APP', 'ERP', 'OPS', 'SEC', 'DATA', 'AIML', 'QA', 'GAME', 'IOT', 'NET', 'ETC']);

export class SnapshotError extends Error {}

function validateCatalog(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || (payload as Record<string, unknown>).schema_version !== 1) {
    throw new SnapshotError('공고 동기화 응답 형식이 올바르지 않습니다. DB 업데이트를 확인해주세요.');
  }
  const p = payload as Record<string, unknown>;
  const rows = p.jobs;
  const count = p.count;
  if (!Array.isArray(rows) || !rows.length || typeof count !== 'number' || !Number.isInteger(count) || count !== rows.length) {
    throw new SnapshotError('빈 공고 목록 또는 공고 개수 불일치입니다. 기존 스냅샷을 유지합니다.');
  }
  const seen = new Set<number>();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new SnapshotError('공고에 필요한 열이 누락되었습니다.');
    }
    const r = row as Record<string, unknown>;
    if (FIELDS.some((k) => !(k in r))) {
      throw new SnapshotError('공고에 필요한 열이 누락되었습니다.');
    }
    const jid = r.JOB_ANN_ID;
    if (typeof jid !== 'number' || !Number.isInteger(jid) || jid < 1 || seen.has(jid)) {
      throw new SnapshotError('공고 ID가 잘못되었거나 중복되었습니다.');
    }
    if (!CODES.has(String(r.JOB_CODE)) || typeof r.JOB_ANN_TITLE !== 'string' || !r.JOB_ANN_TITLE.trim()) {
      throw new SnapshotError('공고 제목 또는 직무분류가 잘못되었습니다.');
    }
    for (const k of FIELDS) {
      if (k !== 'JOB_ANN_ID' && r[k] !== null && typeof r[k] !== 'string') {
        throw new SnapshotError('공고의 텍스트 형식을 확인해주세요.');
      }
    }
    seen.add(jid);
  }
  return [...(rows as Record<string, unknown>[])].sort((a, b) => Number(a.JOB_ANN_ID) - Number(b.JOB_ANN_ID));
}

export async function refreshSnapshot(rootDir: string): Promise<{ count: number; fetched_at?: unknown; source: string }> {
  const url = (process.env.SUPABASE_URL || DEFAULT_URL).replace(/\/+$/, '');
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY;
  const headers: Record<string, string> = {
    apikey: publicKey,
    'Content-Type': 'application/json',
  };
  if (publicKey.split('.').length === 3) {
    headers.Authorization = 'Bearer ' + publicKey;
  }

  const target = path.join(rootDir, 'data', 'jobs.json');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(`${url}/rest/v1/rpc/get_job_catalog_snapshot`, {
      method: 'POST',
      headers,
      body: '{}',
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new SnapshotError(`공고 서버 응답 오류 (${resp.status})`);
    }
    const payload = (await resp.json()) as Record<string, unknown>;
    const rows = validateCatalog(payload);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const pending = `${target}.pending.${process.pid}`;
    fs.writeFileSync(pending, JSON.stringify(rows, null, 2), 'utf-8');
    fs.renameSync(pending, target);
    return { count: rows.length, fetched_at: payload.fetched_at, source: 'supabase' };
  } catch (err) {
    if (fs.existsSync(target)) {
      const localRows = JSON.parse(fs.readFileSync(target, 'utf-8')) as unknown[];
      console.warn('Supabase 공고 동기화에 실패하여 로컬 스냅샷을 사용합니다:', (err as Error).message);
      return { count: localRows.length, fetched_at: null, source: 'local_snapshot' };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
