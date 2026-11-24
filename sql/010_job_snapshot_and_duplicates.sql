BEGIN;
CREATE OR REPLACE FUNCTION careerup_private.job_dedupe_text(v text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT regexp_replace(btrim(coalesce(v,'')),'[[:space:]]+',' ','g'); $$;
CREATE OR REPLACE FUNCTION careerup_private.job_dedupe_key(company text,code text,location text,employment text,experience text,duties text,requirements text,preferences text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT md5(jsonb_build_array(lower(careerup_private.job_dedupe_text(company)),code,careerup_private.job_dedupe_text(location),careerup_private.job_dedupe_text(employment),careerup_private.job_dedupe_text(experience),careerup_private.job_dedupe_text(duties),careerup_private.job_dedupe_text(requirements),careerup_private.job_dedupe_text(preferences))::text); $$;
REVOKE ALL ON FUNCTION careerup_private.job_dedupe_text(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION careerup_private.job_dedupe_key(text,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
-- Keep referenced rows first. Never alter matching history or roadmap foreign keys.
WITH ranked AS (
 SELECT j."JOB_ANN_ID",row_number() over(
  PARTITION BY careerup_private.job_dedupe_key("JOB_CORP_NAME","JOB_CODE","JOB_LOCATION","JOB_TYPE","JOB_EXPERIENCE","JOB_RESPONSIBILITIES","JOB_REQUIRE","JOB_PREFERRD_QUALIFICATION")
  ORDER BY (EXISTS(SELECT 1 FROM public."SC_MATCHING_RESULT" m WHERE m."JOB_ANN_ID"=j."JOB_ANN_ID") OR EXISTS(SELECT 1 FROM public."SC_CAREER_ROADMAP" r WHERE r."JOB_ANN_ID"=j."JOB_ANN_ID")) DESC,j."JOB_ANN_ID"
 ) AS position
 FROM public."SC_JOB_ANNOUNCEMENT" j
 WHERE careerup_private.job_dedupe_text("JOB_CORP_NAME") NOT IN ('','미기재') AND careerup_private.job_dedupe_text("JOB_RESPONSIBILITIES")<>''
)
DELETE FROM public."SC_JOB_ANNOUNCEMENT" j USING ranked d WHERE j."JOB_ANN_ID"=d."JOB_ANN_ID" AND d.position>1
 AND NOT EXISTS(SELECT 1 FROM public."SC_MATCHING_RESULT" m WHERE m."JOB_ANN_ID"=j."JOB_ANN_ID")
 AND NOT EXISTS(SELECT 1 FROM public."SC_CAREER_ROADMAP" r WHERE r."JOB_ANN_ID"=j."JOB_ANN_ID");
CREATE UNIQUE INDEX IF NOT EXISTS sc_job_announcement_content_unique ON public."SC_JOB_ANNOUNCEMENT"(
 careerup_private.job_dedupe_key("JOB_CORP_NAME","JOB_CODE","JOB_LOCATION","JOB_TYPE","JOB_EXPERIENCE","JOB_RESPONSIBILITIES","JOB_REQUIRE","JOB_PREFERRD_QUALIFICATION")
) WHERE careerup_private.job_dedupe_text("JOB_CORP_NAME") NOT IN ('','미기재') AND careerup_private.job_dedupe_text("JOB_RESPONSIBILITIES")<>'';
-- Preserve the existing authenticated-only announcement access policy.
CREATE OR REPLACE FUNCTION public.get_job_catalog_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('schema_version',1,'count',count(*),'fetched_at',statement_timestamp(),'jobs',coalesce(jsonb_agg(to_jsonb(j) ORDER BY j."JOB_ANN_ID"),'[]'::jsonb)) FROM public."SC_JOB_ANNOUNCEMENT" j;
$$;
REVOKE ALL ON FUNCTION public.get_job_catalog_snapshot() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_job_catalog_snapshot() TO authenticated,service_role;
COMMIT;
