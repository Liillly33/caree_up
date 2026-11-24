BEGIN;
CREATE OR REPLACE FUNCTION careerup_private.project_main_technology(p_code text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE split_part(p_code,'_',1) WHEN 'SB' THEN 'Spring Boot' WHEN 'NEXT' THEN 'Next.js' WHEN 'FASTAPI' THEN 'FastAPI' WHEN 'TW' THEN 'Tailwind CSS' WHEN 'REDIS' THEN 'Redis' WHEN 'DRIZZLE' THEN 'Drizzle ORM' WHEN 'K8S' THEN 'Kubernetes' WHEN 'GHA' THEN 'GitHub Actions' WHEN 'TORCH' THEN 'PyTorch' WHEN 'VDB' THEN 'Vector Database' WHEN 'VERCEL' THEN 'Vercel' WHEN 'DOCKER' THEN 'Docker' END;
$$;
REVOKE ALL ON FUNCTION careerup_private.project_main_technology(text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION careerup_private.project_spec_title(p_project_id integer,p_name text) RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT '프로젝트: '||CASE WHEN main IS NULL OR left(p_name,length(main)+3)=main||' · ' THEN p_name ELSE main||' · '||p_name END
 FROM (SELECT careerup_private.project_main_technology("PJT_CODE") main FROM public."SC_PJT" WHERE "PJT_ID"=p_project_id) p;
$$;
REVOKE ALL ON FUNCTION careerup_private.project_spec_title(integer,text) FROM PUBLIC,anon,authenticated;
-- Convert only exact, previously system-generated entries; leave user-entered text and all other skills unchanged.
WITH mappings AS (
 SELECT '프로젝트 완료: '||"PJT_NAME"||' · '||"PJT_FINAL_GOAL" AS old_value,careerup_private.project_spec_title("PJT_ID","PJT_NAME") AS new_value FROM public."SC_PJT"
), replacements AS (
 SELECT s."USER_ID",jsonb_agg(x.value ORDER BY x.first_ord) AS skills
 FROM public."SC_SPEC_INFO" s CROSS JOIN LATERAL (
  SELECT coalesce(to_jsonb(m.new_value),e.value) AS value,min(e.ord) AS first_ord
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s."SPEC_TECH_SKILL"::jsonb)='array' THEN s."SPEC_TECH_SKILL"::jsonb ELSE '[]'::jsonb END) WITH ORDINALITY e(value,ord)
  LEFT JOIN mappings m ON e.value=to_jsonb(m.old_value)
  GROUP BY coalesce(to_jsonb(m.new_value),e.value),CASE WHEN m.new_value IS NOT NULL OR EXISTS(SELECT 1 FROM mappings n WHERE e.value=to_jsonb(n.new_value)) THEN NULL ELSE e.ord END
 ) x
 WHERE EXISTS(SELECT 1 FROM mappings m WHERE s."SPEC_TECH_SKILL"::jsonb @> jsonb_build_array(m.old_value))
 GROUP BY s."USER_ID"
)
UPDATE public."SC_SPEC_INFO" s SET "SPEC_TECH_SKILL"=r.skills::json FROM replacements r WHERE s."USER_ID"=r."USER_ID";
UPDATE public."SC_PJT" SET "PJT_NAME"=careerup_private.project_main_technology("PJT_CODE")||' · '||"PJT_NAME"
 WHERE careerup_private.project_main_technology("PJT_CODE") IS NOT NULL AND left("PJT_NAME",length(careerup_private.project_main_technology("PJT_CODE"))+3)<>careerup_private.project_main_technology("PJT_CODE")||' · ';

CREATE OR REPLACE FUNCTION careerup_private.project_adventure(p_user integer,p_action text,p_args jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public."SC_USER_ADVENTURE";s jsonb;d date;t time;q date;goals jsonb;g jsonb;k text;txt text;b text;due date;old integer;newexp integer;points integer:=0;gained integer:=0;bonus integer:=0;reward_id text;enemy text;idx integer;arr jsonb;stage_dates date[];skill text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public."SC_USERS" WHERE "USER_ID"=p_user AND "AUTH_USER_ID"=auth.uid()) THEN RAISE EXCEPTION '권한이 없습니다.' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public."SC_USER_ADVENTURE" WHERE "USER_ID"=p_user FOR UPDATE;
 IF a."PJT_ID" IS NULL THEN RAISE EXCEPTION '진행 중인 프로젝트가 없습니다.' USING ERRCODE='22023'; END IF;
 goals:=a."PROJECT_PLAN"->'mid_goals';
 IF p_action IN ('test_on','test_reset') THEN
  IF (p_args->>'date')::date IS NULL OR coalesce(p_args->>'time','12:00') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION '테스트 날짜와 시간을 확인해주세요.' USING ERRCODE='22023'; END IF;
  IF p_action='test_reset' THEN a."TEST_STATE":=jsonb_build_object('level',1,'exp',0,'custom',a."STATE"->'custom','done','{}'::jsonb,'day','','awarded','[]'::jsonb);
  ELSIF a."TEST_STATE" IS NULL THEN a."TEST_STATE":=a."STATE"; END IF;
  a."TEST_DATE":=(p_args->>'date')::date;
  a."TEST_STATE":=a."TEST_STATE"||jsonb_build_object('test_time',coalesce(p_args->>'time','12:00'));
 ELSIF p_action='test_off' THEN a."TEST_DATE":=NULL;a."TEST_STATE":=NULL; END IF;
 d:=coalesce(a."TEST_DATE",(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date);
 t:=CASE WHEN a."TEST_DATE" IS NULL THEN (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::time ELSE coalesce((a."TEST_STATE"->>'test_time')::time,'12:00'::time) END;
 q:=d-CASE WHEN t<'06:00'::time THEN 1 ELSE 0 END;
 s:=careerup_private.project_state(a,CASE WHEN a."TEST_DATE" IS NULL THEN a."STATE" ELSE a."TEST_STATE" END,d,t);
 IF p_action='dates' THEN
  stage_dates:=ARRAY[(p_args->>'written')::date,nullif(p_args->>'practical','')::date,nullif(p_args->>'third','')::date,(p_args->>'result')::date];
  IF stage_dates[1] IS NULL OR stage_dates[4] IS NULL OR stage_dates[1]>stage_dates[4]
   OR (jsonb_array_length(goals)>=2 AND (stage_dates[2] IS NULL OR stage_dates[1]>stage_dates[2] OR stage_dates[2]>stage_dates[4]))
   OR (jsonb_array_length(goals)=3 AND (stage_dates[3] IS NULL OR stage_dates[2]>stage_dates[3] OR stage_dates[3]>stage_dates[4]))
   OR (jsonb_array_length(goals)<2 AND stage_dates[2] IS NOT NULL) OR (jsonb_array_length(goals)<3 AND stage_dates[3] IS NOT NULL) THEN
   RAISE EXCEPTION '중기목표와 최종목표 날짜 순서를 확인해주세요.' USING ERRCODE='22023'; END IF;
  a."WRITTEN_DATE":=stage_dates[1];a."PRACTICAL_DATE":=stage_dates[2];a."RESULT_DATE":=stage_dates[4];
  a."PROJECT_PLAN":=a."PROJECT_PLAN"||jsonb_build_object('third_date',stage_dates[3]);
 ELSIF p_action IN ('add','edit','delete','toggle') THEN
  k:=p_args->>'id';txt:=btrim(p_args->>'text');
  IF p_action IN ('add','edit') AND (txt IS NULL OR length(txt) NOT BETWEEN 1 AND 200) THEN RAISE EXCEPTION '일일목표는 1~200자로 입력해주세요.' USING ERRCODE='22023'; END IF;
  IF p_action='add' THEN
   IF jsonb_array_length(s->'custom')>=20 THEN RAISE EXCEPTION '직접 추가한 목표는 최대 20개입니다.' USING ERRCODE='22023'; END IF;
   k:='u-'||pg_catalog.gen_random_uuid()::text;s:=jsonb_set(s,'{custom}',s->'custom'||jsonb_build_array(jsonb_build_object('id',k,'text',txt)));
  ELSIF p_action IN ('edit','delete') THEN
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s->'custom') v WHERE v->>'id'=k) THEN RAISE EXCEPTION '고정 목표는 수정하거나 삭제할 수 없습니다.' USING ERRCODE='22023'; END IF;
   SELECT coalesce(jsonb_agg(CASE WHEN v->>'id'=k THEN v||jsonb_build_object('text',txt) ELSE v END),'[]') INTO arr FROM jsonb_array_elements(s->'custom') v WHERE p_action<>'delete' OR v->>'id'<>k;
   s:=jsonb_set(s,'{custom}',arr);s:=jsonb_set(s,'{done}',s->'done'-k);
  ELSE
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s->'custom') v WHERE v->>'id'=k) AND k IS DISTINCT FROM s->'main_goal'->>'id' THEN RAISE EXCEPTION '현재 일일목표를 찾을 수 없습니다.' USING ERRCODE='22023'; END IF;
   IF k=s->'main_goal'->>'id' AND s->'main_goal' ? 'milestone' THEN RAISE EXCEPTION '목표 완료 확인 절차를 진행해주세요.' USING ERRCODE='22023'; END IF;
   s:=jsonb_set(s,ARRAY['done',k],to_jsonb(NOT coalesce((s->'done'->>k)::boolean,false)),true);
   IF coalesce((s->'done'->>k)::boolean,false) THEN reward_id:=k;points:=CASE WHEN k=s->'main_goal'->>'id' THEN 70 ELSE 30 END; END IF;
   IF k=s->'main_goal'->>'id' AND coalesce((s->'done'->>k)::boolean,false) THEN s:=s||jsonb_build_object('daily_defeated',true); END IF;
  END IF;
 ELSIF p_action='boss' THEN
  b:=p_args->>'stage';
  IF b IS NULL OR b NOT IN ('written','practical','third','final') OR (b<>'final' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(goals) v WHERE v->>'id'=b)) THEN RAISE EXCEPTION '잘못된 보스입니다.' USING ERRCODE='22023'; END IF;
  due:=CASE b WHEN 'written' THEN a."WRITTEN_DATE" WHEN 'practical' THEN a."PRACTICAL_DATE" WHEN 'third' THEN (a."PROJECT_PLAN"->>'third_date')::date ELSE a."RESULT_DATE" END;
  IF d<due THEN RAISE EXCEPTION '아직 보스가 등장하는 날짜가 아닙니다.' USING ERRCODE='22023'; END IF;
  FOR g IN SELECT v FROM jsonb_array_elements(goals) WITH ORDINALITY x(v,ord) ORDER BY ord LOOP
   EXIT WHEN g->>'id'=b;
   IF s->>(g->>'id'||'_at') IS NULL THEN RAISE EXCEPTION '이전 중간보스를 먼저 토벌해주세요.' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF s->>(b||'_at') IS NULL THEN
   IF b<>'final' AND coalesce(p_args->>'password','')<>to_char(due,'MMDD') THEN RAISE EXCEPTION '완료 비밀번호가 올바르지 않습니다.' USING ERRCODE='22023'; END IF;
   -- Project completion is self-attested; reset authorization uses the separate login-password flow.
   s:=s||jsonb_build_object(b||'_at',clock_timestamp());
   IF NOT s->'milestone_rewards' ? b THEN
    s:=s||jsonb_build_object('level',(s->>'level')::numeric+40);s:=jsonb_set(s,ARRAY['milestone_rewards',b],'40'::jsonb,true);bonus:=40;
   END IF;
   s:=jsonb_set(s,ARRAY['done',b],'true'::jsonb,true);
   IF b=s->'main_goal'->>'id' THEN reward_id:=b;points:=70;s:=s||jsonb_build_object('daily_defeated',true); END IF;
   IF b='final' AND a."TEST_DATE" IS NULL THEN
    skill:=careerup_private.project_spec_title(a."PJT_ID",a."PROJECT_PLAN"->>'name');
    SELECT coalesce("SPEC_TECH_SKILL"::jsonb,'[]') INTO arr FROM public."SC_SPEC_INFO" WHERE "USER_ID"=p_user;arr:=coalesce(arr,'[]');
    IF jsonb_typeof(arr)<>'array' THEN RAISE EXCEPTION '기술 스택 형식을 확인해주세요.' USING ERRCODE='22023'; END IF;
    IF NOT arr @> jsonb_build_array(skill) THEN arr:=arr||jsonb_build_array(skill); END IF;
    INSERT INTO public."SC_SPEC_INFO"("USER_ID","SPEC_TECH_SKILL") VALUES(p_user,arr::json) ON CONFLICT("USER_ID") DO UPDATE SET "SPEC_TECH_SKILL"=excluded."SPEC_TECH_SKILL";
   END IF;
  END IF;
 ELSIF p_action NOT IN ('get','start','test_on','test_off','test_reset') THEN RAISE EXCEPTION '지원하지 않는 동작입니다.' USING ERRCODE='22023'; END IF;
 IF reward_id IS NOT NULL AND NOT coalesce(s->'rewarded'->q::text,'{}') ? reward_id THEN
  s:=jsonb_set(s,'{rewarded}',s->'rewarded'||jsonb_build_object(q::text,coalesce(s->'rewarded'->q::text,'{}')||jsonb_build_object(reward_id,points)));
  newexp:=coalesce((s->>'exp')::integer,0)+points;gained:=newexp/100;
  s:=s||jsonb_build_object('exp',newexp%100,'level',(s->>'level')::numeric+gained);
 ELSE points:=0; END IF;
 IF a."TEST_DATE" IS NULL THEN a."STATE":=s;ELSE a."TEST_STATE":=s;END IF;
 UPDATE public."SC_USER_ADVENTURE" SET "STATE"=a."STATE","TEST_DATE"=a."TEST_DATE","TEST_STATE"=a."TEST_STATE","WRITTEN_DATE"=a."WRITTEN_DATE","PRACTICAL_DATE"=a."PRACTICAL_DATE","RESULT_DATE"=a."RESULT_DATE","PROJECT_PLAN"=a."PROJECT_PLAN" WHERE "USER_ID"=p_user;
 s:=careerup_private.project_state(a,s,d,t);
 enemy:=CASE WHEN d>=a."RESULT_DATE" AND s->>'final_at' IS NULL THEN 'final'
  WHEN d=(a."PROJECT_PLAN"->>'third_date')::date AND s->>'third_at' IS NULL THEN 'third'
  WHEN d=a."PRACTICAL_DATE" AND s->>'practical_at' IS NULL THEN 'practical'
  WHEN d=a."WRITTEN_DATE" AND s->>'written_at' IS NULL THEN 'written'
  WHEN d<>a."WRITTEN_DATE" AND (a."PRACTICAL_DATE" IS NULL OR d<>a."PRACTICAL_DATE") AND (a."PROJECT_PLAN"->>'third_date' IS NULL OR d<>(a."PROJECT_PLAN"->>'third_date')::date) AND d<a."RESULT_DATE" AND NOT coalesce((s->>'daily_defeated')::boolean,false) AND s->>'final_at' IS NULL THEN 'daily' ELSE NULL END;
 RETURN jsonb_build_object('adventure_revision',7,'reward_policy',2,'adventure',jsonb_build_object('kind','project','route','mage','road_id',a."ROAD_ID",'project_id',a."PJT_ID",'run_id',a."RUN_ID",'name',a."PROJECT_PLAN"->>'name','spec_title',careerup_private.project_spec_title(a."PJT_ID",a."PROJECT_PLAN"->>'name'),'final_goal',a."PROJECT_PLAN"->>'final_goal','mid_goals',goals,'start_date',a."PROJECT_PLAN"->>'start_date','written_date',a."WRITTEN_DATE",'practical_date',a."PRACTICAL_DATE",'third_date',a."PROJECT_PLAN"->>'third_date','result_date',a."RESULT_DATE",'state',s,'today',d,'quest_day',q,'clock_time',to_char(t,'HH24:MI'),'real_today',(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date,'test_mode',a."TEST_DATE" IS NOT NULL,'monster',enemy,'promotion_levels',jsonb_build_array(40,80),'milestone_level_reward',40,'max_exp',100,'main_exp',70,'daily_exp',30,'restart_requires_password',a."STATE"->>'final_at' IS NULL OR (a."TEST_STATE" IS NOT NULL AND a."TEST_STATE"->>'final_at' IS NULL)),'leveled_up',(gained+bonus)>0,'levels_gained',gained+bonus,'milestone_level_reward',bonus,'quest_reward',points);
END; $$;
REVOKE ALL ON FUNCTION careerup_private.project_adventure(integer,text,jsonb) FROM PUBLIC,anon,authenticated;

COMMIT;
