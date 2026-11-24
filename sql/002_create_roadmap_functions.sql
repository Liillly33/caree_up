BEGIN;
ALTER TABLE public."SC_CAREER_ROADMAP"
 ADD COLUMN "MATCH_ID" varchar(20) NOT NULL,
 ADD COLUMN "MATCH_RANK" integer NOT NULL,
 ADD CONSTRAINT "FK_SC_CAREER_ROADMAP_MATCH" FOREIGN KEY ("MATCH_ID","MATCH_RANK") REFERENCES public."SC_MATCHING_RESULT"("MATCH_ID","MATCH_RANK") ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX sc_career_roadmap_match_idx ON public."SC_CAREER_ROADMAP" ("MATCH_ID","MATCH_RANK");
COMMENT ON COLUMN public."SC_CAREER_ROADMAP"."MATCH_ID" IS '로드맵 생성에 사용한 추천 묶음. MATCH_RANK와 함께 원래 점수/공고를 식별.';

CREATE FUNCTION public.get_current_career_roadmap() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('road_id',r."ROAD_ID",'job_id',r."JOB_ANN_ID",'match_id',r."MATCH_ID",'match_rank',r."MATCH_RANK",'road_date',r."ROAD_DATE",'strong',r."ROAD_STRONG",'weak',r."ROAD_WEAK",'company',j."JOB_CORP_NAME",'title',j."JOB_ANN_TITLE",'url',j."JOB_URL",'job_code',j."JOB_CODE",'score_100',m."MATCH_SCORE",'reason',m."MATCH_REASON")
 FROM public."SC_CAREER_ROADMAP" r
 JOIN public."SC_USERS" u ON u."USER_ID"=r."USER_ID" AND u."AUTH_USER_ID"=(select auth.uid())
 JOIN public."SC_JOB_ANNOUNCEMENT" j ON j."JOB_ANN_ID"=r."JOB_ANN_ID"
 JOIN public."SC_MATCHING_RESULT" m ON m."MATCH_ID"=r."MATCH_ID" AND m."MATCH_RANK"=r."MATCH_RANK" AND m."USER_ID"=r."USER_ID" AND m."JOB_ANN_ID"=r."JOB_ANN_ID"
 ORDER BY r."ROAD_DATE" DESC,r."ROAD_ID" DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_current_career_roadmap() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_current_career_roadmap() TO authenticated;

CREATE FUNCTION careerup_private.create_career_roadmap(p_match_id varchar,p_match_rank integer,p_strong text,p_weak text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user integer; v_job integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
 SELECT "USER_ID" INTO v_user FROM public."SC_USERS" WHERE "AUTH_USER_ID"=auth.uid();
 IF v_user IS NULL THEN RAISE EXCEPTION '회원정보를 확인할 수 없습니다.' USING ERRCODE='42501'; END IF;
 IF p_match_id IS NULL OR length(p_match_id)>20 OR p_match_rank IS NULL OR p_match_rank NOT BETWEEN 1 AND 5 OR p_strong IS NULL OR p_weak IS NULL OR length(p_strong)>20000 OR length(p_weak)>20000 THEN
 RAISE EXCEPTION '추천 결과 입력을 확인해주세요.' USING ERRCODE='22023'; END IF;
 -- Serializes creation for the same account without limiting the number of historical roadmaps.
 PERFORM pg_advisory_xact_lock(76321,v_user);
 SELECT "JOB_ANN_ID" INTO v_job FROM public."SC_MATCHING_RESULT"
 WHERE "MATCH_ID"=p_match_id AND "MATCH_RANK"=p_match_rank AND "USER_ID"=v_user FOR UPDATE;
 IF v_job IS NULL THEN RAISE EXCEPTION '선택한 본인 추천 결과가 없습니다.' USING ERRCODE='P0002'; END IF;
 INSERT INTO public."SC_CAREER_ROADMAP" ("USER_ID","JOB_ANN_ID","MATCH_ID","MATCH_RANK","ROAD_STRONG","ROAD_WEAK","ROAD_DATE")
 VALUES(v_user,v_job,p_match_id,p_match_rank,p_strong,p_weak,clock_timestamp());
 UPDATE public."SC_MATCHING_RESULT" SET "MATCH_SELECTED"=true WHERE "MATCH_ID"=p_match_id AND "MATCH_RANK"=p_match_rank AND "USER_ID"=v_user;
 RETURN public.get_current_career_roadmap();
END; $$;
REVOKE ALL ON FUNCTION careerup_private.create_career_roadmap(varchar,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION careerup_private.create_career_roadmap(varchar,integer,text,text) TO authenticated;
CREATE FUNCTION public.create_career_roadmap(p_match_id varchar,p_match_rank integer,p_strong text,p_weak text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT careerup_private.create_career_roadmap(p_match_id,p_match_rank,p_strong,p_weak);
$$;
REVOKE ALL ON FUNCTION public.create_career_roadmap(varchar,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_career_roadmap(varchar,integer,text,text) TO authenticated;
COMMIT;
