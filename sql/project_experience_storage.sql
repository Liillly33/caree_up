-- Applied through Supabase migration: project_experience_profile_storage
BEGIN;
ALTER TABLE public."SC_SPEC_INFO" ADD COLUMN IF NOT EXISTS "SPEC_PROJECT_EXPERIENCE" text;
COMMENT ON COLUMN public."SC_SPEC_INFO"."SPEC_PROJECT_EXPERIENCE" IS '사용자가 프로젝트에서 맡은 역할. 쉼표를 분리하지 않는 자유 텍스트이며 여러 완료 프로젝트는 줄바꿈으로 누적';
CREATE OR REPLACE FUNCTION careerup_private.project_experience_sentence(p_name text,p_goal text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(nullif(btrim(p_name),''),'프로젝트')||': '||
  coalesce(nullif(regexp_replace(regexp_replace(btrim(p_goal),'\s+',' ','g'),'하기[.!?]?\s*$','했습니다.'),''),'핵심 기능을 구현했습니다.');
$$;
CREATE OR REPLACE FUNCTION careerup_private.append_project_experience(p_existing text,p_entry text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM regexp_split_to_table(coalesce(p_existing,''),E'\n') line WHERE btrim(line)=btrim(p_entry))
 THEN p_existing ELSE concat_ws(E'\n',nullif(btrim(p_existing),''),p_entry) END;
$$;
REVOKE ALL ON FUNCTION careerup_private.project_experience_sentence(text,text),careerup_private.append_project_experience(text,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.save_user_spec(p_grade integer, p_gpa double precision, p_tech_skill json, p_licenses json, p_job_codes text[], p_project_experience text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
    v_user_id integer;
    v_codes text[] := coalesce(p_job_codes, array[]::text[]);
begin
    if auth.uid() is null then
        raise exception '로그인 후 저장해주세요.' using errcode = '42501';
    end if;
    select u."USER_ID" into v_user_id
    from public."SC_USERS" u
    where u."AUTH_USER_ID" = auth.uid();
    if v_user_id is null then
        raise exception 'SC_USERS에서 회원정보를 찾을 수 없습니다.' using errcode = '42501';
    end if;
    if p_grade is not null and (p_grade < 1 or p_grade > 4) then
        raise exception '학년은 1~4 사이의 정수여야 합니다.' using errcode = '22023';
    end if;
    if p_gpa is not null and not (p_gpa between 0 and 4.5) then
        raise exception 'GPA는 0~4.5 사이의 숫자여야 합니다.' using errcode = '22023';
    end if;
    if json_typeof(p_tech_skill) is distinct from 'array'
       or json_typeof(p_licenses) is distinct from 'array' then
        raise exception '기술 스택과 자격증은 JSON 배열이어야 합니다.' using errcode = '22023';
    end if;
    if exists (select 1 from json_array_elements(p_tech_skill) as item(value) where json_typeof(item.value) <> 'string')
       or exists (select 1 from json_array_elements(p_licenses) as item(value) where json_typeof(item.value) <> 'string') then
        raise exception '기술 스택과 자격증 항목은 문자열이어야 합니다.' using errcode = '22023';
    end if;
    if cardinality(v_codes) > 3 then
        raise exception '선호직무는 최대 3개까지 선택할 수 있습니다.' using errcode = '22023';
    end if;
    if (select count(distinct code) from unnest(v_codes) as item(code)) <> cardinality(v_codes) then
        raise exception '선호직무는 중복되거나 비어 있을 수 없습니다.' using errcode = '22023';
    end if;
    if exists (
        select 1 from unnest(v_codes) as item(code)
        where not exists (select 1 from public."SC_JOB_CLASSIFICATION" j where j."JOB_CODE" = item.code)
    ) then
        raise exception '등록되지 않은 직무코드입니다. 분류를 다시 불러와주세요.' using errcode = '22023';
    end if;

    -- 이 UPSERT가 회원의 스펙 행을 잠급니다. 같은 회원의 동시 저장도 순차 처리합니다.
    insert into public."SC_SPEC_INFO"
        ("USER_ID", "SPEC_GRADE", "SPEC_GPA", "SPEC_TECH_SKILL", "SPEC_LICENSES", "SPEC_PROJECT_EXPERIENCE")
    values (v_user_id, p_grade, p_gpa, p_tech_skill, p_licenses, nullif(btrim(p_project_experience),''))
    on conflict ("USER_ID") do update set
        "SPEC_GRADE" = excluded."SPEC_GRADE",
        "SPEC_GPA" = excluded."SPEC_GPA",
        "SPEC_TECH_SKILL" = excluded."SPEC_TECH_SKILL",
        "SPEC_LICENSES" = excluded."SPEC_LICENSES",
        "SPEC_PROJECT_EXPERIENCE" = excluded."SPEC_PROJECT_EXPERIENCE";

    delete from public."SC_USER_PRFD_JOB" where "USER_ID" = v_user_id;
    insert into public."SC_USER_PRFD_JOB" ("USER_ID", "JOB_CODE", "PRFD_RANK")
    select v_user_id, item.code, item.rank::integer
    from unnest(v_codes) with ordinality as item(code, rank);

    -- 함수 전체가 한 트랜잭션입니다. 오류 발생 시 스펙과 선호직무 변경이 모두 취소됩니다.
    return jsonb_build_object('saved', true, 'user_id', v_user_id);
end;
$function$;

CREATE OR REPLACE FUNCTION careerup_private.project_adventure(p_user integer, p_action text, p_args jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   -- Completion reflection is centralized after this state is saved.

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
END; $function$;

CREATE OR REPLACE FUNCTION careerup_private.reflect_adventure_completion(p_user integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a public."SC_USER_ADVENTURE";s jsonb;entry text;values_json jsonb;phase integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public."SC_USERS" WHERE "USER_ID"=p_user AND "AUTH_USER_ID"=auth.uid()) THEN RAISE EXCEPTION '권한이 없습니다.' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public."SC_USER_ADVENTURE" WHERE "USER_ID"=p_user FOR UPDATE;
 IF a."USER_ID" IS NULL THEN RETURN; END IF;
 s:=CASE WHEN a."TEST_DATE" IS NULL THEN a."STATE" ELSE a."TEST_STATE" END;
 IF s->>'final_at' IS NULL THEN RETURN; END IF;
 IF a."PJT_ID" IS NULL AND coalesce((s->>'spec_reflected')::boolean,false) THEN RETURN; END IF;
 IF a."PJT_ID" IS NOT NULL AND coalesce((s->>'project_experience_reflected')::boolean,false) THEN RETURN; END IF;
 IF a."PJT_ID" IS NOT NULL THEN
  entry:=careerup_private.project_experience_sentence(a."PROJECT_PLAN"->>'name',a."PROJECT_PLAN"->>'final_goal');
  INSERT INTO public."SC_SPEC_INFO"("USER_ID","SPEC_PROJECT_EXPERIENCE") VALUES(p_user,entry)
  ON CONFLICT("USER_ID") DO UPDATE SET "SPEC_PROJECT_EXPERIENCE"=careerup_private.append_project_experience("SC_SPEC_INFO"."SPEC_PROJECT_EXPERIENCE",entry);
  -- Move only the exact old system entry belonging to this completed adventure.
  UPDATE public."SC_SPEC_INFO" SET "SPEC_TECH_SKILL"=(
    SELECT coalesce(jsonb_agg(e.value ORDER BY e.ord),'[]'::jsonb)::json
    FROM jsonb_array_elements("SPEC_TECH_SKILL"::jsonb) WITH ORDINALITY e(value,ord)
    WHERE e.value IS DISTINCT FROM to_jsonb(careerup_private.project_spec_title(a."PJT_ID",a."PROJECT_PLAN"->>'name'))
      AND e.value IS DISTINCT FROM to_jsonb('프로젝트 완료: '||(a."PROJECT_PLAN"->>'name')||' · '||(a."PROJECT_PLAN"->>'final_goal'))
  ) WHERE "USER_ID"=p_user AND jsonb_typeof("SPEC_TECH_SKILL"::jsonb)='array';
  s:=jsonb_set(s,'{project_experience_reflected}','true');
 ELSE
  SELECT "LC_PHASE",CASE "LC_CERT_CODE" WHEN 'SQLD' THEN 'SQLD' WHEN 'ADSP' THEN 'ADsP' ELSE coalesce("LC_CERT_NAME","LC_NAME") END INTO phase,entry FROM public."SC_LC" WHERE "LC_ID"=a."LC_ID";
  IF phase=1 OR entry IS NULL THEN RETURN; END IF;
  SELECT coalesce("SPEC_LICENSES"::jsonb,'[]') INTO values_json FROM public."SC_SPEC_INFO" WHERE "USER_ID"=p_user FOR UPDATE;
  IF jsonb_typeof(coalesce(values_json,'[]'))<>'array' THEN RAISE EXCEPTION '보유 자격증 형식을 확인해주세요.' USING ERRCODE='22023'; END IF;
  INSERT INTO public."SC_SPEC_INFO"("USER_ID","SPEC_LICENSES") VALUES(p_user,jsonb_build_array(entry)::json)
  ON CONFLICT("USER_ID") DO UPDATE SET "SPEC_LICENSES"=(CASE WHEN coalesce("SC_SPEC_INFO"."SPEC_LICENSES"::jsonb,'[]') @> jsonb_build_array(entry) THEN coalesce("SC_SPEC_INFO"."SPEC_LICENSES"::jsonb,'[]') ELSE coalesce("SC_SPEC_INFO"."SPEC_LICENSES"::jsonb,'[]')||jsonb_build_array(entry) END)::json;
 END IF;
 IF a."TEST_DATE" IS NULL THEN UPDATE public."SC_USER_ADVENTURE" SET "STATE"=jsonb_set(s,'{spec_reflected}','true') WHERE "USER_ID"=p_user;
 ELSE UPDATE public."SC_USER_ADVENTURE" SET "TEST_STATE"=jsonb_set(s,'{spec_reflected}','true') WHERE "USER_ID"=p_user; END IF;
END; $function$;

CREATE OR REPLACE FUNCTION careerup_private.certificate_adventure(p_action text DEFAULT 'get'::text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  RETURN outcome||jsonb_build_object('demo_spec_reflection',true,
    'project_experience',(SELECT "SPEC_PROJECT_EXPERIENCE" FROM public."SC_SPEC_INFO" WHERE "USER_ID"=u),
    'project_experience_entry',CASE WHEN outcome->'adventure'->'state'->>'final_at' IS NOT NULL THEN careerup_private.project_experience_sentence(a."PROJECT_PLAN"->>'name',a."PROJECT_PLAN"->>'final_goal') ELSE NULL END);
 END IF;
 outcome:=careerup_private.certificate_adventure_legacy(p_action,p_args);
 SELECT * INTO a FROM public."SC_USER_ADVENTURE" WHERE "USER_ID"=u;
 IF outcome->'adventure' IS NOT NULL AND outcome->'adventure'<>'null'::jsonb THEN
  outcome:=jsonb_set(outcome,'{adventure}',outcome->'adventure'||jsonb_build_object('kind','certificate','route','warrior','run_id',a."RUN_ID",'restart_requires_password',a."STATE"->>'final_at' IS NULL OR (a."TEST_STATE" IS NOT NULL AND a."TEST_STATE"->>'final_at' IS NULL)));
 END IF;
 PERFORM careerup_private.reflect_adventure_completion(u);
 RETURN outcome||jsonb_build_object('adventure_revision',7,'demo_spec_reflection',true);
END; $function$;

CREATE OR REPLACE FUNCTION public.certificate_adventure(p_action text DEFAULT 'get'::text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT careerup_private.certificate_adventure(p_action,p_args); $function$;

REVOKE ALL ON FUNCTION public.save_user_spec(integer,double precision,json,json,text[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_user_spec(integer,double precision,json,json,text[],text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
