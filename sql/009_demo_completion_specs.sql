BEGIN;
CREATE OR REPLACE FUNCTION careerup_private.reflect_adventure_completion(p_user integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public."SC_USER_ADVENTURE";s jsonb;entry text;values_json jsonb;phase integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public."SC_USERS" WHERE "USER_ID"=p_user AND "AUTH_USER_ID"=auth.uid()) THEN RAISE EXCEPTION '권한이 없습니다.' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public."SC_USER_ADVENTURE" WHERE "USER_ID"=p_user FOR UPDATE;
 IF a."USER_ID" IS NULL THEN RETURN; END IF;
 s:=CASE WHEN a."TEST_DATE" IS NULL THEN a."STATE" ELSE a."TEST_STATE" END;
 IF s->>'final_at' IS NULL OR coalesce((s->>'spec_reflected')::boolean,false) THEN RETURN; END IF;
 IF a."PJT_ID" IS NOT NULL THEN
  entry:=careerup_private.project_spec_title(a."PJT_ID",a."PROJECT_PLAN"->>'name');
  SELECT coalesce("SPEC_TECH_SKILL"::jsonb,'[]') INTO values_json FROM public."SC_SPEC_INFO" WHERE "USER_ID"=p_user FOR UPDATE;
  IF jsonb_typeof(coalesce(values_json,'[]'))<>'array' THEN RAISE EXCEPTION '기술 스택 형식을 확인해주세요.' USING ERRCODE='22023'; END IF;
  INSERT INTO public."SC_SPEC_INFO"("USER_ID","SPEC_TECH_SKILL") VALUES(p_user,jsonb_build_array(entry)::json)
  ON CONFLICT("USER_ID") DO UPDATE SET "SPEC_TECH_SKILL"=(CASE WHEN coalesce("SC_SPEC_INFO"."SPEC_TECH_SKILL"::jsonb,'[]') @> jsonb_build_array(entry) THEN coalesce("SC_SPEC_INFO"."SPEC_TECH_SKILL"::jsonb,'[]') ELSE coalesce("SC_SPEC_INFO"."SPEC_TECH_SKILL"::jsonb,'[]')||jsonb_build_array(entry) END)::json;
 ELSE
  SELECT "LC_PHASE",CASE "LC_CERT_CODE" WHEN 'SQLD' THEN 'SQLD' WHEN 'ADSP' THEN 'ADsP' ELSE coalesce("LC_CERT_NAME","LC_NAME") END INTO phase,entry FROM public."SC_LC" WHERE "LC_ID"=a."LC_ID";
  IF phase=1 OR entry IS NULL THEN RETURN; END IF;
  SELECT coalesce("SPEC_LICENSES"::jsonb,'[]') INTO values_json FROM public."SC_SPEC_INFO" WHERE "USER_ID"=p_user FOR UPDATE;
  IF jsonb_typeof(coalesce(values_json,'[]'))<>'array' THEN RAISE EXCEPTION '보유 자격증 형식을 확인해주세요.' USING ERRCODE='22023'; END IF;
  INSERT INTO public."SC_SPEC_INFO"("USER_ID","SPEC_LICENSES") VALUES(p_user,jsonb_build_array(entry)::json)
  ON CONFLICT("USER_ID") DO UPDATE SET "SPEC_LICENSES"=(CASE WHEN coalesce("SC_SPEC_INFO"."SPEC_LICENSES"::jsonb,'[]') @> jsonb_build_array(entry) THEN coalesce("SC_SPEC_INFO"."SPEC_LICENSES"::jsonb,'[]') ELSE coalesce("SC_SPEC_INFO"."SPEC_LICENSES"::jsonb,'[]')||jsonb_build_array(entry) END)::json;
 END IF;
 IF a."TEST_DATE" IS NULL THEN UPDATE public."SC_USER_ADVENTURE" SET "STATE"=jsonb_set("STATE",'{spec_reflected}','true') WHERE "USER_ID"=p_user;
 ELSE UPDATE public."SC_USER_ADVENTURE" SET "TEST_STATE"=jsonb_set("TEST_STATE",'{spec_reflected}','true') WHERE "USER_ID"=p_user; END IF;
END; $$;
REVOKE ALL ON FUNCTION careerup_private.reflect_adventure_completion(integer) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION careerup_private.certificate_adventure(p_action text DEFAULT 'get',p_args jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u integer;a public."SC_USER_ADVENTURE";p public."SC_PJT";r integer;outcome jsonb;plan jsonb;goals jsonb;g jsonb;idx integer:=0;d date;test_day date;test_time text;session_id text;active boolean;fresh boolean;expected text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
 SELECT "USER_ID" INTO u FROM public."SC_USERS" WHERE "AUTH_USER_ID"=auth.uid();
 IF u IS NULL THEN RAISE EXCEPTION '회원정보가 없습니다.' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('get','start','add','edit','delete','toggle','boss','dates','test_on','test_off','test_reset') OR jsonb_typeof(p_args) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION '잘못된 입력입니다.' USING ERRCODE='22023'; END IF;
 -- Fixed lock order also serializes roadmap creation and project recommendation selection.
 PERFORM pg_catalog.pg_advisory_xact_lock(76321,u);
 PERFORM pg_catalog.pg_advisory_xact_lock(76322,u);
 SELECT * INTO a FROM public."SC_USER_ADVENTURE" WHERE "USER_ID"=u FOR UPDATE;
 IF p_action='start' THEN
  SELECT "ROAD_ID" INTO r FROM public."SC_CAREER_ROADMAP" WHERE "USER_ID"=u ORDER BY "ROAD_DATE" DESC,"ROAD_ID" DESC LIMIT 1;
  IF r IS NULL OR (p_args ? 'road_id' AND r::text IS DISTINCT FROM p_args->>'road_id') THEN RAISE EXCEPTION '현재 로드맵이 변경되었습니다.' USING ERRCODE='22023'; END IF;
  expected:=nullif(p_args->>'expected_run_id','');
  IF (a."USER_ID" IS NOT NULL AND expected IS DISTINCT FROM a."RUN_ID"::text) OR (a."USER_ID" IS NULL AND expected IS NOT NULL) THEN RAISE EXCEPTION '모험 상태가 변경되었습니다. 다시 선택해주세요.' USING ERRCODE='22023'; END IF;
  active:=a."USER_ID" IS NOT NULL AND (a."STATE"->>'final_at' IS NULL OR (a."TEST_STATE" IS NOT NULL AND a."TEST_STATE"->>'final_at' IS NULL));
  session_id:=auth.jwt()->>'session_id';
  IF active THEN
   SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(auth.jwt()->'amr','[]')) amr
    WHERE amr->>'method'='password' AND CASE WHEN coalesce(amr->>'timestamp','') ~ '^[0-9]{1,12}$' THEN (amr->>'timestamp')::numeric BETWEEN extract(epoch from clock_timestamp())-120 AND extract(epoch from clock_timestamp())+10 ELSE false END) INTO fresh;
   IF NOT fresh OR session_id IS NULL OR session_id IS NOT DISTINCT FROM a."AUTH_SESSION_ID" THEN RAISE EXCEPTION '로그인 비밀번호를 다시 확인해주세요.' USING ERRCODE='42501'; END IF;
  END IF;
  test_day:=a."TEST_DATE";test_time:=coalesce(a."TEST_STATE"->>'test_time','12:00');
  IF p_args ? 'project_id' THEN
   SELECT * INTO p FROM public."SC_PJT" WHERE "PJT_ID"=(p_args->>'project_id')::integer;
   IF p."PJT_ID" IS NULL OR NOT EXISTS(SELECT 1 FROM public."SC_CAREER_ROADMAP" cr CROSS JOIN LATERAL jsonb_array_elements(coalesce(cr."PJT_RECOMMENDATIONS"->'recommendations','[]')) v WHERE cr."ROAD_ID"=r AND cr."USER_ID"=u AND v->>'project_id'=p."PJT_ID"::text) THEN RAISE EXCEPTION '현재 추천된 프로젝트를 선택해주세요.' USING ERRCODE='22023'; END IF;
   IF jsonb_array_length(p."PJT_MID_GOALS") NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION '프로젝트 중기목표를 확인해주세요.' USING ERRCODE='22023'; END IF;
   d:=coalesce(test_day,(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date);goals:='[]';
   FOR g IN SELECT v FROM jsonb_array_elements(p."PJT_MID_GOALS") WITH ORDINALITY x(v,ord) ORDER BY ord LOOP
    idx:=idx+1;goals:=goals||jsonb_build_array(g||jsonb_build_object('source_id',g->>'id','id',CASE idx WHEN 1 THEN 'written' WHEN 2 THEN 'practical' ELSE 'third' END));
   END LOOP;
   plan:=jsonb_build_object('name',p."PJT_NAME",'final_goal',p."PJT_FINAL_GOAL",'mid_goals',goals,'start_date',d,'third_date',CASE WHEN jsonb_array_length(goals)=3 THEN d+(goals->2->>'due_day')::integer ELSE NULL END);
   -- Delete/replace is atomic: every check precedes it and any later error rolls back the whole reset.
   DELETE FROM public."SC_USER_ADVENTURE" WHERE "USER_ID"=u;
   INSERT INTO public."SC_USER_ADVENTURE"("USER_ID","ROAD_ID","LC_ID","PJT_ID","PROJECT_PLAN","WRITTEN_DATE","PRACTICAL_DATE","RESULT_DATE","AUTH_SESSION_ID")
   VALUES(u,r,NULL,p."PJT_ID",plan,d+(goals->0->>'due_day')::integer,CASE WHEN jsonb_array_length(goals)>=2 THEN d+(goals->1->>'due_day')::integer ELSE NULL END,d+p."PJT_TOTAL_DAYS",session_id);
   UPDATE public."SC_CAREER_ROADMAP" SET "PJT_ID"=p."PJT_ID" WHERE "ROAD_ID"=r AND "USER_ID"=u;
  ELSE
   -- The original license-start implementation still validates recommendation membership.
   DELETE FROM public."SC_USER_ADVENTURE" WHERE "USER_ID"=u;
   outcome:=careerup_private.certificate_adventure_legacy('start',p_args-'expected_run_id'-'road_id');
   UPDATE public."SC_USER_ADVENTURE" SET "AUTH_SESSION_ID"=session_id WHERE "USER_ID"=u;
  END IF;
  IF test_day IS NOT NULL THEN
   UPDATE public."SC_USER_ADVENTURE" SET "TEST_DATE"=test_day,"TEST_STATE"="STATE"||jsonb_build_object('test_time',test_time) WHERE "USER_ID"=u;
  END IF;
  SELECT * INTO a FROM public."SC_USER_ADVENTURE" WHERE "USER_ID"=u;
  p_action:='get';p_args:='{}';
 END IF;
 IF a."PJT_ID" IS NOT NULL THEN
  outcome:=careerup_private.project_adventure(u,p_action,p_args);
  PERFORM careerup_private.reflect_adventure_completion(u);
  RETURN outcome||jsonb_build_object('demo_spec_reflection',true);
 END IF;
 outcome:=careerup_private.certificate_adventure_legacy(p_action,p_args);
 SELECT * INTO a FROM public."SC_USER_ADVENTURE" WHERE "USER_ID"=u;
 IF outcome->'adventure' IS NOT NULL AND outcome->'adventure'<>'null'::jsonb THEN
  outcome:=jsonb_set(outcome,'{adventure}',outcome->'adventure'||jsonb_build_object('kind','certificate','route','warrior','run_id',a."RUN_ID",'restart_requires_password',a."STATE"->>'final_at' IS NULL OR (a."TEST_STATE" IS NOT NULL AND a."TEST_STATE"->>'final_at' IS NULL)));
 END IF;
 PERFORM careerup_private.reflect_adventure_completion(u);
 RETURN outcome||jsonb_build_object('adventure_revision',7,'demo_spec_reflection',true);
END; $$;
COMMIT;
