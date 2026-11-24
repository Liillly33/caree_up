export const DEFAULT_URL = 'https://rrfydzmsjwfgxfynfqys.supabase.co';
export const DEFAULT_KEY = 'sb_publishable_jSOvZcQtUoXJvgQ6CRCZ8w_5rBSamsS';

export class ReaderError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'SUPABASE_REQUEST_FAILED') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class SupabaseReader {
  url: string;
  key: string;

  constructor() {
    this.url = (process.env.SUPABASE_URL || DEFAULT_URL).replace(/\/+$/, '');
    this.key = process.env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY;
  }

  async _get<T = unknown>(endpoint: string, token: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const resp = await fetch(this.url + endpoint, {
        headers: {
          apikey: this.key,
          Authorization: 'Bearer ' + token,
        },
        signal: controller.signal,
      });
      if (!resp.ok) {
        console.warn(`Supabase 조회 HTTP ${resp.status} endpoint=${endpoint.split('?')[0]}`);
        const status = resp.status === 401 || resp.status === 403 ? 401 : 502;
        throw new ReaderError(
          status === 401
            ? '로그인 세션 또는 스펙 조회 권한을 확인해주세요.'
            : '회원정보 조회 서버에 오류가 있습니다.',
          status
        );
      }
      return (await resp.json()) as T;
    } catch (err) {
      if (err instanceof ReaderError) throw err;
      throw new ReaderError('회원정보 서버에 연결할 수 없습니다.', 502);
    } finally {
      clearTimeout(timer);
    }
  }

  async readOwnProfile(token: string) {
    if (!token) throw new ReaderError('로그인 후 이용해주세요.', 401);
    const account = await this._get<{ id?: string; email?: string }>('/auth/v1/user', token);
    const authId = account?.id;
    if (!authId) throw new ReaderError('유효하지 않은 로그인 세션입니다.', 401);

    const userQuery = new URLSearchParams({ select: 'USER_ID', AUTH_USER_ID: 'eq.' + authId }).toString();
    const users = await this._get<{ USER_ID: number }[]>('/rest/v1/SC_USERS?' + userQuery, token);
    if (!Array.isArray(users) || users.length !== 1) {
      throw new ReaderError('회원정보를 확인할 수 없습니다.', 403);
    }
    const userId = users[0].USER_ID;

    const specQuery = new URLSearchParams({
      select: 'SPEC_TECH_SKILL,SPEC_LICENSES,SPEC_PROJECT_EXPERIENCE',
      USER_ID: 'eq.' + String(userId),
    }).toString();
    const specs = await this._get<Record<string, unknown>[]>('/rest/v1/SC_SPEC_INFO?' + specQuery, token);
    if (!Array.isArray(specs) || specs.length !== 1) {
      throw new ReaderError('마이페이지에 스펙정보를 입력해주세요.', 400);
    }

    const prefQuery = new URLSearchParams({
      select: 'JOB_CODE,PRFD_RANK',
      USER_ID: 'eq.' + String(userId),
      order: 'PRFD_RANK.asc',
    }).toString();
    const preferences = await this._get<{ JOB_CODE: string; PRFD_RANK: number }[]>(
      '/rest/v1/SC_USER_PRFD_JOB?' + prefQuery,
      token
    );
    if (!Array.isArray(preferences)) {
      throw new ReaderError('선호직무를 조회할 수 없습니다.', 502);
    }

    const profile: { tech_skills: string[]; licenses: string[]; project_experience: string } = {
      tech_skills: [],
      licenses: [],
      project_experience: '',
    };

    for (const [column, key] of [
      ['SPEC_TECH_SKILL', 'tech_skills'],
      ['SPEC_LICENSES', 'licenses'],
    ] as const) {
      const value = specs[0][column] ?? [];
      if (!Array.isArray(value) || value.some((t) => typeof t !== 'string')) {
        throw new ReaderError('기술 스택과 자격증은 문자열 JSON 배열이어야 합니다.');
      }
      profile[key] = value as string[];
    }
    const experience = specs[0].SPEC_PROJECT_EXPERIENCE;
    if (experience !== null && experience !== undefined && typeof experience !== 'string') {
      throw new ReaderError('프로젝트 경험은 텍스트여야 합니다.');
    }
    profile.project_experience = (experience as string) || '';

    return { user_id: userId, profile, job_codes: preferences.map((r) => r.JOB_CODE) };
  }

  async _rpc<T = unknown>(name: string, payload: Record<string, unknown>, token: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const resp = await fetch(`${this.url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!resp.ok) {
        let failure: Record<string, unknown> = {};
        let code = 'UNKNOWN';
        try {
          failure = (await resp.json()) as Record<string, unknown>;
          code = String(failure.code ?? 'UNKNOWN');
        } catch {
          code = 'UNKNOWN';
        }
        if (!/^[A-Z0-9_]{1,40}$/.test(code)) code = 'UNKNOWN';
        console.warn(`Supabase RPC ${name} HTTP ${resp.status} code=${code}`);
        if (code === 'P0002') {
          throw new ReaderError('선택한 추천 결과를 찾을 수 없습니다.', 404, 'MATCH_NOT_FOUND');
        }
        if (['22023', '22007', '22008'].includes(code)) {
          let message = '입력 내용을 확인해주세요.';
          if (name === 'certificate_adventure' && typeof failure.message === 'string') {
            const candidate = failure.message;
            if (
              candidate.length < 160 &&
              !['SELECT', 'INSERT', 'UPDATE', 'CONTEXT', 'password='].some((x) => candidate.includes(x))
            ) {
              message = candidate;
            }
          }
          throw new ReaderError(message, 400, 'ADVENTURE_INVALID_INPUT');
        }
        if (code === '23503') {
          throw new ReaderError(
            'DB에 없는 공고가 추천에 포함됐습니다. 공고 데이터를 동기화한 뒤 서버를 재시작해주세요.',
            409,
            'MATCH_JOB_NOT_FOUND'
          );
        }
        if (['PGRST202', 'PGRST205', '42883', '42P01'].includes(code)) {
          throw new ReaderError(
            '추천 기록 저장 함수 또는 테이블을 찾을 수 없습니다. DB 설정을 확인해주세요.',
            503,
            'MATCH_DATABASE_SETUP'
          );
        }
        if (resp.status === 401 || resp.status === 403) {
          throw new ReaderError(
            '로그인 세션 또는 추천 기록 접근 권한을 확인해주세요. 다시 로그인해주세요.',
            401,
            'MATCH_ACCESS_DENIED'
          );
        }
        throw new ReaderError(
          '추천 기록 저장·조회에 실패했습니다. 서버 창에 표시된 오류 코드를 확인해주세요.',
          502,
          'MATCH_DATABASE_' + code
        );
      }
      return (await resp.json()) as T;
    } catch (err) {
      if (err instanceof ReaderError) throw err;
      throw new ReaderError('추천 기록 서버에 연결할 수 없습니다.', 503, 'MATCH_DATABASE_CONNECTION');
    } finally {
      clearTimeout(timer);
    }
  }

  async saveResults(token: string, results: Record<string, unknown>[]) {
    return this._rpc(
      'save_matching_results',
      {
        p_results: results.map((r) => ({
          job_id: r.job_id,
          score_100: r.score_100,
          reason: r.reason,
        })),
      },
      token
    );
  }

  async history(token: string, offset = 0) {
    return this._rpc('get_matching_history', { p_offset: offset }, token);
  }

  async matchResult(token: string, matchId: string, rank: number) {
    const query = new URLSearchParams({
      select: 'JOB_ANN_ID,MATCH_ID,MATCH_RANK',
      MATCH_ID: 'eq.' + matchId,
      MATCH_RANK: 'eq.' + String(rank),
    }).toString();
    const rows = await this._get<{ JOB_ANN_ID: number; MATCH_ID: string; MATCH_RANK: number }[]>(
      '/rest/v1/SC_MATCHING_RESULT?' + query,
      token
    );
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new ReaderError('선택한 추천 결과를 찾을 수 없습니다.', 404, 'MATCH_NOT_FOUND');
    }
    return rows[0];
  }

  async currentRoadmap(token: string) {
    return this._rpc<Record<string, unknown> | null>('get_current_career_roadmap', {}, token);
  }

  async createRoadmap(token: string, matchId: string, rank: number, strong: string, weak: string) {
    return this._rpc<Record<string, unknown>>(
      'create_career_roadmap',
      { p_match_id: matchId, p_match_rank: rank, p_strong: strong, p_weak: weak },
      token
    );
  }

  async adventure(token: string, action = 'get', args: Record<string, unknown> | null = null) {
    const check = (result: Record<string, unknown>) => {
      if (result?.adventure_revision !== 7) {
        throw new ReaderError('어드벤처 DB 업데이트가 필요합니다. sql/007_project_adventure.sql을 확인해주세요.', 503);
      }
      return result;
    };
    if (action !== 'get') {
      check(await this._rpc<Record<string, unknown>>('certificate_adventure', { p_action: 'get', p_args: {} }, token));
    }
    return check(
      await this._rpc<Record<string, unknown>>('certificate_adventure', { p_action: action, p_args: args || {} }, token)
    );
  }

  async _authPost<T = unknown>(endpoint: string, data: Record<string, unknown>, token?: string): Promise<T> {
    const headers: Record<string, string> = {
      apikey: this.key,
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = 'Bearer ' + token;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const resp = await fetch(this.url + endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      if (!resp.ok) {
        if (resp.status === 429) {
          throw new ReaderError('비밀번호 확인 요청이 많습니다. 잠시 후 다시 시도해주세요.', 429, 'RESTART_RATE_LIMIT');
        }
        if ([400, 401, 403, 422].includes(resp.status)) {
          throw new ReaderError('비밀번호가 올바르지 않습니다.', 403, 'RESTART_PASSWORD_INVALID');
        }
        throw new ReaderError(
          '비밀번호 확인 서버에 연결할 수 없습니다. 다시 시도해주세요.',
          503,
          'RESTART_AUTH_UNAVAILABLE'
        );
      }
      const raw = await resp.text();
      return (raw ? JSON.parse(raw) : {}) as T;
    } catch (err) {
      if (err instanceof ReaderError) throw err;
      throw new ReaderError(
        '비밀번호 확인 서버에 연결할 수 없습니다. 다시 시도해주세요.',
        503,
        'RESTART_AUTH_UNAVAILABLE'
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async verifyRestartPassword(token: string, password: string): Promise<string> {
    const account = await this._get<{ id?: string; email?: string }>('/auth/v1/user', token);
    if (!account || !account.id || !account.email) {
      throw new ReaderError('로그인 상태를 확인해주세요.', 401);
    }
    const signed = await this._authPost<{ access_token?: string; user?: { id?: string } }>(
      '/auth/v1/token?grant_type=password',
      { email: account.email, password }
    );
    const verified = signed?.access_token;
    if (!verified || signed?.user?.id !== account.id) {
      if (verified) await this.closeRestartSession(verified);
      throw new ReaderError('비밀번호를 다시 확인해주세요.', 403, 'RESTART_PASSWORD_INVALID');
    }
    return verified;
  }

  async closeRestartSession(token: string) {
    try {
      await this._authPost('/auth/v1/logout?scope=local', {}, token);
    } catch {
      // ignore
    }
  }

  async licenseCatalog(token: string) {
    const fields =
      'LC_ID,LC_NAME,WRITTEN_DATE,PRACTICAL_DATE,RESULT_DATE,LC_CERT_CODE,LC_CERT_NAME,LC_YEAR,LC_ROUND,LC_PHASE,LC_TECH_TAGS,LC_STUDY_SCOPE';
    const query = new URLSearchParams({ select: fields, order: 'LC_ID.asc' }).toString();
    const rows = await this._get<Record<string, unknown>[]>('/rest/v1/SC_LC?' + query, token);
    if (!Array.isArray(rows)) throw new ReaderError('자격증 목록을 확인할 수 없습니다.', 502);
    const tagged = rows.filter(
      (x) => x.LC_CERT_CODE && Array.isArray(x.LC_TECH_TAGS) && (x.LC_TECH_TAGS as unknown[]).length > 0
    );
    if (rows.length && !tagged.length) {
      throw new ReaderError('자격증 메타데이터 업데이트가 필요합니다. sql/005_ai_curriculum.sql을 실행해주세요.', 503);
    }
    return tagged;
  }

  async licenseRecommendations(token: string, roadId: number) {
    return this._rpc<Record<string, unknown> | null>('get_license_recommendations', { p_road_id: roadId }, token);
  }

  async saveLicenseRecommendations(token: string, roadId: number, result: unknown) {
    return this._rpc('save_license_recommendations', { p_road_id: roadId, p_result: result }, token);
  }

  async projectCatalog(token: string) {
    const fields =
      'PJT_ID,PJT_CODE,PJT_NAME,PJT_TECH_TAGS,PJT_FINAL_GOAL,PJT_TOTAL_DAYS,PJT_MID_GOALS,PJT_REVIEW_DAYS,PJT_FINAL_CRITERIA';
    const query = new URLSearchParams({ select: fields, order: 'PJT_ID.asc' }).toString();
    const rows = await this._get<Record<string, unknown>[]>('/rest/v1/SC_PJT?' + query, token);
    if (!Array.isArray(rows)) throw new ReaderError('프로젝트 목록을 확인할 수 없습니다.', 502);
    return rows;
  }

  async projectRecommendations(token: string, roadId: number) {
    return (
      (await this._rpc<Record<string, unknown> | null>('get_project_recommendations', { p_road_id: roadId }, token)) ||
      {}
    );
  }

  async saveProjectRecommendations(token: string, roadId: number, result: unknown) {
    return this._rpc('save_project_recommendations', { p_road_id: roadId, p_result: result }, token);
  }

  async selectProject(token: string, roadId: number, projectId: number) {
    return this._rpc('select_roadmap_project', { p_road_id: roadId, p_project_id: projectId }, token);
  }
}
