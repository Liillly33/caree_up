-- SC_USERS.USER_ID와 SC_JOB_ANNOUNCEMENT.JOB_ANN_ID는 실제 INT이므로 FK도 INT.
-- 한 번의 추천은 같은 MATCH_ID, 같은 MATCH_DATE를 공유하며 최대 5개 행.
BEGIN;
CREATE SEQUENCE public.sc_matching_result_batch_seq AS bigint START 1 MAXVALUE 9223372036854775807;
CREATE TABLE public."SC_MATCHING_RESULT" (
  "MATCH_ID" varchar(20) NOT NULL,
  "USER_ID" integer NOT NULL REFERENCES public."SC_USERS"("USER_ID") ON DELETE CASCADE,
  "JOB_ANN_ID" integer NOT NULL REFERENCES public."SC_JOB_ANNOUNCEMENT"("JOB_ANN_ID") ON DELETE RESTRICT ON UPDATE CASCADE,
  "MATCH_RANK" integer NOT NULL CHECK ("MATCH_RANK" BETWEEN 1 AND 5),
  "MATCH_SCORE" double precision NOT NULL CHECK ("MATCH_SCORE" BETWEEN 0 AND 100),
  "MATCH_REASON" text NOT NULL CHECK (length(btrim("MATCH_REASON")) BETWEEN 1 AND 240),
  "MATCH_SELECTED" boolean NOT NULL DEFAULT false,
  "MATCH_DATE" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("MATCH_ID", "MATCH_RANK"),
  UNIQUE ("MATCH_ID", "JOB_ANN_ID")
);
CREATE INDEX sc_matching_result_user_date_idx ON public."SC_MATCHING_RESULT" ("USER_ID", "MATCH_DATE" DESC, "MATCH_ID");
CREATE INDEX sc_matching_result_job_idx ON public."SC_MATCHING_RESULT" ("JOB_ANN_ID");
ALTER TABLE public."SC_MATCHING_RESULT" ENABLE ROW LEVEL SECURITY;
CREATE POLICY matching_read_own ON public."SC_MATCHING_RESULT" FOR SELECT TO authenticated
 USING ("USER_ID" IN (SELECT "USER_ID" FROM public."SC_USERS" WHERE "AUTH_USER_ID"=(select auth.uid())));
REVOKE ALL ON public."SC_MATCHING_RESULT" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.sc_matching_result_batch_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public."SC_MATCHING_RESULT" TO authenticated;
-- 저장 함수만 번호 발급/삽입 가능: 브라우저의 직접 INSERT로 다른 묶음에 끼워 넣을 수 없음.
CREATE SCHEMA IF NOT EXISTS careerup_private;
REVOKE ALL ON SCHEMA careerup_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA careerup_private TO authenticated;
-- 이력에 공고명/회사명/원문 링크를 붙이기 위한 로그인 회원의 공고 조회.
GRANT SELECT ON public."SC_JOB_ANNOUNCEMENT" TO authenticated;
CREATE POLICY matching_announcements_read ON public."SC_JOB_ANNOUNCEMENT" FOR SELECT TO authenticated USING (true);

CREATE FUNCTION careerup_private.save_matching_results(p_results jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user integer; v_match varchar(20); v_date timestamptz := now(); v_n integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
 SELECT "USER_ID" INTO STRICT v_user FROM public."SC_USERS" WHERE "AUTH_USER_ID"=auth.uid();
 IF jsonb_typeof(p_results) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION '추천 결과는 배열이어야 합니다.'; END IF;
 v_n:=jsonb_array_length(p_results);
 IF v_n<1 OR v_n>5 THEN RAISE EXCEPTION '추천 결과는 1~5개여야 합니다.'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_results) r WHERE jsonb_typeof(r) <> 'object'
    OR NOT (r ?& ARRAY['job_id','score_100','reason'])
    OR jsonb_typeof(r->'job_id') IS DISTINCT FROM 'number'
    OR jsonb_typeof(r->'score_100') IS DISTINCT FROM 'number'
    OR jsonb_typeof(r->'reason') IS DISTINCT FROM 'string') THEN
    RAISE EXCEPTION '추천 결과의 필수 항목을 확인해주세요.';
 END IF;
 v_match:=nextval('public.sc_matching_result_batch_seq'::regclass)::varchar(20);
 INSERT INTO public."SC_MATCHING_RESULT" ("MATCH_ID","USER_ID","JOB_ANN_ID","MATCH_RANK","MATCH_SCORE","MATCH_REASON","MATCH_SELECTED","MATCH_DATE")
 SELECT v_match,v_user,(r->>'job_id')::integer,n::integer,(r->>'score_100')::double precision,btrim(r->>'reason'),false,v_date
 FROM jsonb_array_elements(p_results) WITH ORDINALITY AS rows(r,n);
 RETURN jsonb_build_object('match_id',v_match,'match_date',v_date,'saved_count',v_n);
END; $$;
REVOKE ALL ON FUNCTION careerup_private.save_matching_results(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION careerup_private.save_matching_results(jsonb) TO authenticated;
CREATE FUNCTION public.save_matching_results(p_results jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
 SELECT careerup_private.save_matching_results(p_results);
$$;
REVOKE ALL ON FUNCTION public.save_matching_results(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_matching_results(jsonb) TO authenticated;

CREATE FUNCTION public.get_matching_history(p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
 IF p_offset<0 THEN RAISE EXCEPTION '잘못된 페이지입니다.'; END IF;
 WITH batches AS (
   SELECT "MATCH_ID",min("MATCH_DATE") AS d FROM public."SC_MATCHING_RESULT"
   WHERE "USER_ID" IN (SELECT "USER_ID" FROM public."SC_USERS" WHERE "AUTH_USER_ID"=auth.uid())
   GROUP BY "MATCH_ID" ORDER BY d DESC,"MATCH_ID" DESC LIMIT 21 OFFSET p_offset
 ), page AS (SELECT * FROM batches ORDER BY d DESC,"MATCH_ID" DESC LIMIT 20), sessions AS (
 SELECT b."MATCH_ID",b.d,jsonb_agg(jsonb_build_object('job_id',r."JOB_ANN_ID",'rank',r."MATCH_RANK",'score_100',r."MATCH_SCORE",'reason',r."MATCH_REASON",'selected',r."MATCH_SELECTED",'company',j."JOB_CORP_NAME",'title',j."JOB_ANN_TITLE",'url',j."JOB_URL") ORDER BY r."MATCH_RANK") AS results
 FROM page b JOIN public."SC_MATCHING_RESULT" r USING ("MATCH_ID") JOIN public."SC_JOB_ANNOUNCEMENT" j ON j."JOB_ANN_ID"=r."JOB_ANN_ID"
 GROUP BY b."MATCH_ID",b.d
 ) SELECT jsonb_build_object('sessions',coalesce((SELECT jsonb_agg(jsonb_build_object('match_id',"MATCH_ID",'match_date',d,'results',results) ORDER BY d DESC,"MATCH_ID" DESC) FROM sessions),'[]'::jsonb),'has_more',(SELECT count(*)>20 FROM batches),'next_offset',p_offset+20) INTO v_result;
 RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.get_matching_history(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_matching_history(integer) TO authenticated;
COMMIT;
