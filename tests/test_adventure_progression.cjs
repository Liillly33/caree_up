// Optional SQL regression test: install @electric-sql/pglite in a separate test environment.
const {PGlite}=require('@electric-sql/pglite');
const fs=require('fs'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'..');
(async()=>{
 const db=new PGlite();let checks=0;
 const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;CREATE SCHEMA extensions;CREATE SCHEMA careerup_private;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('app.uid',true),'')::uuid$$;
 CREATE FUNCTION extensions.gen_salt(text) RETURNS text LANGUAGE sql AS $$SELECT 'salt'::text$$;
 CREATE FUNCTION extensions.crypt(text,text) RETURNS text LANGUAGE sql AS $$SELECT 'hash-'||$1$$;
 CREATE TABLE public."SC_USERS"("USER_ID" integer PRIMARY KEY,"AUTH_USER_ID" uuid);
 CREATE TABLE public."SC_CAREER_ROADMAP"("ROAD_ID" integer PRIMARY KEY,"USER_ID" integer,"LC_ID" integer,"ROAD_DATE" timestamptz DEFAULT now());
 CREATE TABLE public."SC_LC"("LC_ID" serial PRIMARY KEY);
 CREATE TABLE public."SC_SPEC_INFO"("USER_ID" integer PRIMARY KEY,"SPEC_LICENSES" json);
 INSERT INTO public."SC_USERS" VALUES(1,'11111111-1111-1111-1111-111111111111'),(2,'22222222-2222-2222-2222-222222222222');
 INSERT INTO public."SC_CAREER_ROADMAP"("ROAD_ID","USER_ID") VALUES(1,1);
 `);
 await db.exec(fs.readFileSync(root+'/sql/003_certificate_adventure.sql','utf8'));
 await db.exec(fs.readFileSync(root+'/sql/004_adventure_exp_scene.sql','utf8'));
 const rpc=async(action='get',args={})=>(await db.query('SELECT careerup_private.certificate_adventure($1,$2::jsonb) AS data',[action,JSON.stringify(args)])).rows[0].data;
 const fail=async(action,args,pattern)=>{await assert.rejects(rpc(action,args),pattern);checks++};
 await fail('get',{},/로그인/);
 await db.exec(`SET app.uid='11111111-1111-1111-1111-111111111111'`);
 eq((await rpc()).adventure,null);
 await rpc('start');await rpc('test_reset',{date:'2026-01-20',time:'06:00'});
 let r=await rpc();eq(r.adventure.state.exp,0);eq(r.adventure.monster,'daily');eq(r.adventure.max_level,null);
 r=await rpc('toggle',{id:'written'});eq(r.adventure.state.exp,70);eq(r.adventure.monster,null);eq(r.adventure.state.level,1);
 r=await rpc('toggle',{id:'u-daily-review'});eq(r.adventure.state.exp,0);eq(r.adventure.state.level,2);eq(r.leveled_up,true);
 // Seven additional daily quests add 210 EXP, two more levels in this SAME day.
 for(let i=0;i<7;i++){await rpc('add',{text:'일퀘'+i});const id=(await rpc()).adventure.state.custom.at(-1).id;r=await rpc('toggle',{id})}
 eq(r.adventure.state.level,4);eq(r.adventure.state.exp,10);
 await rpc('toggle',{id:'u-daily-review'});r=await rpc('toggle',{id:'u-daily-review'});eq(r.adventure.state.level,4);eq(r.adventure.state.exp,10);
 await rpc('edit',{id:'u-daily-review',text:'바꾼 목표'});r=await rpc('toggle',{id:'u-daily-review'});eq(r.adventure.state.exp,10);
 await fail('delete',{id:'written'},/고정/);await fail('toggle',{id:'unknown'},/찾을 수/);
 r=await rpc('test_on',{date:'2026-01-21',time:'05:59'});eq(r.adventure.state.exp,10);eq(r.adventure.quest_day,'2026-01-20');
 r=await rpc('test_on',{date:'2026-01-21',time:'06:00'});eq(r.adventure.state.exp,10);eq(r.adventure.monster,'daily');eq(r.adventure.state.done,{});
 r=await rpc('toggle',{id:'u-daily-review'});eq(r.adventure.state.exp,40);eq(r.adventure.monster,'daily');
 r=await rpc('test_on',{date:'2026-01-30',time:'12:00'});eq(r.adventure.monster,'written');eq(r.adventure.state.main_goal.text,'필기시험 완료');eq(r.adventure.state.main_goal.milestone,'written');
 await fail('toggle',{id:'written'},/완료 확인/);await fail('boss',{stage:'written',password:'bad'},/비밀번호/);
 r=await rpc('boss',{stage:'written',password:'0130'});eq(r.milestone_level_reward,40);eq(r.levels_gained,41);eq(r.adventure.promotion_levels,[40,80]);eq(r.adventure.monster,null);eq(r.adventure.state.done.written,true);eq(!!r.adventure.state.written_at,true);eq(r.adventure.state.exp,10);eq(r.adventure.state.level,45);
 r=await rpc('boss',{stage:'written',password:'0130'});eq(r.adventure.state.level,45);eq(r.adventure.state.exp,10);
 r=await rpc('test_on',{date:'2026-04-18'});eq(r.adventure.monster,'practical');eq(r.adventure.state.main_goal.text,'실기시험 완료');
 r=await rpc('boss',{stage:'practical',password:'0418'});eq(r.milestone_level_reward,40);eq(r.adventure.state.level,85);eq(r.adventure.state.done.practical,true);eq(!!r.adventure.state.practical_at,true);eq(r.adventure.state.exp,80);
 r=await rpc('test_on',{date:'2026-06-05'});eq(r.adventure.monster,'final');eq(r.adventure.state.main_goal.id,'final');eq(r.adventure.state.main_goal.milestone,'final');
 await fail('toggle',{id:'final'},/완료 확인/);
 r=await rpc('boss',{stage:'final'});eq(r.adventure.monster,null);eq(r.milestone_level_reward,40);eq(r.quest_reward,70);eq(r.adventure.state.level,126);eq(r.adventure.state.exp,50);eq(r.adventure.state.done.final,true);
 r=await rpc('boss',{stage:'final'});eq(r.adventure.state.level,126);eq(r.adventure.state.exp,50);eq(r.milestone_level_reward,0);
 // User schedule changes immediately affect quests and enemies; preserve completion and rewards.
 r=await rpc('dates',{written:'2026-02-01',practical:'2026-05-01',result:'2026-07-01'});eq(r.adventure.written_date,'2026-02-01');eq(r.adventure.result_date,'2026-07-01');eq(r.adventure.state.level,126);
 await fail('dates',{written:'2026-08-01',practical:'2026-05-01',result:'2026-07-01'},/순서/);
 await rpc('test_reset',{date:'2026-02-01'});r=await rpc();eq(r.adventure.monster,'written');eq(r.adventure.state.main_goal.milestone,'written');
 r=await rpc('test_on',{date:'2026-05-01'});eq(r.adventure.monster,'practical');eq(r.adventure.state.main_goal.milestone,'practical');
 r=await rpc('test_on',{date:'2026-07-01'});eq(r.adventure.monster,'final');eq(r.adventure.state.main_goal.milestone,'final');
 // Restore dates for the remaining boundary tests.
 await rpc('dates',{written:'2026-01-30',practical:'2026-04-18',result:'2026-06-05'});
 eq((await db.query('SELECT count(*)::int AS n FROM public."SC_SPEC_INFO"')).rows[0].n,0);
 r=await rpc('test_off');eq(r.adventure.state.level,1);eq(r.adventure.state.exp,0);eq(r.adventure.test_mode,false);
 // Cross the former 150 limit, then level again on the same day.
 await db.exec(`UPDATE public."SC_USER_ADVENTURE" SET "TEST_DATE"='2026-01-21',"TEST_STATE"='{"level":150,"exp":90,"reward_policy":2,"rewarded":{},"custom":[{"id":"one","text":"x"}],"done":{},"day":"","awarded":[],"test_time":"12:00"}'`);
 r=await rpc('toggle',{id:'one'});eq(r.adventure.state.level,151);eq(r.adventure.state.exp,20);
 await rpc('toggle',{id:'written'});await rpc('add',{text:'another'});const id=(await rpc()).adventure.state.custom.at(-1).id;r=await rpc('toggle',{id});eq(r.adventure.state.level,152);eq(r.adventure.state.exp,20);
 // Previously cleared milestones receive missing +40 bonuses once; GET/reload cannot repeat them.
 await db.exec(`UPDATE public."SC_USER_ADVENTURE" SET "TEST_DATE"='2026-05-01',"TEST_STATE"='{"level":10,"exp":20,"reward_policy":2,"rewarded":{},"custom":[],"done":{},"written_at":"done","day":"","test_time":"12:00"}'`);
 r=await rpc();eq(r.adventure.state.level,50);eq(r.adventure.state.milestone_rewards.written,40);r=await rpc();eq(r.adventure.state.level,50);
 await db.exec(`UPDATE public."SC_USER_ADVENTURE" SET "TEST_STATE"="TEST_STATE"||'{"practical_at":"done"}'::jsonb`);
 r=await rpc();eq(r.adventure.state.level,90);r=await rpc();eq(r.adventure.state.level,90);
 await db.exec(`UPDATE public."SC_USER_ADVENTURE" SET "TEST_STATE"="TEST_STATE"||'{"final_at":"done"}'::jsonb`);
 r=await rpc();eq(r.adventure.state.level,130);eq(r.adventure.state.milestone_rewards.final,40);r=await rpc();eq(r.adventure.state.level,130);
 await rpc('test_off');
 // Real-state final completion uses the same quest/reward transaction and adds the license once.
 await rpc('dates',{written:'2000-01-01',practical:'2000-01-02',result:'2000-01-03'});
 await rpc('boss',{stage:'written',password:'0130'});await rpc('boss',{stage:'practical',password:'0418'});
 r=await rpc('boss',{stage:'final'});eq(r.adventure.test_mode,false);eq(r.milestone_level_reward,40);eq(r.quest_reward,70);eq(r.adventure.state.done.final,true);eq(r.adventure.state.level,121);
 eq((await db.query('SELECT "SPEC_LICENSES" AS licenses FROM public."SC_SPEC_INFO" WHERE "USER_ID"=1')).rows[0].licenses,['정보처리기사']);
 r=await rpc('boss',{stage:'final'});eq(r.milestone_level_reward,0);eq(r.adventure.state.level,121);
 await db.exec(`SET app.uid='22222222-2222-2222-2222-222222222222'`);eq((await rpc()).adventure,null);await fail('toggle',{id:'written'},/먼저/);
 await assert.rejects(db.exec(`UPDATE public."SC_LC" SET "MID_GOALS"='[{},{},{},{}]'`),/sc_lc_mid_goals_max_three/);checks++;
 console.log(JSON.stringify({checks,sql:'PASS'}));await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
