import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import { Recommender, RANKING_VERSION } from './src/recommender.js';
import { SupabaseReader, ReaderError } from './src/supabaseReader.js';
import { GeminiReasonGenerator, ReasonError } from './src/geminiReason.js';
import { LicenseCurriculum } from './src/licenseCurriculum.js';
import { ProjectCurriculum, presentProject } from './src/projectCurriculum.js';
import { refreshSnapshot } from './src/syncJobs.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);

class HttpError extends Error {
  status: number;
  headers?: Record<string, string>;
  constructor(status: number, message: string, headers?: Record<string, string>) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function requireToken(req: Request): string {
  const auth = req.header('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    throw new HttpError(401, '로그인 후 이용해주세요.');
  }
  return auth.slice(7);
}

function isValidIsoDate(val: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const d = new Date(val + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === val;
}

function validateAdventure(action: string, args: unknown): Record<string, string> {
  const validActions = new Set([
    'start',
    'add',
    'edit',
    'delete',
    'toggle',
    'boss',
    'dates',
    'test_on',
    'test_off',
    'test_reset',
  ]);
  if (!validActions.has(action) || !args || typeof args !== 'object' || Array.isArray(args)) {
    throw new HttpError(422, '입력 항목을 확인해주세요.');
  }
  const argObj = args as Record<string, unknown>;
  const allowedMap: Record<string, string[]> = {
    start: [],
    add: ['text'],
    edit: ['id', 'text'],
    delete: ['id'],
    toggle: ['id'],
    boss: ['stage', 'password'],
    dates: ['written', 'practical', 'result'],
    test_on: ['date'],
    test_reset: ['date'],
    test_off: [],
  };
  const allowed = new Set(allowedMap[action]);
  if (action === 'start' && 'lc_id' in argObj) allowed.add('lc_id');
  if (action === 'dates' && 'third' in argObj) allowed.add('third');
  if ((action === 'test_on' || action === 'test_reset') && 'time' in argObj) allowed.add('time');

  const keys = Object.keys(argObj);
  if (
    keys.length !== allowed.size ||
    keys.some((k) => !allowed.has(k)) ||
    Object.values(argObj).some((v) => typeof v !== 'string')
  ) {
    throw new HttpError(422, '입력 항목을 확인해주세요.');
  }

  for (const [key, value] of Object.entries(argObj as Record<string, string>)) {
    if (value.length > 200) throw new HttpError(422, '입력 내용이 너무 깁니다.');
    if (key === 'time' && !/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
      throw new HttpError(422, '시간을 HH:MM 형식으로 입력해주세요.');
    }
    if (key === 'lc_id') {
      if (!/^\d+$/.test(value)) throw new HttpError(422, '시험을 선택해주세요.');
      const n = Number(value);
      if (n < 1 || n > 2147483647) throw new HttpError(422, '시험을 선택해주세요.');
    }
    if ((key === 'practical' || key === 'third') && value === '') continue;
    if (['written', 'practical', 'third', 'result', 'date'].includes(key)) {
      if (!isValidIsoDate(value)) {
        throw new HttpError(422, '날짜를 YYYY-MM-DD 형식으로 입력해주세요.');
      }
    }
  }
  return argObj as Record<string, string>;
}

function roadmapEvidence(items: Record<string, unknown>[]): string {
  return items
    .slice(0, 3)
    .map((item) =>
      String(item.message || '')
        .trim()
        .replace(/\s+/g, ' ')
        .replaceAll(',', ' ·')
    )
    .join(', ');
}

function isIntInRange(val: unknown, min: number, max: number): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= min && val <= max;
}

function isUuid(val: unknown): val is string {
  return (
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

async function startServer() {
  const localJobsPath = path.join(ROOT, 'data', 'jobs.json');
  let snapshot: { count: number; fetched_at?: unknown; source: string };
  let recommender: Recommender;

  if (fs.existsSync(localJobsPath)) {
    const localRows = JSON.parse(fs.readFileSync(localJobsPath, 'utf-8')) as unknown[];
    snapshot = { count: localRows.length, fetched_at: null, source: 'local_snapshot' };
    recommender = Recommender.fromFolder(ROOT);
    console.log(`공고 ${snapshot.count}개 로컬 스냅샷으로 즉시 로드 완료.`);
  } else {
    snapshot = await refreshSnapshot(ROOT);
    console.log(`공고 ${snapshot.count}개 로드 완료 (출처: ${snapshot.source}). 추천 인덱스를 구성합니다.`);
    recommender = Recommender.fromFolder(ROOT);
  }

  const reader = new SupabaseReader();
  const reasonGenerator = new GeminiReasonGenerator();
  const curriculum = new LicenseCurriculum(reasonGenerator);
  const projectCurriculum = new ProjectCurriculum();

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  async function presentSavedRoadmap(road: Record<string, unknown> | null, token: string) {
    if (!road) return road;
    const strong = String(road.strong || '');
    const weak = String(road.weak || '');
    const legacy =
      strong.includes('공고의 기술명과 입력한 스펙이 일치합니다') ||
      (!strong && Boolean(weak) && !['보완', '준비', '연습', '구성'].some((s) => weak.endsWith(s)));
    if (!legacy) return road;
    try {
      const own = await reader.readOwnProfile(token);
      const explanation = recommender.explainJob(own.profile, Number(road.job_id));
      return {
        ...road,
        strong: roadmapEvidence((explanation.strengths as Record<string, unknown>[]) || []),
        weak: roadmapEvidence((explanation.improvements as Record<string, unknown>[]) || []),
        explanation_version: 'evidence-summary-v2',
        evidence_basis: 'current_profile',
      };
    } catch {
      return road;
    }
  }

  async function curriculumResponse(
    token: string,
    generate = false,
    force = false,
    expectedRoadId: number | null = null
  ) {
    const own = await reader.readOwnProfile(token);
    let road = await presentSavedRoadmap(await reader.currentRoadmap(token), token);
    if (!road) throw new HttpError(404, '먼저 커리어 로드맵을 생성해주세요.');
    if (expectedRoadId !== null && Number(road.road_id) !== expectedRoadId) {
      throw new HttpError(409, '현재 로드맵이 변경되었습니다.');
    }
    try {
      const explanation = recommender.explainJob(own.profile, Number(road.job_id));
      const reqs = Array.from(
        new Set((explanation.improvements || []).map((x) => String((x as Record<string, unknown>).technical_evidence || '')))
      ).slice(0, 6);
      road = { ...road, technical_requirements: reqs };
      const adv = (await reader.adventure(token)).adventure as Record<string, unknown> | undefined;
      if (adv && Number(adv.road_id) === Number(road.road_id) && (adv.state as Record<string, unknown>)?.final_at) {
        road = {
          ...road,
          weak: roadmapEvidence((explanation.improvements as Record<string, unknown>[]) || []),
          strong: roadmapEvidence((explanation.strengths as Record<string, unknown>[]) || []),
        };
      }
    } catch {
      road = { ...road, technical_requirements: [] };
    }

    const resultObj = await curriculum.withLock(`${own.user_id}:${road.road_id}`, async () => {
      const catalog = await reader.licenseCatalog(token);
      const cached = await reader.licenseRecommendations(token, Number(road!.road_id));
      const { result, changed } = await curriculum.recommend(road!, own.profile, catalog, cached, generate, force);
      if (changed) {
        await reader.saveLicenseRecommendations(token, Number(road!.road_id), result);
      }
      return { result, changed };
    });

    return {
      road_id: road.road_id,
      curriculum: resultObj.result,
      cached: !resultObj.changed && resultObj.result !== null,
    };
  }

  async function projectResponse(
    token: string,
    generate = false,
    force = false,
    expectedRoadId: number | null = null
  ) {
    const own = await reader.readOwnProfile(token);
    let road = await presentSavedRoadmap(await reader.currentRoadmap(token), token);
    if (!road) throw new HttpError(404, '먼저 커리어 로드맵을 생성해주세요.');
    if (expectedRoadId !== null && Number(road.road_id) !== expectedRoadId) {
      throw new HttpError(409, '현재 로드맵이 변경되었습니다. 다시 불러와주세요.');
    }
    try {
      const explanation = recommender.explainJob(own.profile, Number(road.job_id));
      const reqs = Array.from(
        new Set((explanation.improvements || []).map((x) => String((x as Record<string, unknown>).technical_evidence || '')))
      ).slice(0, 6);
      road = { ...road, technical_requirements: reqs };
      const adv = (await reader.adventure(token)).adventure as Record<string, unknown> | undefined;
      if (adv && Number(adv.road_id) === Number(road.road_id) && (adv.state as Record<string, unknown>)?.final_at) {
        road = {
          ...road,
          weak: roadmapEvidence((explanation.improvements as Record<string, unknown>[]) || []),
          strong: roadmapEvidence((explanation.strengths as Record<string, unknown>[]) || []),
        };
      }
    } catch {
      road = { ...road, technical_requirements: [] };
    }

    return projectCurriculum.withLock(`${own.user_id}:${road.road_id}`, async () => {
      const catalog = await reader.projectCatalog(token);
      const state = await reader.projectRecommendations(token, Number(road!.road_id));
      const { result, changed } = projectCurriculum.recommend(
        road!,
        own.profile,
        catalog,
        (state.curriculum as Record<string, unknown> | null) ?? null,
        generate,
        force
      );
      if (changed) {
        await reader.saveProjectRecommendations(token, Number(road!.road_id), result);
      }
      const selectedRow = catalog.find((p) => Number(p.PJT_ID) === Number(state.selected_project_id));
      const selected = selectedRow ? presentProject(selectedRow) : null;
      return {
        road_id: road!.road_id,
        curriculum: result,
        selected_project: selected,
        cached: !changed && result !== null,
      };
    });
  }

  async function adventureResponse(token: string, result: Record<string, unknown>) {
    const adventure = result.adventure as Record<string, unknown> | undefined;
    if (adventure && (adventure.state as Record<string, unknown>)?.final_at) {
      try {
        const own = await reader.readOwnProfile(token);
        const road = await reader.currentRoadmap(token);
        if (road) {
          const scored = recommender.recommend(own.profile, own.job_codes, 1000, 'hybrid', false, true);
          const job = scored.results.find((j) => Number(j.job_id) === Number(road.job_id));
          if (job) {
            result.match_report = {
              road_id: road.road_id,
              score_100: job.score_100,
              explanation: job.explanation,
              previous_score: road.score_100,
            };
          }
        }
      } catch {
        result.report_pending = true;
      }
    }
    return result;
  }

  async function startAdventureResponse(
    token: string,
    body: {
      road_id: number;
      kind: 'project' | 'certificate';
      project_id?: number | null;
      lc_id?: number | null;
      expected_run_id?: string | null;
      password?: string | null;
    }
  ) {
    const road = await reader.currentRoadmap(token);
    if (!road || Number(road.road_id) !== body.road_id) {
      throw new HttpError(409, '현재 로드맵이 변경되었습니다. 다시 불러와주세요.');
    }
    if (
      (body.kind === 'project' && (body.project_id == null || body.lc_id != null)) ||
      (body.kind === 'certificate' && (body.lc_id == null || body.project_id != null))
    ) {
      throw new HttpError(422, '시작할 커리큘럼을 하나 선택해주세요.');
    }
    const current = (await reader.adventure(token)).adventure as Record<string, unknown> | undefined;
    const run = current ? current.run_id : null;
    if (String(body.expected_run_id || '') !== String(run || '')) {
      throw new HttpError(409, '모험 상태가 변경되었습니다. 다시 선택해주세요.');
    }
    const requiresPassword = Boolean(
      current && (current.restart_requires_password ?? !(current.state as Record<string, unknown>)?.final_at)
    );
    if (requiresPassword && !body.password) {
      throw new HttpError(409, '이미 진행중인 커리업 어드벤처가 있어요! 비밀번호를 확인해주세요.');
    }
    const args: Record<string, string> = {
      road_id: String(body.road_id),
      expected_run_id: String(body.expected_run_id || ''),
      [body.kind === 'project' ? 'project_id' : 'lc_id']: String(
        body.kind === 'project' ? body.project_id : body.lc_id
      ),
    };
    let verified: string | null = null;
    try {
      if (requiresPassword) {
        verified = await reader.verifyRestartPassword(token, body.password!);
      }
      const result = await reader.adventure(verified || token, 'start', args);
      return await adventureResponse(token, result);
    } finally {
      if (verified) await reader.closeRestartSession(verified);
    }
  }

  // API routes
  app.post('/api/recommendations', async (req, res, next) => {
    try {
      const token = requireToken(req);
      const body = req.body || {};
      const topK = body.top_k ?? 5;
      const usePreferred = body.use_preferred_jobs ?? true;
      if (topK !== 5 || typeof usePreferred !== 'boolean') {
        throw new HttpError(422, '입력 항목을 확인해주세요.');
      }
      const own = await reader.readOwnProfile(token);
      const result = recommender.recommend(own.profile, usePreferred ? own.job_codes : null, topK);
      const rows = result.results.slice(0, 5);
      const reasons = await reasonGenerator.generate(rows);
      if (reasons.length !== rows.length) {
        throw new ReasonError('추천 이유 개수가 일치하지 않습니다.');
      }
      rows.forEach((row, i) => {
        row.reason = reasons[i];
      });
      const saved = rows.length ? await reader.saveResults(token, rows) : null;
      const fields = ['job_id', 'company', 'title', 'url', 'score_100', 'reason'];
      res.json({
        results: rows.map((r) => Object.fromEntries(fields.map((k) => [k, r[k] ?? null]))),
        candidate_count: result.candidate_count,
        saved,
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/history', async (req, res, next) => {
    try {
      const token = requireToken(req);
      const offset = Number(req.query.offset ?? 0);
      if (!Number.isInteger(offset)) throw new HttpError(422, '입력 항목을 확인해주세요.');
      if (offset < 0) throw new HttpError(400, '잘못된 페이지입니다.');
      res.json(await reader.history(token, offset));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/roadmaps/current', async (req, res, next) => {
    try {
      const token = requireToken(req);
      const road = await presentSavedRoadmap(await reader.currentRoadmap(token), token);
      res.json({ roadmap: road });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/roadmaps', async (req, res, next) => {
    try {
      const token = requireToken(req);
      const body = req.body || {};
      const matchId = body.match_id;
      const matchRank = body.match_rank;
      if (typeof matchId !== 'string' || !/^[0-9]{1,20}$/.test(matchId) || !isIntInRange(matchRank, 1, 5)) {
        throw new HttpError(422, '입력 항목을 확인해주세요.');
      }
      const own = await reader.readOwnProfile(token);
      const selected = await reader.matchResult(token, matchId, matchRank);
      let explanation: ReturnType<Recommender['explainJob']>;
      try {
        explanation = recommender.explainJob(own.profile, Number(selected.JOB_ANN_ID));
      } catch {
        throw new HttpError(409, '공고 데이터를 갱신한 뒤 다시 시도해주세요.');
      }
      const roadmap = await reader.createRoadmap(
        token,
        matchId,
        matchRank,
        roadmapEvidence((explanation.strengths as Record<string, unknown>[]) || []),
        roadmapEvidence((explanation.improvements as Record<string, unknown>[]) || [])
      );
      const response: Record<string, unknown> = { roadmap };
      try {
        const automatic = await curriculumResponse(token, true, false, Number(roadmap.road_id));
        response.curriculum = automatic.curriculum;
      } catch (exc) {
        response.curriculum_error = (exc as Error).message;
      }
      try {
        response.project_curriculum = await projectResponse(token, true, false, Number(roadmap.road_id));
      } catch (exc) {
        response.project_curriculum_error = (exc as Error).message;
      }
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/curriculum/recommendations', async (req, res, next) => {
    try {
      const token = requireToken(req);
      res.json(await curriculumResponse(token));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/curriculum/recommendations', async (req, res, next) => {
    try {
      const token = requireToken(req);
      const force = Boolean(req.body?.force);
      res.json(await curriculumResponse(token, true, force));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/projects/recommendations', async (req, res, next) => {
    try {
      const token = requireToken(req);
      const roadId = Number(req.query.road_id);
      if (!isIntInRange(roadId, 1, 2147483647)) throw new HttpError(422, '입력 항목을 확인해주세요.');
      res.json(await projectResponse(token, false, false, roadId));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/projects/recommendations', async (req, res, next) => {
    try {
      const token = requireToken(req);
      const body = req.body || {};
      const roadId = body.road_id;
      const force = Boolean(body.force);
      if (!isIntInRange(roadId, 1, 2147483647)) throw new HttpError(422, '입력 항목을 확인해주세요.');
      res.json(await projectResponse(token, true, force, roadId));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/projects/select', async (req, res, next) => {
    try {
      const token = requireToken(req);
      const body = req.body || {};
      if (!isIntInRange(body.road_id, 1, 2147483647) || !isIntInRange(body.project_id, 1, 2147483647)) {
        throw new HttpError(422, '입력 항목을 확인해주세요.');
      }
      const road = await reader.currentRoadmap(token);
      if (!road || Number(road.road_id) !== body.road_id) {
        throw new HttpError(409, '현재 로드맵이 변경되었습니다.');
      }
      res.json(
        await startAdventureResponse(token, {
          road_id: body.road_id,
          kind: 'project',
          project_id: body.project_id,
        })
      );
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/adventure/start', async (req, res, next) => {
    try {
      const token = requireToken(req);
      const body = req.body || {};
      if (
        !isIntInRange(body.road_id, 1, 2147483647) ||
        !['project', 'certificate'].includes(body.kind) ||
        (body.project_id != null && !isIntInRange(body.project_id, 1, 2147483647)) ||
        (body.lc_id != null && !isIntInRange(body.lc_id, 1, 2147483647)) ||
        (body.expected_run_id != null && !isUuid(body.expected_run_id)) ||
        (body.password != null && (typeof body.password !== 'string' || body.password.length > 256))
      ) {
        throw new HttpError(422, '입력 항목을 확인해주세요.');
      }
      res.json(await startAdventureResponse(token, body));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/adventure', async (req, res, next) => {
    try {
      const token = requireToken(req);
      res.json(await adventureResponse(token, await reader.adventure(token)));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/adventure', async (req, res, next) => {
    try {
      const token = requireToken(req);
      const body = req.body || {};
      const action = String(body.action || '');
      const args = validateAdventure(action, body.args ?? {});
      if (action === 'start') {
        const road = await reader.currentRoadmap(token);
        if (!road) throw new HttpError(404, '먼저 로드맵을 생성해주세요.');
        if (!args.lc_id) throw new HttpError(422, '시험 회차를 선택해주세요.');
        res.json(
          await startAdventureResponse(token, {
            road_id: Number(road.road_id),
            kind: 'certificate',
            lc_id: Number(args.lc_id),
          })
        );
        return;
      }
      res.json(await adventureResponse(token, await reader.adventure(token, action, args)));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ready: true,
      api_version: '8',
      gemini_model: reasonGenerator.model || null,
      model: recommender.encoder.name,
      index_version: recommender.version,
      job_count: recommender.jobs.length,
      snapshot,
      ranking_version: RANKING_VERSION,
      encoder_mode: recommender.encoder.mode,
      real_sbert_loaded: false,
      sbert_scoring_enabled: false,
      activity_scoring: false,
      configured_bm25_weight: recommender.policy.bm25_weight,
      configured_sbert_weight: recommender.policy.semantic_weight,
    });
  });

  // Static frontend routes
  app.get(['/', '/index.html'], (_req, res) => {
    res.set({
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Careerup-History-UI': 'compact-2',
    });
    res.sendFile(path.join(ROOT, 'web', 'index.html'));
  });

  app.get('/reset-password.html', (_req, res) => {
    res.sendFile(path.join(ROOT, 'web', 'reset-password.html'));
  });

  app.get('/assets/recommendation.js', (_req, res) => {
    res.set({ 'Cache-Control': 'no-store, max-age=0' });
    res.type('text/javascript').sendFile(path.join(ROOT, 'web', 'recommendation.js'));
  });

  app.use('/assets', express.static(path.join(ROOT, 'web')));

  // Centralized error handler (matching FastAPI HTTPException format: { detail: ... })
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      if (err.headers) res.set(err.headers);
      res.status(err.status).json({ detail: err.message });
      return;
    }
    if (err instanceof ReaderError || err instanceof ReasonError) {
      res.set('X-Careerup-Error', err.code);
      res.status(err.status).json({ detail: err.message });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(422).json({ detail: '입력 항목을 확인해주세요.' });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ detail: err.message });
      return;
    }
    res.status(500).json({ detail: '서버 오류가 발생했습니다.' });
  });

  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`CAREE-UP server listening on http://0.0.0.0:${port}`);
    if (snapshot.source === 'local_snapshot') {
      refreshSnapshot(ROOT)
        .then((nextSnapshot) => {
          snapshot = nextSnapshot;
          if (nextSnapshot.source === 'supabase') {
            recommender = Recommender.fromFolder(ROOT);
            console.log(`공고 ${nextSnapshot.count}개 백그라운드 동기화 완료 (출처: ${nextSnapshot.source}).`);
          }
        })
        .catch((err) => {
          console.warn('백그라운드 공고 동기화 실패 (로컬 스냅샷 유지):', (err as Error).message);
        });
    }
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start CAREE-UP server:', err);
  process.exit(1);
});
