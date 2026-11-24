BEGIN;
ALTER TABLE public."SC_LC"
 ADD COLUMN IF NOT EXISTS "LC_CERT_CODE" text,
 ADD COLUMN IF NOT EXISTS "LC_CERT_NAME" text,
 ADD COLUMN IF NOT EXISTS "LC_YEAR" integer,
 ADD COLUMN IF NOT EXISTS "LC_ROUND" text,
 ADD COLUMN IF NOT EXISTS "LC_PHASE" integer,
 ADD COLUMN IF NOT EXISTS "LC_TECH_TAGS" jsonb NOT NULL DEFAULT '[]',
 ADD COLUMN IF NOT EXISTS "LC_STUDY_SCOPE" text;
ALTER TABLE public."SC_CAREER_ROADMAP" ADD COLUMN IF NOT EXISTS "LC_RECOMMENDATIONS" jsonb;
ALTER TABLE public."SC_USER_ADVENTURE" ALTER COLUMN "PRACTICAL_DATE" DROP NOT NULL;
GRANT SELECT("LC_CERT_CODE","LC_CERT_NAME","LC_YEAR","LC_ROUND","LC_PHASE","LC_TECH_TAGS","LC_STUDY_SCOPE") ON public."SC_LC" TO authenticated;
WITH metadata AS (SELECT * FROM jsonb_to_recordset('[{"LC_ID": 1, "LC_NAME": "정보처리기사", "LC_CERT_CODE": "IT_E", "LC_CERT_NAME": "정보처리기사", "LC_YEAR": 2026, "LC_ROUND": "1", "LC_PHASE": null, "LC_TECH_TAGS": ["정보처리기사", "자료구조", "알고리즘", "소프트웨어공학", "데이터베이스 설계"], "LC_STUDY_SCOPE": "소프트웨어 개발, 자료구조·알고리즘, 데이터베이스 설계의 기본 개념 학습"}, {"LC_ID": 2, "LC_NAME": "정보보안기사 (2026년 제1회)", "LC_CERT_CODE": "SEC_E", "LC_CERT_NAME": "정보보안기사", "LC_YEAR": 2026, "LC_ROUND": "1", "LC_PHASE": null, "LC_TECH_TAGS": ["정보보안기사", "보안", "security", "취약점", "암호", "네트워크 보안"], "LC_STUDY_SCOPE": "시스템·네트워크 보안과 보안 관리의 기본 개념 학습"}, {"LC_ID": 3, "LC_NAME": "정보보안산업기사 (2026년 제1회)", "LC_CERT_CODE": "SEC_I", "LC_CERT_NAME": "정보보안산업기사", "LC_YEAR": 2026, "LC_ROUND": "1", "LC_PHASE": null, "LC_TECH_TAGS": ["정보보안산업기사", "보안", "security", "취약점", "암호", "네트워크 보안"], "LC_STUDY_SCOPE": "시스템·네트워크 보안과 보안 관리의 기본 개념 학습"}, {"LC_ID": 4, "LC_NAME": "정보보안기사 (2026년 제2회)", "LC_CERT_CODE": "SEC_E", "LC_CERT_NAME": "정보보안기사", "LC_YEAR": 2026, "LC_ROUND": "2", "LC_PHASE": null, "LC_TECH_TAGS": ["정보보안기사", "보안", "security", "취약점", "암호", "네트워크 보안"], "LC_STUDY_SCOPE": "시스템·네트워크 보안과 보안 관리의 기본 개념 학습"}, {"LC_ID": 5, "LC_NAME": "정보보안산업기사 (2026년 제2회)", "LC_CERT_CODE": "SEC_I", "LC_CERT_NAME": "정보보안산업기사", "LC_YEAR": 2026, "LC_ROUND": "2", "LC_PHASE": null, "LC_TECH_TAGS": ["정보보안산업기사", "보안", "security", "취약점", "암호", "네트워크 보안"], "LC_STUDY_SCOPE": "시스템·네트워크 보안과 보안 관리의 기본 개념 학습"}, {"LC_ID": 6, "LC_NAME": "정보보안기사 (2026년 제4회)", "LC_CERT_CODE": "SEC_E", "LC_CERT_NAME": "정보보안기사", "LC_YEAR": 2026, "LC_ROUND": "4", "LC_PHASE": null, "LC_TECH_TAGS": ["정보보안기사", "보안", "security", "취약점", "암호", "네트워크 보안"], "LC_STUDY_SCOPE": "시스템·네트워크 보안과 보안 관리의 기본 개념 학습"}, {"LC_ID": 7, "LC_NAME": "정보보안산업기사 (2026년 제4회)", "LC_CERT_CODE": "SEC_I", "LC_CERT_NAME": "정보보안산업기사", "LC_YEAR": 2026, "LC_ROUND": "4", "LC_PHASE": null, "LC_TECH_TAGS": ["정보보안산업기사", "보안", "security", "취약점", "암호", "네트워크 보안"], "LC_STUDY_SCOPE": "시스템·네트워크 보안과 보안 관리의 기본 개념 학습"}, {"LC_ID": 8, "LC_NAME": "정보처리기사 (2026년 제1회)", "LC_CERT_CODE": "IT_E", "LC_CERT_NAME": "정보처리기사", "LC_YEAR": 2026, "LC_ROUND": "1", "LC_PHASE": null, "LC_TECH_TAGS": ["정보처리기사", "자료구조", "알고리즘", "소프트웨어공학", "데이터베이스 설계"], "LC_STUDY_SCOPE": "소프트웨어 개발, 자료구조·알고리즘, 데이터베이스 설계의 기본 개념 학습"}, {"LC_ID": 9, "LC_NAME": "정보처리산업기사 (2026년 제1회)", "LC_CERT_CODE": "IT_I", "LC_CERT_NAME": "정보처리산업기사", "LC_YEAR": 2026, "LC_ROUND": "1", "LC_PHASE": null, "LC_TECH_TAGS": ["정보처리산업기사", "자료구조", "알고리즘", "소프트웨어공학", "데이터베이스 설계"], "LC_STUDY_SCOPE": "소프트웨어 개발, 자료구조·알고리즘, 데이터베이스 설계의 기본 개념 학습"}, {"LC_ID": 10, "LC_NAME": "정보처리기사 (2026년 제2회)", "LC_CERT_CODE": "IT_E", "LC_CERT_NAME": "정보처리기사", "LC_YEAR": 2026, "LC_ROUND": "2", "LC_PHASE": null, "LC_TECH_TAGS": ["정보처리기사", "자료구조", "알고리즘", "소프트웨어공학", "데이터베이스 설계"], "LC_STUDY_SCOPE": "소프트웨어 개발, 자료구조·알고리즘, 데이터베이스 설계의 기본 개념 학습"}, {"LC_ID": 11, "LC_NAME": "정보처리산업기사 (2026년 제2회)", "LC_CERT_CODE": "IT_I", "LC_CERT_NAME": "정보처리산업기사", "LC_YEAR": 2026, "LC_ROUND": "2", "LC_PHASE": null, "LC_TECH_TAGS": ["정보처리산업기사", "자료구조", "알고리즘", "소프트웨어공학", "데이터베이스 설계"], "LC_STUDY_SCOPE": "소프트웨어 개발, 자료구조·알고리즘, 데이터베이스 설계의 기본 개념 학습"}, {"LC_ID": 12, "LC_NAME": "정보처리기사 (2026년 제3회)", "LC_CERT_CODE": "IT_E", "LC_CERT_NAME": "정보처리기사", "LC_YEAR": 2026, "LC_ROUND": "3", "LC_PHASE": null, "LC_TECH_TAGS": ["정보처리기사", "자료구조", "알고리즘", "소프트웨어공학", "데이터베이스 설계"], "LC_STUDY_SCOPE": "소프트웨어 개발, 자료구조·알고리즘, 데이터베이스 설계의 기본 개념 학습"}, {"LC_ID": 13, "LC_NAME": "정보처리산업기사 (2026년 제3회)", "LC_CERT_CODE": "IT_I", "LC_CERT_NAME": "정보처리산업기사", "LC_YEAR": 2026, "LC_ROUND": "3", "LC_PHASE": null, "LC_TECH_TAGS": ["정보처리산업기사", "자료구조", "알고리즘", "소프트웨어공학", "데이터베이스 설계"], "LC_STUDY_SCOPE": "소프트웨어 개발, 자료구조·알고리즘, 데이터베이스 설계의 기본 개념 학습"}, {"LC_ID": 14, "LC_NAME": "빅데이터 분석기사 (2026년 제12회)", "LC_CERT_CODE": "BIGDATA", "LC_CERT_NAME": "빅데이터 분석기사", "LC_YEAR": 2026, "LC_ROUND": "12", "LC_PHASE": null, "LC_TECH_TAGS": ["빅데이터", "데이터 분석", "데이터 전처리", "통계", "머신러닝", "pandas", "numpy", "scikit-learn"], "LC_STUDY_SCOPE": "데이터 전처리, 통계·분석 방법과 분석 실습 학습"}, {"LC_ID": 15, "LC_NAME": "빅데이터 분석기사 (2026년 제13회)", "LC_CERT_CODE": "BIGDATA", "LC_CERT_NAME": "빅데이터 분석기사", "LC_YEAR": 2026, "LC_ROUND": "13", "LC_PHASE": null, "LC_TECH_TAGS": ["빅데이터", "데이터 분석", "데이터 전처리", "통계", "머신러닝", "pandas", "numpy", "scikit-learn"], "LC_STUDY_SCOPE": "데이터 전처리, 통계·분석 방법과 분석 실습 학습"}, {"LC_ID": 16, "LC_NAME": "데이터분석 준전문가 (2026년 제48회)", "LC_CERT_CODE": "ADSP", "LC_CERT_NAME": "데이터분석 준전문가", "LC_YEAR": 2026, "LC_ROUND": "48", "LC_PHASE": null, "LC_TECH_TAGS": ["데이터 분석", "데이터분석", "통계", "분석 기획", "adsp"], "LC_STUDY_SCOPE": "데이터 분석 기획과 통계·분석 방법의 기초 개념 학습"}, {"LC_ID": 17, "LC_NAME": "데이터분석 준전문가 (2026년 제49회)", "LC_CERT_CODE": "ADSP", "LC_CERT_NAME": "데이터분석 준전문가", "LC_YEAR": 2026, "LC_ROUND": "49", "LC_PHASE": null, "LC_TECH_TAGS": ["데이터 분석", "데이터분석", "통계", "분석 기획", "adsp"], "LC_STUDY_SCOPE": "데이터 분석 기획과 통계·분석 방법의 기초 개념 학습"}, {"LC_ID": 18, "LC_NAME": "데이터분석 준전문가 (2026년 제50회)", "LC_CERT_CODE": "ADSP", "LC_CERT_NAME": "데이터분석 준전문가", "LC_YEAR": 2026, "LC_ROUND": "50", "LC_PHASE": null, "LC_TECH_TAGS": ["데이터 분석", "데이터분석", "통계", "분석 기획", "adsp"], "LC_STUDY_SCOPE": "데이터 분석 기획과 통계·분석 방법의 기초 개념 학습"}, {"LC_ID": 19, "LC_NAME": "데이터분석 준전문가 (2026년 제51회)", "LC_CERT_CODE": "ADSP", "LC_CERT_NAME": "데이터분석 준전문가", "LC_YEAR": 2026, "LC_ROUND": "51", "LC_PHASE": null, "LC_TECH_TAGS": ["데이터 분석", "데이터분석", "통계", "분석 기획", "adsp"], "LC_STUDY_SCOPE": "데이터 분석 기획과 통계·분석 방법의 기초 개념 학습"}, {"LC_ID": 20, "LC_NAME": "SQL 개발자 (2026년 제60회)", "LC_CERT_CODE": "SQLD", "LC_CERT_NAME": "SQL 개발자", "LC_YEAR": 2026, "LC_ROUND": "60", "LC_PHASE": null, "LC_TECH_TAGS": ["sql", "mysql", "postgresql", "oracle", "데이터 모델링", "sqld"], "LC_STUDY_SCOPE": "SQL과 관계형 데이터 모델링의 기본 개념 학습"}, {"LC_ID": 21, "LC_NAME": "SQL 개발자 (2026년 제61회)", "LC_CERT_CODE": "SQLD", "LC_CERT_NAME": "SQL 개발자", "LC_YEAR": 2026, "LC_ROUND": "61", "LC_PHASE": null, "LC_TECH_TAGS": ["sql", "mysql", "postgresql", "oracle", "데이터 모델링", "sqld"], "LC_STUDY_SCOPE": "SQL과 관계형 데이터 모델링의 기본 개념 학습"}, {"LC_ID": 22, "LC_NAME": "SQL 개발자 (2026년 제62회)", "LC_CERT_CODE": "SQLD", "LC_CERT_NAME": "SQL 개발자", "LC_YEAR": 2026, "LC_ROUND": "62", "LC_PHASE": null, "LC_TECH_TAGS": ["sql", "mysql", "postgresql", "oracle", "데이터 모델링", "sqld"], "LC_STUDY_SCOPE": "SQL과 관계형 데이터 모델링의 기본 개념 학습"}, {"LC_ID": 23, "LC_NAME": "SQL 개발자 (2026년 제63회)", "LC_CERT_CODE": "SQLD", "LC_CERT_NAME": "SQL 개발자", "LC_YEAR": 2026, "LC_ROUND": "63", "LC_PHASE": null, "LC_TECH_TAGS": ["sql", "mysql", "postgresql", "oracle", "데이터 모델링", "sqld"], "LC_STUDY_SCOPE": "SQL과 관계형 데이터 모델링의 기본 개념 학습"}, {"LC_ID": 24, "LC_NAME": "리눅스마스터 1급 (2026년 2601회 1차)", "LC_CERT_CODE": "LINUX1", "LC_CERT_NAME": "리눅스마스터 1급", "LC_YEAR": 2026, "LC_ROUND": "2601", "LC_PHASE": 1, "LC_TECH_TAGS": ["linux", "리눅스", "bash", "shell", "ubuntu", "centos"], "LC_STUDY_SCOPE": "Linux 시스템·서버 운영과 관리에 관한 지식 학습"}, {"LC_ID": 25, "LC_NAME": "리눅스마스터 1급 (2026년 2601회 2차)", "LC_CERT_CODE": "LINUX1", "LC_CERT_NAME": "리눅스마스터 1급", "LC_YEAR": 2026, "LC_ROUND": "2601", "LC_PHASE": 2, "LC_TECH_TAGS": ["linux", "리눅스", "bash", "shell", "ubuntu", "centos"], "LC_STUDY_SCOPE": "Linux 시스템·서버 운영과 관리에 관한 지식 학습"}, {"LC_ID": 26, "LC_NAME": "리눅스마스터 1급 (2026년 2602회 1차)", "LC_CERT_CODE": "LINUX1", "LC_CERT_NAME": "리눅스마스터 1급", "LC_YEAR": 2026, "LC_ROUND": "2602", "LC_PHASE": 1, "LC_TECH_TAGS": ["linux", "리눅스", "bash", "shell", "ubuntu", "centos"], "LC_STUDY_SCOPE": "Linux 시스템·서버 운영과 관리에 관한 지식 학습"}, {"LC_ID": 27, "LC_NAME": "리눅스마스터 1급 (2026년 2602회 2차)", "LC_CERT_CODE": "LINUX1", "LC_CERT_NAME": "리눅스마스터 1급", "LC_YEAR": 2026, "LC_ROUND": "2602", "LC_PHASE": 2, "LC_TECH_TAGS": ["linux", "리눅스", "bash", "shell", "ubuntu", "centos"], "LC_STUDY_SCOPE": "Linux 시스템·서버 운영과 관리에 관한 지식 학습"}, {"LC_ID": 28, "LC_NAME": "리눅스마스터 2급 (2026년 2601회 1차)", "LC_CERT_CODE": "LINUX2", "LC_CERT_NAME": "리눅스마스터 2급", "LC_YEAR": 2026, "LC_ROUND": "2601", "LC_PHASE": 1, "LC_TECH_TAGS": ["linux", "리눅스", "bash", "shell", "ubuntu", "centos"], "LC_STUDY_SCOPE": "Linux 명령어와 운영체제 사용·운영의 기초 학습"}, {"LC_ID": 29, "LC_NAME": "리눅스마스터 2급 (2026년 2601회 2차)", "LC_CERT_CODE": "LINUX2", "LC_CERT_NAME": "리눅스마스터 2급", "LC_YEAR": 2026, "LC_ROUND": "2601", "LC_PHASE": 2, "LC_TECH_TAGS": ["linux", "리눅스", "bash", "shell", "ubuntu", "centos"], "LC_STUDY_SCOPE": "Linux 명령어와 운영체제 사용·운영의 기초 학습"}, {"LC_ID": 30, "LC_NAME": "리눅스마스터 2급 (2026년 2602회 1차)", "LC_CERT_CODE": "LINUX2", "LC_CERT_NAME": "리눅스마스터 2급", "LC_YEAR": 2026, "LC_ROUND": "2602", "LC_PHASE": 1, "LC_TECH_TAGS": ["linux", "리눅스", "bash", "shell", "ubuntu", "centos"], "LC_STUDY_SCOPE": "Linux 명령어와 운영체제 사용·운영의 기초 학습"}, {"LC_ID": 31, "LC_NAME": "리눅스마스터 2급 (2026년 2602회 2차)", "LC_CERT_CODE": "LINUX2", "LC_CERT_NAME": "리눅스마스터 2급", "LC_YEAR": 2026, "LC_ROUND": "2602", "LC_PHASE": 2, "LC_TECH_TAGS": ["linux", "리눅스", "bash", "shell", "ubuntu", "centos"], "LC_STUDY_SCOPE": "Linux 명령어와 운영체제 사용·운영의 기초 학습"}, {"LC_ID": 32, "LC_NAME": "리눅스마스터 2급 (2026년 2603회 1차)", "LC_CERT_CODE": "LINUX2", "LC_CERT_NAME": "리눅스마스터 2급", "LC_YEAR": 2026, "LC_ROUND": "2603", "LC_PHASE": 1, "LC_TECH_TAGS": ["linux", "리눅스", "bash", "shell", "ubuntu", "centos"], "LC_STUDY_SCOPE": "Linux 명령어와 운영체제 사용·운영의 기초 학습"}, {"LC_ID": 33, "LC_NAME": "리눅스마스터 2급 (2026년 2603회 2차)", "LC_CERT_CODE": "LINUX2", "LC_CERT_NAME": "리눅스마스터 2급", "LC_YEAR": 2026, "LC_ROUND": "2603", "LC_PHASE": 2, "LC_TECH_TAGS": ["linux", "리눅스", "bash", "shell", "ubuntu", "centos"], "LC_STUDY_SCOPE": "Linux 명령어와 운영체제 사용·운영의 기초 학습"}, {"LC_ID": 34, "LC_NAME": "리눅스마스터 2급 (2026년 2604회 1차)", "LC_CERT_CODE": "LINUX2", "LC_CERT_NAME": "리눅스마스터 2급", "LC_YEAR": 2026, "LC_ROUND": "2604", "LC_PHASE": 1, "LC_TECH_TAGS": ["linux", "리눅스", "bash", "shell", "ubuntu", "centos"], "LC_STUDY_SCOPE": "Linux 명령어와 운영체제 사용·운영의 기초 학습"}, {"LC_ID": 35, "LC_NAME": "리눅스마스터 2급 (2026년 2604회 2차)", "LC_CERT_CODE": "LINUX2", "LC_CERT_NAME": "리눅스마스터 2급", "LC_YEAR": 2026, "LC_ROUND": "2604", "LC_PHASE": 2, "LC_TECH_TAGS": ["linux", "리눅스", "bash", "shell", "ubuntu", "centos"], "LC_STUDY_SCOPE": "Linux 명령어와 운영체제 사용·운영의 기초 학습"}]'::jsonb) AS x("LC_ID" integer,"LC_NAME" text,"LC_CERT_CODE" text,"LC_CERT_NAME" text,"LC_YEAR" integer,"LC_ROUND" text,"LC_PHASE" integer,"LC_TECH_TAGS" jsonb,"LC_STUDY_SCOPE" text))
UPDATE public."SC_LC" l SET "LC_CERT_CODE"=m."LC_CERT_CODE","LC_CERT_NAME"=m."LC_CERT_NAME","LC_YEAR"=m."LC_YEAR","LC_ROUND"=m."LC_ROUND","LC_PHASE"=m."LC_PHASE","LC_TECH_TAGS"=m."LC_TECH_TAGS","LC_STUDY_SCOPE"=m."LC_STUDY_SCOPE" FROM metadata m WHERE l."LC_ID"=m."LC_ID" AND l."LC_NAME"=m."LC_NAME";
-- Shared progression policy for all future curriculum routes: 100 EXP per level, no daily or level cap, 3 milestones.
ALTER TABLE public."SC_LC" DROP CONSTRAINT IF EXISTS sc_lc_mid_goals_max_three;
ALTER TABLE public."SC_LC" ADD CONSTRAINT sc_lc_mid_goals_max_three CHECK (jsonb_typeof("MID_GOALS")='array' AND jsonb_array_length("MID_GOALS")<=3);
CREATE OR REPLACE FUNCTION careerup_private.adventure_normalize(p_state jsonb,p_day date,p_goals jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE s jsonb:=coalesce(p_state,'{}'::jsonb); main jsonb; stage text;
BEGIN
 s:=jsonb_build_object('level',1,'custom','[]'::jsonb,'done','{}'::jsonb,'day','','awarded','[]'::jsonb)||s;
 s:=jsonb_set(s,'{level}',to_jsonb(greatest(1,coalesce((s->>'level')::numeric,1))));
 -- One-time +40 level rewards, including previously completed milestones without the reward marker.
 s:=s||jsonb_build_object('milestone_rewards',coalesce(s->'milestone_rewards','{}'::jsonb));
 FOREACH stage IN ARRAY ARRAY['written','practical','final'] LOOP
  IF s->>(stage||'_at') IS NOT NULL AND NOT (s->'milestone_rewards') ? stage THEN
   s:=s||jsonb_build_object('level',(s->>'level')::numeric+40);
   s:=jsonb_set(s,ARRAY['milestone_rewards',stage],'40'::jsonb,true);
  END IF;
 END LOOP;
 IF NOT s ? 'exp_policy' THEN
  -- Preserve existing custom goals. Give empty legacy/new accounts one editable daily quest.
  IF jsonb_array_length(s->'custom')=0 THEN s:=jsonb_set(s,'{custom}','[{"id":"u-daily-review","text":"오늘 공부한 내용 3줄 정리하기"}]'::jsonb); END IF;
  s:=s||jsonb_build_object('exp_policy',1);
 END IF;
 IF s->>'day' IS DISTINCT FROM p_day::text THEN
  s:=s||jsonb_build_object('day',p_day,'done','{}'::jsonb,'daily_defeated',false);
  s:=s-'main_goal';
 END IF;
 IF NOT s ? 'main_goal' THEN
  SELECT jsonb_build_object('id',g->>'id','text',g->>'daily') INTO main
  FROM jsonb_array_elements(p_goals) WITH ORDINALITY AS x(g,ord)
  WHERE s->>(g->>'id'||'_at') IS NULL ORDER BY ord LIMIT 1;
  main:=coalesce(main,'{"id":"main-review","text":"최종 목표를 위한 학습 내용 복습하고 정리하기"}'::jsonb);
  s:=s||jsonb_build_object('main_goal',main);
 END IF;
 RETURN s;
END; $$;
REVOKE ALL ON FUNCTION careerup_private.adventure_normalize(jsonb,date,jsonb) FROM PUBLIC,anon,authenticated;

-- Initialize once without re-paying old completed quests. Keep EXP between 06:00 resets.
CREATE OR REPLACE FUNCTION careerup_private.adventure_rewards(s jsonb,q date) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE credits jsonb:='{}'; item jsonb; old_exp integer; reward_id text; reward_points integer:=0; gained integer:=0;
BEGIN
 IF coalesce((s->>'reward_policy')::integer,0)<>2 THEN
  IF coalesce((s->'done'->>(s->'main_goal'->>'id'))::boolean,false) THEN credits:=credits||jsonb_build_object(s->'main_goal'->>'id',70); END IF;
  FOR item IN SELECT g FROM jsonb_array_elements(s->'custom') g LOOP
   IF coalesce((s->'done'->>(item->>'id'))::boolean,false) THEN credits:=credits||jsonb_build_object(item->>'id',30); END IF;
  END LOOP;
  old_exp:=greatest(0,coalesce((s->>'exp')::integer,0))%100;
  s:=s||jsonb_build_object('reward_policy',2,'exp',old_exp,'rewarded',jsonb_build_object(q::text,credits));
 END IF;
 RETURN s;
END; $$;
REVOKE ALL ON FUNCTION careerup_private.adventure_rewards(jsonb,date) FROM PUBLIC,anon,authenticated;

-- Calendar-day exam quests override the usual fixed study task even before 06:00.
CREATE OR REPLACE FUNCTION careerup_private.adventure_schedule(s jsonb,d date,w date,p date,f date,goals jsonb,cert_name text,phase integer) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE stage text; goal jsonb;
BEGIN
 stage:=CASE WHEN d>=f THEN 'final' WHEN d=p THEN 'practical' WHEN d=w THEN 'written' ELSE NULL END;
 IF stage IS NOT NULL THEN
  IF stage='final' THEN goal:=jsonb_build_object('id','final','text',CASE WHEN phase=1 THEN cert_name||' 1차 합격 확인' ELSE cert_name||' 취득 · 최종 합격 확인' END,'milestone','final');
  ELSE SELECT jsonb_build_object('id',g->>'id','text',g->>'title','milestone',stage) INTO goal FROM jsonb_array_elements(goals) g WHERE g->>'id'=stage; END IF;
  IF goal IS NOT NULL THEN
   s:=s||jsonb_build_object('main_goal',goal);
   IF s->>(stage||'_at') IS NOT NULL THEN s:=jsonb_set(s,ARRAY['done',stage],'true'::jsonb,true); END IF;
  END IF;
 ELSIF s->'main_goal' ? 'milestone' THEN
  s:=s-'main_goal';
  SELECT jsonb_build_object('id',g->>'id','text',g->>'daily') INTO goal FROM jsonb_array_elements(goals) WITH ORDINALITY x(g,ord) WHERE s->>(g->>'id'||'_at') IS NULL ORDER BY ord LIMIT 1;
  s:=s||jsonb_build_object('main_goal',coalesce(goal,'{"id":"main-review","text":"최종 목표를 위한 학습 내용 복습하고 정리하기"}'::jsonb));
 END IF;
 RETURN s;
END; $$;
REVOKE ALL ON FUNCTION careerup_private.adventure_schedule(jsonb,date,date,date,date,jsonb,text,integer) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION careerup_private.adventure_payload(p_user integer,p_leveled boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public."SC_USER_ADVENTURE"; l public."SC_LC"; s jsonb; d date; q date; t time; enemy text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public."SC_USERS" WHERE "USER_ID"=p_user AND "AUTH_USER_ID"=auth.uid()) THEN RAISE EXCEPTION '권한이 없습니다.' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public."SC_USER_ADVENTURE" WHERE "USER_ID"=p_user;
 SELECT * INTO l FROM public."SC_LC" WHERE "LC_ID"=coalesce(a."LC_ID",(SELECT "LC_ID" FROM public."SC_LC" WHERE "LC_NAME"='정보처리기사'));
 IF a."USER_ID" IS NULL THEN RETURN jsonb_build_object('adventure_revision',5,'reward_policy',2,'adventure',null,'license',jsonb_build_object('name',l."LC_NAME",'written_date',l."WRITTEN_DATE",'practical_date',l."PRACTICAL_DATE",'result_date',l."RESULT_DATE",'mid_goals',l."MID_GOALS")); END IF;
 d:=coalesce(a."TEST_DATE",(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date);
 s:=CASE WHEN a."TEST_DATE" IS NULL THEN a."STATE" ELSE a."TEST_STATE" END;
 t:=CASE WHEN a."TEST_DATE" IS NULL THEN (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::time ELSE coalesce((s->>'test_time')::time,'12:00'::time) END;
 q:=d-CASE WHEN t<'06:00'::time THEN 1 ELSE 0 END;
 s:=careerup_private.adventure_normalize(s,q,l."MID_GOALS");
 s:=careerup_private.adventure_schedule(s,d,a."WRITTEN_DATE",a."PRACTICAL_DATE",a."RESULT_DATE",l."MID_GOALS",coalesce(l."LC_CERT_NAME",l."LC_NAME"),l."LC_PHASE");
 s:=careerup_private.adventure_rewards(s,q);

 enemy:=CASE WHEN d>=a."RESULT_DATE" AND s->>'final_at' IS NULL THEN 'final'
             WHEN d=a."PRACTICAL_DATE" AND s->>'practical_at' IS NULL THEN 'practical'
             WHEN d=a."WRITTEN_DATE" AND s->>'written_at' IS NULL THEN 'written'
             WHEN (d<>a."WRITTEN_DATE" AND (a."PRACTICAL_DATE" IS NULL OR d<>a."PRACTICAL_DATE") AND d<>a."RESULT_DATE") AND NOT coalesce((s->>'daily_defeated')::boolean,false) AND s->>'final_at' IS NULL THEN 'daily' ELSE NULL END;
 RETURN jsonb_build_object('adventure_revision',5,'reward_policy',2,'adventure',jsonb_build_object('road_id',a."ROAD_ID",'lc_id',l."LC_ID",'certificate_name',coalesce(l."LC_CERT_NAME",l."LC_NAME"),'credential_name',CASE l."LC_CERT_CODE" WHEN 'SQLD' THEN 'SQLD' WHEN 'ADSP' THEN 'ADsP' ELSE coalesce(l."LC_CERT_NAME",l."LC_NAME") END,'phase',l."LC_PHASE",'qualification_awarded',l."LC_PHASE" IS DISTINCT FROM 1 AND s->>'final_at' IS NOT NULL,'name',l."LC_NAME",'written_date',a."WRITTEN_DATE",'practical_date',a."PRACTICAL_DATE",'result_date',a."RESULT_DATE",'mid_goals',l."MID_GOALS",'state',s,'today',d,'quest_day',q,'clock_time',to_char(t,'HH24:MI'),'monster',enemy,'max_level',null,'reward_policy',2,'promotion_levels',jsonb_build_array(40,80),'milestone_level_reward',40,'max_mid_goals',3,'max_exp',100,'main_exp',70,'daily_exp',30,'real_today',(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date,'test_mode',a."TEST_DATE" IS NOT NULL),'leveled_up',p_leveled);
END; $$;
REVOKE ALL ON FUNCTION careerup_private.adventure_payload(integer,boolean) FROM PUBLIC,anon,authenticated;


CREATE OR REPLACE FUNCTION careerup_private.certificate_adventure(p_action text DEFAULT 'get',p_args jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u integer; a public."SC_USER_ADVENTURE"; l public."SC_LC"; s jsonb; d date; r integer; k text; txt text; b text; at_key text; due date; n integer; ready boolean; leveled boolean:=false; dates date[]; lic jsonb; q date; t time; xp integer; reward_id text; reward_points integer:=0; gained integer:=0; bonus integer:=0;
BEGIN
 IF p_action NOT IN ('get','start','add','edit','delete','toggle','boss','dates','test_on','test_off','test_reset') THEN RAISE EXCEPTION '지원하지 않는 동작입니다.' USING ERRCODE='22023'; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
 SELECT "USER_ID" INTO u FROM public."SC_USERS" WHERE "AUTH_USER_ID"=auth.uid();
 IF u IS NULL THEN RAISE EXCEPTION '회원정보가 없습니다.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_args) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION '잘못된 입력입니다.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(76322,u);
 SELECT * INTO a FROM public."SC_USER_ADVENTURE" WHERE "USER_ID"=u FOR UPDATE;
 SELECT * INTO l FROM public."SC_LC" WHERE "LC_ID"=CASE WHEN p_action='start' AND p_args ? 'lc_id' THEN (p_args->>'lc_id')::integer ELSE coalesce(a."LC_ID",(SELECT "LC_ID" FROM public."SC_LC" WHERE "LC_NAME"='정보처리기사')) END;
 IF l."LC_ID" IS NULL THEN RAISE EXCEPTION '등록된 시험을 선택해주세요.' USING ERRCODE='22023'; END IF;
 IF p_action='start' THEN
  SELECT "ROAD_ID" INTO r FROM public."SC_CAREER_ROADMAP" WHERE "USER_ID"=u ORDER BY "ROAD_DATE" DESC,"ROAD_ID" DESC LIMIT 1;
  IF r IS NULL THEN RAISE EXCEPTION '먼저 공고의 커리어 로드맵을 생성해주세요.' USING ERRCODE='22023'; END IF;
  IF p_args ? 'lc_id' AND NOT EXISTS(SELECT 1 FROM public."SC_CAREER_ROADMAP" cr CROSS JOIN LATERAL jsonb_array_elements(coalesce(cr."LC_RECOMMENDATIONS"->'recommendations','[]')) v WHERE cr."ROAD_ID"=r AND cr."USER_ID"=u AND v->>'certificate_code'=l."LC_CERT_CODE") THEN RAISE EXCEPTION '현재 로드맵에서 추천받은 자격증을 선택해주세요.' USING ERRCODE='22023'; END IF;
  IF a."USER_ID" IS NULL THEN
   INSERT INTO public."SC_USER_ADVENTURE"("USER_ID","ROAD_ID","LC_ID","WRITTEN_DATE","PRACTICAL_DATE","RESULT_DATE") VALUES(u,r,l."LC_ID",l."WRITTEN_DATE",l."PRACTICAL_DATE",l."RESULT_DATE");
  ELSE
   IF a."LC_ID"<>l."LC_ID" THEN
    -- Archive stage rewards per exam so switching away and back cannot farm +40 levels.
    s:=a."STATE";
    s:=s||jsonb_build_object('tracks',coalesce(s->'tracks','{}')||jsonb_build_object(a."LC_ID"::text,jsonb_build_object('written_at',s->'written_at','practical_at',s->'practical_at','final_at',s->'final_at','milestone_rewards',coalesce(s->'milestone_rewards','{}'),'written_date',a."WRITTEN_DATE",'practical_date',a."PRACTICAL_DATE",'result_date',a."RESULT_DATE")));
    lic:=coalesce(s->'tracks'->l."LC_ID"::text,'{}');
    s:=(s-'written_at'-'practical_at'-'final_at'-'milestone_rewards'-'main_goal')||lic;
    s:=s||jsonb_build_object('done',(coalesce(s->'done','{}')-'written'-'practical'-'final'-'main-review'));
    UPDATE public."SC_USER_ADVENTURE" SET "LC_ID"=l."LC_ID","WRITTEN_DATE"=coalesce((lic->>'written_date')::date,l."WRITTEN_DATE"),"PRACTICAL_DATE"=coalesce((lic->>'practical_date')::date,l."PRACTICAL_DATE"),"RESULT_DATE"=coalesce((lic->>'result_date')::date,l."RESULT_DATE"),"STATE"=s,"TEST_DATE"=NULL,"TEST_STATE"=NULL WHERE "USER_ID"=u;
   END IF;
   UPDATE public."SC_USER_ADVENTURE" SET "ROAD_ID"=r WHERE "USER_ID"=u;
  END IF;
  UPDATE public."SC_CAREER_ROADMAP" SET "LC_ID"=l."LC_ID" WHERE "ROAD_ID"=r AND "USER_ID"=u;
  SELECT * INTO a FROM public."SC_USER_ADVENTURE" WHERE "USER_ID"=u;
 END IF;
 IF a."USER_ID" IS NULL THEN
  IF p_action='get' THEN RETURN careerup_private.adventure_payload(u); END IF;
  RAISE EXCEPTION '로드맵에서 정보처리기사 모험을 먼저 선택해주세요.' USING ERRCODE='22023';
 END IF;
 IF p_action IN ('test_on','test_reset') THEN
  d:=(p_args->>'date')::date;
  IF d IS NULL THEN RAISE EXCEPTION '테스트 기준일을 선택해주세요.' USING ERRCODE='22023'; END IF;
  IF p_action='test_reset' THEN
   a."TEST_STATE":=jsonb_build_object('level',1,'custom',a."STATE"->'custom','done','{}'::jsonb,'day','','awarded','[]'::jsonb);
  ELSIF a."TEST_STATE" IS NULL THEN a."TEST_STATE":=a."STATE"; END IF;
  IF p_args ? 'time' AND (p_args->>'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION '시간을 HH:MM 형식으로 입력해주세요.' USING ERRCODE='22023'; END IF;
  a."TEST_STATE":=a."TEST_STATE"||jsonb_build_object('test_time',coalesce(p_args->>'time','12:00'));
  a."TEST_DATE":=d;
 ELSIF p_action='test_off' THEN a."TEST_DATE":=NULL;a."TEST_STATE":=NULL;
 END IF;
 d:=coalesce(a."TEST_DATE",(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date);
 s:=CASE WHEN a."TEST_DATE" IS NULL THEN a."STATE" ELSE a."TEST_STATE" END;
 t:=CASE WHEN a."TEST_DATE" IS NULL THEN (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::time ELSE coalesce((s->>'test_time')::time,'12:00'::time) END;
 q:=d-CASE WHEN t<'06:00'::time THEN 1 ELSE 0 END;
 s:=careerup_private.adventure_normalize(s,q,l."MID_GOALS");
 s:=careerup_private.adventure_schedule(s,d,a."WRITTEN_DATE",a."PRACTICAL_DATE",a."RESULT_DATE",l."MID_GOALS",coalesce(l."LC_CERT_NAME",l."LC_NAME"),l."LC_PHASE");
 s:=careerup_private.adventure_rewards(s,q);
 IF p_action='dates' THEN
  dates:=ARRAY[(p_args->>'written')::date,nullif(p_args->>'practical','')::date,(p_args->>'result')::date];
  IF dates[1] IS NULL OR dates[3] IS NULL OR dates[1]>dates[3] OR (dates[2] IS NOT NULL AND (dates[1]>dates[2] OR dates[2]>dates[3])) OR (dates[2] IS NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(l."MID_GOALS") g WHERE g->>'id'='practical')) OR (dates[2] IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(l."MID_GOALS") g WHERE g->>'id'='practical')) THEN RAISE EXCEPTION '필기일 ≤ 실기일 ≤ 합격발표일 순서로 입력해주세요.' USING ERRCODE='22023'; END IF;
  a."WRITTEN_DATE":=dates[1];a."PRACTICAL_DATE":=dates[2];a."RESULT_DATE":=dates[3];
 ELSIF p_action IN ('add','edit','delete','toggle') THEN
  k:=p_args->>'id';txt:=btrim(p_args->>'text');
  IF p_action IN ('add','edit') AND (txt IS NULL OR length(txt)<1 OR length(txt)>200) THEN RAISE EXCEPTION '일일목표는 1~200자로 입력해주세요.' USING ERRCODE='22023'; END IF;
  IF p_action='add' THEN
   IF jsonb_array_length(s->'custom')>=20 THEN RAISE EXCEPTION '직접 추가한 목표는 최대 20개입니다.' USING ERRCODE='22023'; END IF;
   k:='u-'||pg_catalog.gen_random_uuid()::text;s:=jsonb_set(s,'{custom}',(s->'custom')||jsonb_build_array(jsonb_build_object('id',k,'text',txt)));
  ELSIF p_action IN ('edit','delete') THEN
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s->'custom') g WHERE g->>'id'=k) THEN RAISE EXCEPTION '고정 목표는 수정하거나 삭제할 수 없습니다.' USING ERRCODE='22023'; END IF;
   SELECT coalesce(jsonb_agg(CASE WHEN g->>'id'=k THEN g||jsonb_build_object('text',txt) ELSE g END),'[]') INTO lic FROM jsonb_array_elements(s->'custom') g WHERE p_action<>'delete' OR g->>'id'<>k;
   s:=jsonb_set(s,'{custom}',lic);s:=jsonb_set(s,'{done}',(s->'done')-k);
  ELSE
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s->'custom') g WHERE g->>'id'=k) AND k IS DISTINCT FROM s->'main_goal'->>'id' THEN RAISE EXCEPTION '현재 일일목표를 찾을 수 없습니다.' USING ERRCODE='22023'; END IF;
   IF k=s->'main_goal'->>'id' AND s->'main_goal' ? 'milestone' THEN RAISE EXCEPTION '목표 완료 확인 절차를 진행해주세요.' USING ERRCODE='22023'; END IF;
   s:=jsonb_set(s,ARRAY['done',k],to_jsonb(NOT coalesce((s->'done'->>k)::boolean,false)),true);
   IF coalesce((s->'done'->>k)::boolean,false) THEN reward_id:=k;reward_points:=CASE WHEN k=s->'main_goal'->>'id' THEN 70 ELSE 30 END; END IF;
   IF k=s->'main_goal'->>'id' AND coalesce((s->'done'->>k)::boolean,false) THEN s:=s||jsonb_build_object('daily_defeated',true); END IF;
  END IF;
 ELSIF p_action='boss' THEN
  b:=p_args->>'stage';at_key:=b||'_at';
  IF b NOT IN ('written','practical','final') OR b IS NULL THEN RAISE EXCEPTION '잘못된 보스입니다.' USING ERRCODE='22023'; END IF;
  IF b<>'final' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(l."MID_GOALS") g WHERE g->>'id'=b) THEN RAISE EXCEPTION '이 시험에 없는 단계입니다.' USING ERRCODE='22023'; END IF;
  due:=CASE b WHEN 'written' THEN a."WRITTEN_DATE" WHEN 'practical' THEN a."PRACTICAL_DATE" ELSE a."RESULT_DATE" END;
  IF d<due THEN RAISE EXCEPTION '아직 보스가 등장하는 날짜가 아닙니다.' USING ERRCODE='22023'; END IF;
  IF b='practical' AND s->>'written_at' IS NULL OR b='final' AND EXISTS(SELECT 1 FROM jsonb_array_elements(l."MID_GOALS") g WHERE s->>(g->>'id'||'_at') IS NULL) THEN RAISE EXCEPTION '이전 중간보스를 먼저 토벌해주세요.' USING ERRCODE='22023'; END IF;
  IF s->>at_key IS NULL THEN
   txt:=coalesce(p_args->>'password','');
   IF b<>'final' AND (length(txt)>128 OR extensions.crypt(txt,l."BOSS_CODES"->>b) IS DISTINCT FROM l."BOSS_CODES"->>b) THEN RAISE EXCEPTION '완료 비밀번호가 올바르지 않습니다.' USING ERRCODE='22023'; END IF;
   s:=s||jsonb_build_object(at_key,clock_timestamp());
   IF NOT (s->'milestone_rewards') ? b THEN
     s:=s||jsonb_build_object('level',(s->>'level')::numeric+40);
     s:=jsonb_set(s,ARRAY['milestone_rewards',b],'40'::jsonb,true);bonus:=40;
    END IF;
    s:=jsonb_set(s,ARRAY['done',b],'true'::jsonb,true);
    IF b=s->'main_goal'->>'id' THEN reward_id:=b;reward_points:=70;s:=s||jsonb_build_object('daily_defeated',true); END IF;
   IF b='final' AND a."TEST_DATE" IS NULL AND l."LC_PHASE" IS DISTINCT FROM 1 THEN
    SELECT coalesce("SPEC_LICENSES"::jsonb,'[]'::jsonb) INTO lic FROM public."SC_SPEC_INFO" WHERE "USER_ID"=u;
    lic:=coalesce(lic,'[]'::jsonb);
    IF jsonb_typeof(lic)<>'array' THEN RAISE EXCEPTION '보유 자격증 형식을 확인해주세요.' USING ERRCODE='22023'; END IF;
    IF NOT lic @> jsonb_build_array(CASE l."LC_CERT_CODE" WHEN 'SQLD' THEN 'SQLD' WHEN 'ADSP' THEN 'ADsP' ELSE coalesce(l."LC_CERT_NAME",l."LC_NAME") END) THEN lic:=lic||jsonb_build_array(CASE l."LC_CERT_CODE" WHEN 'SQLD' THEN 'SQLD' WHEN 'ADSP' THEN 'ADsP' ELSE coalesce(l."LC_CERT_NAME",l."LC_NAME") END); END IF;
    INSERT INTO public."SC_SPEC_INFO"("USER_ID","SPEC_LICENSES") VALUES(u,lic::json) ON CONFLICT("USER_ID") DO UPDATE SET "SPEC_LICENSES"=excluded."SPEC_LICENSES";
   END IF;
  END IF;
 ELSIF p_action NOT IN ('get','start','test_on','test_off','test_reset') THEN RAISE EXCEPTION '지원하지 않는 동작입니다.' USING ERRCODE='22023';
 END IF;
 -- Each quest pays once per quest-day. Unchecking, editing, deleting and reloading do not repay it.
 IF reward_id IS NOT NULL AND NOT coalesce(s->'rewarded'->q::text,'{}'::jsonb) ? reward_id THEN
  s:=jsonb_set(s,'{rewarded}',(s->'rewarded')||jsonb_build_object(q::text,coalesce(s->'rewarded'->q::text,'{}'::jsonb)||jsonb_build_object(reward_id,reward_points)));
  xp:=coalesce((s->>'exp')::integer,0)+reward_points;
  gained:=xp/100;
  s:=s||jsonb_build_object('exp',xp%100,'level',(s->>'level')::numeric+gained);
 ELSE reward_points:=0; END IF;
 leveled:=(gained+bonus)>0;
 IF a."TEST_DATE" IS NULL THEN a."STATE":=s;ELSE a."TEST_STATE":=s;END IF;
 UPDATE public."SC_USER_ADVENTURE" SET "STATE"=a."STATE","TEST_DATE"=a."TEST_DATE","TEST_STATE"=a."TEST_STATE","WRITTEN_DATE"=a."WRITTEN_DATE","PRACTICAL_DATE"=a."PRACTICAL_DATE","RESULT_DATE"=a."RESULT_DATE" WHERE "USER_ID"=u;
 RETURN careerup_private.adventure_payload(u,leveled)||jsonb_build_object('levels_gained',gained+bonus,'milestone_level_reward',bonus,'quest_reward',CASE WHEN reward_id IS NULL THEN 0 ELSE reward_points END);
END; $$;
REVOKE ALL ON FUNCTION careerup_private.certificate_adventure(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION careerup_private.certificate_adventure(text,jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_license_recommendations(p_road_id integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT r."LC_RECOMMENDATIONS" FROM public."SC_CAREER_ROADMAP" r JOIN public."SC_USERS" u ON u."USER_ID"=r."USER_ID" AND u."AUTH_USER_ID"=(select auth.uid()) WHERE r."ROAD_ID"=p_road_id;
$$;
REVOKE ALL ON FUNCTION public.get_license_recommendations(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_license_recommendations(integer) TO authenticated;
CREATE OR REPLACE FUNCTION careerup_private.save_license_recommendations(p_road_id integer,p_result jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u integer; item jsonb; n integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
 SELECT "USER_ID" INTO u FROM public."SC_USERS" WHERE "AUTH_USER_ID"=auth.uid();
 PERFORM 1 FROM public."SC_CAREER_ROADMAP" WHERE "ROAD_ID"=p_road_id AND "USER_ID"=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '본인의 로드맵이 아닙니다.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_result) IS DISTINCT FROM 'object' OR jsonb_typeof(p_result->'recommendations') IS DISTINCT FROM 'array' OR jsonb_array_length(p_result->'recommendations')>3 OR length(p_result::text)>60000 OR coalesce(p_result->>'basis_hash','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION '추천 형식을 확인해주세요.' USING ERRCODE='22023'; END IF;
 SELECT count(DISTINCT v->>'certificate_code') INTO n FROM jsonb_array_elements(p_result->'recommendations') v;
 IF n<>jsonb_array_length(p_result->'recommendations') THEN RAISE EXCEPTION '중복 자격증입니다.' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT v FROM jsonb_array_elements(p_result->'recommendations') v LOOP
  IF NOT EXISTS(SELECT 1 FROM public."SC_LC" WHERE "LC_CERT_CODE"=item->>'certificate_code') OR length(coalesce(item->>'reason','')) NOT BETWEEN 1 AND 240 THEN RAISE EXCEPTION '등록된 자격증과 추천 이유를 확인해주세요.' USING ERRCODE='22023'; END IF;
 END LOOP;
 UPDATE public."SC_CAREER_ROADMAP" SET "LC_RECOMMENDATIONS"=p_result WHERE "ROAD_ID"=p_road_id AND "USER_ID"=u;
 RETURN p_result;
END; $$;
REVOKE ALL ON FUNCTION careerup_private.save_license_recommendations(integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION careerup_private.save_license_recommendations(integer,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.save_license_recommendations(p_road_id integer,p_result jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT careerup_private.save_license_recommendations(p_road_id,p_result); $$;
REVOKE ALL ON FUNCTION public.save_license_recommendations(integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_license_recommendations(integer,jsonb) TO authenticated;
COMMIT;
