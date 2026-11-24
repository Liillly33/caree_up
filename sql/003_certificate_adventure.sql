BEGIN;
ALTER TABLE public."SC_LC"
 ADD COLUMN "LC_NAME" text UNIQUE,
 ADD COLUMN "WRITTEN_DATE" date,
 ADD COLUMN "PRACTICAL_DATE" date,
 ADD COLUMN "RESULT_DATE" date,
 ADD COLUMN "MID_GOALS" jsonb NOT NULL DEFAULT '[]',
 ADD COLUMN "BOSS_CODES" jsonb NOT NULL DEFAULT '{}';
INSERT INTO public."SC_LC" ("LC_NAME","WRITTEN_DATE","PRACTICAL_DATE","RESULT_DATE","MID_GOALS","BOSS_CODES")
VALUES ('정보처리기사','2026-01-30','2026-04-18','2026-06-05',
 '[{"id":"written","title":"필기시험 완료","daily":"정보처리기사 필기 기출문제 20문제 풀고 오답 정리하기"},{"id":"practical","title":"실기시험 완료","daily":"정보처리기사 실기 문제 1개 풀고 풀이 정리하기"}]',
 jsonb_build_object('written',extensions.crypt('0130',extensions.gen_salt('bf')),'practical',extensions.crypt('0418',extensions.gen_salt('bf'))));
CREATE TABLE public."SC_USER_ADVENTURE" (
 "USER_ID" integer PRIMARY KEY REFERENCES public."SC_USERS"("USER_ID") ON DELETE CASCADE,
 "ROAD_ID" integer NOT NULL REFERENCES public."SC_CAREER_ROADMAP"("ROAD_ID") ON DELETE RESTRICT,
 "LC_ID" integer NOT NULL REFERENCES public."SC_LC"("LC_ID") ON DELETE RESTRICT,
 "WRITTEN_DATE" date NOT NULL,"PRACTICAL_DATE" date NOT NULL,"RESULT_DATE" date NOT NULL,
 "STATE" jsonb NOT NULL DEFAULT '{"level":1,"custom":[],"done":{},"day":"","awarded":[]}',
 "TEST_DATE" date,"TEST_STATE" jsonb,
 CHECK ("WRITTEN_DATE"<="PRACTICAL_DATE" AND "PRACTICAL_DATE"<="RESULT_DATE"),
 CHECK (("TEST_DATE" IS NULL)=("TEST_STATE" IS NULL))
);
CREATE INDEX sc_user_adventure_road_idx ON public."SC_USER_ADVENTURE"("ROAD_ID");
CREATE INDEX sc_user_adventure_lc_idx ON public."SC_USER_ADVENTURE"("LC_ID");
ALTER TABLE public."SC_USER_ADVENTURE" ENABLE ROW LEVEL SECURITY;
CREATE POLICY adventure_read_own ON public."SC_USER_ADVENTURE" FOR SELECT TO authenticated USING ("USER_ID" IN (SELECT "USER_ID" FROM public."SC_USERS" WHERE "AUTH_USER_ID"=(select auth.uid())));
REVOKE ALL ON public."SC_USER_ADVENTURE" FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public."SC_USER_ADVENTURE" TO authenticated;
REVOKE ALL ON public."SC_LC" FROM PUBLIC,anon,authenticated;
GRANT SELECT("LC_ID","LC_NAME","WRITTEN_DATE","PRACTICAL_DATE","RESULT_DATE","MID_GOALS") ON public."SC_LC" TO authenticated;
CREATE POLICY license_reference_read ON public."SC_LC" FOR SELECT TO authenticated USING (true);

CREATE FUNCTION careerup_private.adventure_payload(p_user integer,p_leveled boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public."SC_USER_ADVENTURE"; l public."SC_LC"; s jsonb; d date;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public."SC_USERS" WHERE "USER_ID"=p_user AND "AUTH_USER_ID"=auth.uid()) THEN RAISE EXCEPTION '권한이 없습니다.' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM public."SC_LC" WHERE "LC_NAME"='정보처리기사';
 SELECT * INTO a FROM public."SC_USER_ADVENTURE" WHERE "USER_ID"=p_user;
 IF a."USER_ID" IS NULL THEN RETURN jsonb_build_object('adventure',null,'license',jsonb_build_object('name',l."LC_NAME",'written_date',l."WRITTEN_DATE",'practical_date',l."PRACTICAL_DATE",'result_date',l."RESULT_DATE",'mid_goals',l."MID_GOALS")); END IF;
 d:=coalesce(a."TEST_DATE",(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date);
 s:=CASE WHEN a."TEST_DATE" IS NULL THEN a."STATE" ELSE a."TEST_STATE" END;
 RETURN jsonb_build_object('adventure',jsonb_build_object('road_id',a."ROAD_ID",'name',l."LC_NAME",'written_date',a."WRITTEN_DATE",'practical_date',a."PRACTICAL_DATE",'result_date',a."RESULT_DATE",'mid_goals',l."MID_GOALS",'state',s,'today',d,'real_today',(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date,'test_mode',a."TEST_DATE" IS NOT NULL),'leveled_up',p_leveled);
END; $$;
REVOKE ALL ON FUNCTION careerup_private.adventure_payload(integer,boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION careerup_private.certificate_adventure(p_action text DEFAULT 'get',p_args jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u integer; a public."SC_USER_ADVENTURE"; l public."SC_LC"; s jsonb; d date; r integer; k text; txt text; b text; at_key text; due date; n integer; ready boolean; leveled boolean:=false; dates date[]; lic jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
 SELECT "USER_ID" INTO u FROM public."SC_USERS" WHERE "AUTH_USER_ID"=auth.uid();
 IF u IS NULL THEN RAISE EXCEPTION '회원정보가 없습니다.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_args) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION '잘못된 입력입니다.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(76322,u);
 SELECT * INTO l FROM public."SC_LC" WHERE "LC_NAME"='정보처리기사';
 SELECT * INTO a FROM public."SC_USER_ADVENTURE" WHERE "USER_ID"=u FOR UPDATE;
 IF p_action='start' THEN
  SELECT "ROAD_ID" INTO r FROM public."SC_CAREER_ROADMAP" WHERE "USER_ID"=u ORDER BY "ROAD_DATE" DESC,"ROAD_ID" DESC LIMIT 1;
  IF r IS NULL THEN RAISE EXCEPTION '먼저 공고의 커리어 로드맵을 생성해주세요.' USING ERRCODE='22023'; END IF;
  IF a."USER_ID" IS NULL THEN
   INSERT INTO public."SC_USER_ADVENTURE"("USER_ID","ROAD_ID","LC_ID","WRITTEN_DATE","PRACTICAL_DATE","RESULT_DATE") VALUES(u,r,l."LC_ID",l."WRITTEN_DATE",l."PRACTICAL_DATE",l."RESULT_DATE");
  ELSIF a."ROAD_ID"<>r THEN
   UPDATE public."SC_USER_ADVENTURE" SET "ROAD_ID"=r,"TEST_DATE"=NULL,"TEST_STATE"=NULL WHERE "USER_ID"=u;
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
  a."TEST_DATE":=d;
 ELSIF p_action='test_off' THEN a."TEST_DATE":=NULL;a."TEST_STATE":=NULL;
 END IF;
 d:=coalesce(a."TEST_DATE",(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date);
 s:=CASE WHEN a."TEST_DATE" IS NULL THEN a."STATE" ELSE a."TEST_STATE" END;
 IF s->>'day' IS DISTINCT FROM d::text THEN s:=s||jsonb_build_object('day',d,'done','{}'::jsonb); END IF;
 IF p_action='dates' THEN
  dates:=ARRAY[(p_args->>'written')::date,(p_args->>'practical')::date,(p_args->>'result')::date];
  IF dates[1] IS NULL OR dates[2] IS NULL OR dates[3] IS NULL OR dates[1]>dates[2] OR dates[2]>dates[3] THEN RAISE EXCEPTION '필기일 ≤ 실기일 ≤ 합격발표일 순서로 입력해주세요.' USING ERRCODE='22023'; END IF;
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
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s->'custom') g WHERE g->>'id'=k) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(l."MID_GOALS") g WHERE g->>'id'=k AND k=CASE WHEN s->>'written_at' IS NULL THEN 'written' WHEN s->>'practical_at' IS NULL THEN 'practical' ELSE NULL END) THEN RAISE EXCEPTION '현재 일일목표를 찾을 수 없습니다.' USING ERRCODE='22023'; END IF;
   s:=jsonb_set(s,ARRAY['done',k],to_jsonb(NOT coalesce((s->'done'->>k)::boolean,false)),true);
  END IF;
 ELSIF p_action='boss' THEN
  b:=p_args->>'stage';at_key:=b||'_at';
  IF b NOT IN ('written','practical','final') OR b IS NULL THEN RAISE EXCEPTION '잘못된 보스입니다.' USING ERRCODE='22023'; END IF;
  due:=CASE b WHEN 'written' THEN a."WRITTEN_DATE" WHEN 'practical' THEN a."PRACTICAL_DATE" ELSE a."RESULT_DATE" END;
  IF d<due THEN RAISE EXCEPTION '아직 보스가 등장하는 날짜가 아닙니다.' USING ERRCODE='22023'; END IF;
  IF b='practical' AND s->>'written_at' IS NULL OR b='final' AND (s->>'written_at' IS NULL OR s->>'practical_at' IS NULL) THEN RAISE EXCEPTION '이전 중간보스를 먼저 토벌해주세요.' USING ERRCODE='22023'; END IF;
  IF s->>at_key IS NULL THEN
   txt:=coalesce(p_args->>'password','');
   IF b<>'final' AND (length(txt)>128 OR extensions.crypt(txt,l."BOSS_CODES"->>b) IS DISTINCT FROM l."BOSS_CODES"->>b) THEN RAISE EXCEPTION '완료 비밀번호가 올바르지 않습니다.' USING ERRCODE='22023'; END IF;
   s:=s||jsonb_build_object(at_key,clock_timestamp());
   IF b='final' AND a."TEST_DATE" IS NULL THEN
    SELECT coalesce("SPEC_LICENSES"::jsonb,'[]'::jsonb) INTO lic FROM public."SC_SPEC_INFO" WHERE "USER_ID"=u;
    lic:=coalesce(lic,'[]'::jsonb);
    IF jsonb_typeof(lic)<>'array' THEN RAISE EXCEPTION '보유 자격증 형식을 확인해주세요.' USING ERRCODE='22023'; END IF;
    IF NOT lic @> jsonb_build_array(l."LC_NAME") THEN lic:=lic||jsonb_build_array(l."LC_NAME"); END IF;
    INSERT INTO public."SC_SPEC_INFO"("USER_ID","SPEC_LICENSES") VALUES(u,lic::json) ON CONFLICT("USER_ID") DO UPDATE SET "SPEC_LICENSES"=excluded."SPEC_LICENSES";
   END IF;
  END IF;
 ELSIF p_action NOT IN ('get','start','test_on','test_off','test_reset') THEN RAISE EXCEPTION '지원하지 않는 동작입니다.' USING ERRCODE='22023';
 END IF;
 IF p_action IN ('toggle','delete','edit','add') THEN
  SELECT count(*),coalesce(bool_and(coalesce((s->'done'->>(g->>'id'))::boolean,false)),false) INTO n,ready FROM (
   SELECT g FROM jsonb_array_elements(l."MID_GOALS") g WHERE g->>'id'=CASE WHEN s->>'written_at' IS NULL THEN 'written' WHEN s->>'practical_at' IS NULL THEN 'practical' ELSE NULL END
   UNION ALL SELECT g FROM jsonb_array_elements(s->'custom') g
  ) all_goals;
  IF n>0 AND ready AND NOT (s->'awarded') @> jsonb_build_array(d::text) THEN
   s:=s||jsonb_build_object('level',(s->>'level')::integer+1,'awarded',(s->'awarded')||jsonb_build_array(d::text));leveled:=true;
  END IF;
 END IF;
 IF a."TEST_DATE" IS NULL THEN a."STATE":=s;ELSE a."TEST_STATE":=s;END IF;
 UPDATE public."SC_USER_ADVENTURE" SET "STATE"=a."STATE","TEST_DATE"=a."TEST_DATE","TEST_STATE"=a."TEST_STATE","WRITTEN_DATE"=a."WRITTEN_DATE","PRACTICAL_DATE"=a."PRACTICAL_DATE","RESULT_DATE"=a."RESULT_DATE" WHERE "USER_ID"=u;
 RETURN careerup_private.adventure_payload(u,leveled);
END; $$;
REVOKE ALL ON FUNCTION careerup_private.certificate_adventure(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION careerup_private.certificate_adventure(text,jsonb) TO authenticated;
CREATE FUNCTION public.certificate_adventure(p_action text DEFAULT 'get',p_args jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT careerup_private.certificate_adventure(p_action,p_args); $$;
REVOKE ALL ON FUNCTION public.certificate_adventure(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.certificate_adventure(text,jsonb) TO authenticated;
COMMIT;
