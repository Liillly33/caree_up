import crypto from 'node:crypto';
import fs from 'node:fs';
import { norm, pyJsonDumps } from './textProcessing.js';

export interface ReviewRecord {
  job_id: number;
  technology: string;
  label: string;
  label_source: string;
  job_sha256: string;
}

export interface ReviewSummary {
  reviewed: number;
  pending: number;
  stale: number;
}

export function loadReviews(
  reviewsPath: string,
  jobs: Record<string, unknown>[]
): {
  reviews: Record<number, Record<string, string>>;
  summary: ReviewSummary;
  version: string | null;
} {
  if (!fs.existsSync(reviewsPath)) {
    return { reviews: {}, summary: { reviewed: 0, pending: 0, stale: 0 }, version: null };
  }
  const rawBytes = fs.readFileSync(reviewsPath);
  const payload = JSON.parse(rawBytes.toString('utf-8')) as { records: ReviewRecord[] };
  const lookup = new Map<number, Record<string, unknown>>();
  for (const j of jobs) {
    lookup.set(Number(j.JOB_ANN_ID), j);
  }
  const result: Record<number, Record<string, string>> = {};
  const seen = new Set<string>();
  const summary: ReviewSummary = { reviewed: 0, pending: 0, stale: 0 };

  for (const r of payload.records) {
    const label = r.label;
    if (!label) {
      summary.pending += 1;
      continue;
    }
    if (r.label_source !== 'USER' || !['핵심', '보조', '판단 불가', '제외'].includes(label)) {
      throw new Error('검토 라벨 형식이 올바르지 않습니다.');
    }
    summary.reviewed += 1;
    const jid = r.job_id;
    const techNorm = norm(r.technology);
    const key = `${jid}\u0000${techNorm}`;
    if (seen.has(key)) {
      throw new Error('검토 라벨이 중복되었습니다.');
    }
    seen.add(key);
    const job = lookup.get(jid);
    if (!job) {
      summary.stale += 1;
      continue;
    }
    const fingerprint = crypto.createHash('sha256').update(pyJsonDumps(job), 'utf-8').digest('hex');
    if (fingerprint !== r.job_sha256) {
      summary.stale += 1;
      continue;
    }
    if (!result[jid]) result[jid] = {};
    result[jid][techNorm] = label;
  }

  const version = crypto.createHash('sha256').update(rawBytes).digest('hex');
  return { reviews: result, summary, version };
}
