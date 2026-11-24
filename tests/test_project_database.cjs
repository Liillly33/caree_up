const {PGlite}=require('@electric-sql/pglite');const fs=require('fs'),assert=require('assert/strict');
(async()=>{
 const db=new PGlite();let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA careerup_private;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('app.uid',true),'')::uuid$$;
 CREATE TABLE public."SC_USERS"("USER_ID" integer PRIMARY KEY,"AUTH_USER_ID" uuid);
 CREATE TABLE public."SC_PJT"("PJT_ID" integer PRIMARY KEY);
 CREATE TABLE public."SC_CAREER_ROADMAP"("ROAD_ID" integer PRIMARY KEY,"USER_ID" integer,"PJT_ID" integer REFERENCES public."SC_PJT","ROAD_DATE" timestamptz);
 INSERT INTO public."SC_PJT" VALUES(1),(2);
 INSERT INTO public."SC_USERS" VALUES(1,'11111111-1111-1111-1111-111111111111'),(2,'22222222-2222-2222-2222-222222222222');
 INSERT INTO public."SC_CAREER_ROADMAP" VALUES(1,1,NULL,'2026-01-01'),(2,2,NULL,'2026-01-01');
 ALTER TABLE public."SC_CAREER_ROADMAP" ENABLE ROW LEVEL SECURITY;
 CREATE POLICY own_read ON public."SC_CAREER_ROADMAP" FOR SELECT TO authenticated USING("USER_ID" IN(SELECT "USER_ID" FROM public."SC_USERS" WHERE "AUTH_USER_ID"=auth.uid()));
 GRANT USAGE ON SCHEMA auth,careerup_private TO authenticated;
 GRANT SELECT ON public."SC_USERS",public."SC_CAREER_ROADMAP",public."SC_PJT" TO authenticated;`);
 const sql=fs.readFileSync(require('path').join(__dirname,'../sql/006_project_curriculum.sql'),'utf8');await db.exec(sql);await db.exec(sql);
 const snap=(id=1)=>({basis_hash:'a'.repeat(64),recommendations:[{project_id:id,reason:'동시성 제어를 연습할 수 있습니다.'}]});
 const save=async(rid,data)=>(await db.query('select public.save_project_recommendations($1,$2::jsonb) d',[rid,JSON.stringify(data)])).rows[0].d;
 const select=async(rid,pid)=>(await db.query('select public.select_roadmap_project($1,$2) d',[rid,pid])).rows[0].d;
 const read=async(rid)=>(await db.query('select public.get_project_recommendations($1) d',[rid])).rows[0].d;
 await db.exec(`SET ROLE authenticated;SET app.uid='11111111-1111-1111-1111-111111111111'`);
 eq(await read(1),{curriculum:null,selected_project_id:null});eq(await read(2),null);
 await save(1,snap());eq((await read(1)).selected_project_id,null);
 eq((await select(1,1)).selected_project_id,1);
 await save(1,snap(2));eq((await read(1)).selected_project_id,1);
 eq((await select(1,2)).selected_project_id,2);
 for(const invalid of [null,{}, {basis_hash:'a'.repeat(64),recommendations:{}},{basis_hash:'x',recommendations:[]},
  {basis_hash:'a'.repeat(64),recommendations:[...snap().recommendations,...snap(2).recommendations]},snap(999),
  {basis_hash:'a'.repeat(64),recommendations:[{project_id:'1',reason:'x'}]},
  {basis_hash:'a'.repeat(64),recommendations:[{project_id:1,reason:''}]}]){
  await assert.rejects(save(1,invalid));checks++;
 }
 await assert.rejects(save(2,snap()),/본인의/);checks++;
 await assert.rejects(select(2,1),/본인의/);checks++;
 await assert.rejects(select(1,1),/현재 추천/);checks++;
 await assert.rejects(db.exec(`UPDATE public."SC_CAREER_ROADMAP" SET "PJT_ID"=1 WHERE "ROAD_ID"=1`),/permission denied/);checks++;
 await db.exec(`RESET ROLE;INSERT INTO public."SC_CAREER_ROADMAP" VALUES(3,1,NULL,'2026-02-01');SET ROLE authenticated;`);
 await assert.rejects(save(1,snap()),/변경/);checks++;
 await assert.rejects(select(1,2),/변경/);checks++;
 await save(3,snap());eq((await select(3,1)).selected_project_id,1);
 await db.exec(`SET app.uid=''`);await assert.rejects(save(3,snap()),/로그인/);checks++;
 await db.exec(`RESET ROLE;SET ROLE anon`);await assert.rejects(read(3),/permission denied/);checks++;
 console.log(JSON.stringify({database:'PASS',checks}));await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
