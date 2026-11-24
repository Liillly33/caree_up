BEGIN;
ALTER TABLE public."SC_CAREER_ROADMAP"
 ADD COLUMN IF NOT EXISTS "PJT_RECOMMENDATIONS" jsonb;
COMMENT ON COLUMN public."SC_CAREER_ROADMAP"."PJT_RECOMMENDATIONS" IS 'AI 프로젝트 추천 1개 및 추천 근거. 실제 선택한 프로젝트는 PJT_ID에 별도 보관.';

CREATE OR REPLACE FUNCTION public.get_project_recommendations(p_road_id integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('curriculum',r."PJT_RECOMMENDATIONS",'selected_project_id',r."PJT_ID")
 FROM public."SC_CAREER_ROADMAP" r JOIN public."SC_USERS" u ON u."USER_ID"=r."USER_ID"
 AND u."AUTH_USER_ID"=(select auth.uid()) WHERE r."ROAD_ID"=p_road_id;
$$;
REVOKE ALL ON FUNCTION public.get_project_recommendations(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_project_recommendations(integer) TO authenticated;

CREATE OR REPLACE FUNCTION careerup_private.save_project_recommendations(p_road_id integer,p_result jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u integer; item jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
 SELECT "USER_ID" INTO u FROM public."SC_USERS" WHERE "AUTH_USER_ID"=auth.uid();
 -- Shares the roadmap creation lock; a late response cannot update a superseded roadmap.
 PERFORM pg_catalog.pg_advisory_xact_lock(76321,u);
 PERFORM 1 FROM public."SC_CAREER_ROADMAP" WHERE "ROAD_ID"=p_road_id AND "USER_ID"=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '본인의 로드맵이 아닙니다.' USING ERRCODE='42501'; END IF;
 IF p_road_id IS DISTINCT FROM (SELECT "ROAD_ID" FROM public."SC_CAREER_ROADMAP" WHERE "USER_ID"=u ORDER BY "ROAD_DATE" DESC,"ROAD_ID" DESC LIMIT 1) THEN
  RAISE EXCEPTION '현재 로드맵이 변경되었습니다.' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_result) IS DISTINCT FROM 'object' OR jsonb_typeof(p_result->'recommendations') IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION '추천 형식을 확인해주세요.' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_result->'recommendations')>1 OR length(p_result::text)>60000 OR coalesce(p_result->>'basis_hash','') !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION '추천 형식을 확인해주세요.' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT v FROM jsonb_array_elements(p_result->'recommendations') v LOOP
  IF jsonb_typeof(item->'project_id') IS DISTINCT FROM 'number' OR coalesce(item->>'project_id','') !~ '^[1-9][0-9]{0,9}$' THEN
   RAISE EXCEPTION '프로젝트 번호를 확인해주세요.' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public."SC_PJT" WHERE "PJT_ID"::text=item->>'project_id') OR jsonb_typeof(item->'reason') IS DISTINCT FROM 'string' OR length(btrim(coalesce(item->>'reason',''))) NOT BETWEEN 1 AND 240 THEN
   RAISE EXCEPTION '등록된 프로젝트와 추천 이유를 확인해주세요.' USING ERRCODE='22023'; END IF;
 END LOOP;
 UPDATE public."SC_CAREER_ROADMAP" SET "PJT_RECOMMENDATIONS"=p_result WHERE "ROAD_ID"=p_road_id AND "USER_ID"=u;
 RETURN p_result;
END; $$;
REVOKE ALL ON FUNCTION careerup_private.save_project_recommendations(integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION careerup_private.save_project_recommendations(integer,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.save_project_recommendations(p_road_id integer,p_result jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT careerup_private.save_project_recommendations(p_road_id,p_result); $$;
REVOKE ALL ON FUNCTION public.save_project_recommendations(integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_project_recommendations(integer,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION careerup_private.select_roadmap_project(p_road_id integer,p_project_id integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u integer; r public."SC_CAREER_ROADMAP";
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
 SELECT "USER_ID" INTO u FROM public."SC_USERS" WHERE "AUTH_USER_ID"=auth.uid();
 PERFORM pg_catalog.pg_advisory_xact_lock(76321,u);
 SELECT * INTO r FROM public."SC_CAREER_ROADMAP" WHERE "ROAD_ID"=p_road_id AND "USER_ID"=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '본인의 로드맵이 아닙니다.' USING ERRCODE='42501'; END IF;
 IF p_road_id IS DISTINCT FROM (SELECT "ROAD_ID" FROM public."SC_CAREER_ROADMAP" WHERE "USER_ID"=u ORDER BY "ROAD_DATE" DESC,"ROAD_ID" DESC LIMIT 1) THEN
  RAISE EXCEPTION '현재 로드맵이 변경되었습니다.' USING ERRCODE='22023'; END IF;
 IF p_project_id IS NULL OR NOT EXISTS(SELECT 1 FROM public."SC_PJT" WHERE "PJT_ID"=p_project_id) OR NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements(coalesce(r."PJT_RECOMMENDATIONS"->'recommendations','[]'::jsonb)) v WHERE v->>'project_id'=p_project_id::text
 ) THEN RAISE EXCEPTION '현재 추천된 프로젝트를 선택해주세요.' USING ERRCODE='22023'; END IF;
 UPDATE public."SC_CAREER_ROADMAP" SET "PJT_ID"=p_project_id WHERE "ROAD_ID"=p_road_id AND "USER_ID"=u;
 RETURN public.get_project_recommendations(p_road_id);
END; $$;
REVOKE ALL ON FUNCTION careerup_private.select_roadmap_project(integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION careerup_private.select_roadmap_project(integer,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.select_roadmap_project(p_road_id integer,p_project_id integer) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT careerup_private.select_roadmap_project(p_road_id,p_project_id); $$;
REVOKE ALL ON FUNCTION public.select_roadmap_project(integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.select_roadmap_project(integer,integer) TO authenticated;
COMMIT;
