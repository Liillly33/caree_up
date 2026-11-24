const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..'),vc=new VirtualConsole(),errors=[];vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(root+'/web/index.html','utf8'),{url:'http://localhost:8000',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,d=w.document;
const gradient={addColorStop(){}};const ctx=new Proxy({createLinearGradient(){return gradient},createRadialGradient(){return gradient}},{get(o,p){return p in o?o[p]:()=>{}},set(o,p,v){o[p]=v;return true}});
w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.HTMLElement.prototype.getClientRects=()=>[{}];w.HTMLElement.prototype.scrollIntoView=function(){};
w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
w.tailwind={};w.lucide={createIcons(){}};
w.supabase={createClient:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{access_token:'valid'}}})}})};
w.fetch=async()=>({ok:true,json:async()=>({adventure:null})});
w.eval([...d.querySelectorAll('script:not([src])')].map(s=>s.textContent).join('\n')+'\nwindow.projectTestState=()=>({curriculum:projectCurriculum,selected:projectSelected});window.setDemoReport=x=>{certificateReport=x};');
const cat=JSON.parse(fs.readFileSync(root+'/data/project_catalog_snapshot.json','utf8'));
const item=id=>{const p=cat.find(x=>x.PJT_ID===id);return {project_id:id,project_name:p.PJT_NAME,total_days:p.PJT_TOTAL_DAYS,mid_goals:p.PJT_MID_GOALS,final_goal:p.PJT_FINAL_GOAL,reason:'Spring 기술로 Redis 동시성 제어를 연습할 수 있습니다.',gap:'Redis 동시성 제어 보완'}};
const body=(id=1,selected=null)=>({road_id:1,curriculum:{recommendations:[item(id)]},selected_project:selected});
const road={road_id:1,job_id:1,title:'백엔드 개발',company:'회사',job_code:'BE',score_100:80,strong:'Java 역량',weak:'Redis 동시성 제어 보완'};
const license={recommendations:[{certificate_name:'SQL 개발자',reason:'SQL 기초를 보완합니다.',rounds:[]}]};
const tick=()=>new Promise(r=>setTimeout(r,30));let checks=0,calls=[];const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
(async()=>{
 await tick();w.renderCurrentRoadmap(road,license,undefined,body());await tick();
 const target={kind:'project',project_id:1};
 const run='11111111-2222-3333-4444-555555555555';
 const active={kind:'certificate',run_id:run,road_id:1,state:{level:42,exp:70},restart_requires_password:true};
 let starts=0,requests=[],current={adventure:active};
 const started={adventure_revision:7,adventure:{kind:'project',route:'mage',project_id:1,run_id:'new-run',road_id:1,name:item(1).project_name,final_goal:item(1).final_goal,mid_goals:[{id:'written',title:'API 구현',daily:'API 코드 작성'},{id:'practical',title:'락 적용',daily:'동시성 테스트'}],written_date:'2026-03-01',practical_date:'2026-03-20',result_date:'2026-03-27',today:'2026-02-01',real_today:'2026-11-06',quest_day:'2026-02-01',clock_time:'12:00',test_mode:true,monster:'daily',restart_requires_password:true,state:{level:1,exp:0,done:{},custom:[],rewarded:{},main_goal:{id:'written',text:'API 코드 작성'}}}};
 w.fetch=async(url,opt={})=>{
  if(url==='/api/adventure')return {ok:true,json:async()=>structuredClone(current)};
  if(url==='/api/adventure/start'){
   starts++;const request=JSON.parse(opt.body);requests.push(request);
   if(request.password!=='correct')return {ok:false,json:async()=>({detail:'비밀번호가 올바르지 않습니다.'})};
   current=structuredClone(started);return {ok:true,json:async()=>structuredClone(started)};
  }
  throw Error(url);
 };
 let pending=w.beginAdventure(target);await tick();
 eq(d.getElementById('adventure-restart-dialog').open,true);
 eq(d.getElementById('adventure-restart-title').textContent,'이미 진행중인 커리업 어드벤처가 있어요!');
 eq(d.querySelector('.adventure-restart-icon').classList.contains('lucide-message-circle-exclamation-point'),true);
 eq(w.getComputedStyle(d.querySelector('.adventure-restart-icon')).width,'76px');
 eq(d.getElementById('adventure-restart-form').hidden,true);eq(starts,0);
 d.getElementById('adventure-restart-no').click();await pending;eq(starts,0);eq(current.adventure.state.level,42);
 pending=w.beginAdventure(target);await tick();d.getElementById('adventure-restart-yes').click();
 eq(d.getElementById('adventure-restart-warning').hidden,true);eq(d.getElementById('adventure-restart-form').hidden,false);
 const form=d.getElementById('adventure-restart-form'),password=d.getElementById('adventure-restart-password');
 password.value='wrong';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
 eq(d.getElementById('adventure-restart-dialog').open,true);eq(d.getElementById('adventure-restart-error').textContent,'비밀번호가 올바르지 않습니다.');eq(current.adventure.state.level,42);eq(password.value,'');
 password.value='correct';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await pending;await tick();
 eq(d.getElementById('adventure-restart-dialog').open,false);eq(password.value,'');eq(requests[1].expected_run_id,run);eq(requests[1].project_id,1);
 eq(d.querySelector('.cert-goal-title').textContent,item(1).project_name);eq(d.getElementById('adventure-level').textContent,'Lv. 1');
 eq(d.getElementById('cert-todos').textContent.includes('API 코드 작성'),true);eq(d.getElementById('cert-final-date').textContent.includes('프로젝트 완성'),true);
 eq(d.getElementById('cert-date-presets').textContent.includes('중기목표 1일'),true);eq(d.getElementById('cert-third-label').hidden,true);
 eq(d.getElementById('adventure-class').textContent,'초보 모험가');
 const complete=structuredClone(started);complete.adventure.state.final_at='done';complete.adventure.spec_title='프로젝트: '+item(1).project_name;complete.project_experience_entry=item(1).project_name+': 핵심 기능을 구현했습니다.';complete.project_experience=complete.project_experience_entry;
 w.setDemoReport({road_id:1,score_100:86,explanation:{strengths:[],improvements:[]}});w.receiveCertificate(complete);
 eq(d.getElementById('input-project-experience').value.includes(complete.project_experience_entry),true);eq(d.getElementById('input-stack').value.includes(complete.adventure.spec_title),false);eq(d.getElementById('cert-report').hidden,false);
 const certificate=structuredClone(complete);Object.assign(certificate.adventure,{kind:'certificate',route:'warrior',lc_id:8,certificate_name:'정보처리기사',credential_name:'정보처리기사',qualification_awarded:true});w.receiveCertificate(certificate);
 eq(d.getElementById('input-certificates').value.includes('정보처리기사'),true);
 // A fresh account starts immediately without showing a warning or requesting a password.
 current={adventure:null};w.fetch=async(url,opt={})=>url==='/api/adventure'?{ok:true,json:async()=>current}:{ok:true,json:async()=>{const b=JSON.parse(opt.body);eq(b.password,undefined);return structuredClone(started)}};
 await w.beginAdventure(target);eq(d.getElementById('adventure-restart-dialog').open,false);
 // Logout cancels pending confirmation and clears the password.
 current={adventure:active};w.fetch=async()=>({ok:true,json:async()=>current});pending=w.beginAdventure(target);await tick();
 d.getElementById('adventure-restart-yes').click();password.value='do-not-retain';w.resetCurrentRoadmap();await pending;
 eq(password.value,'');eq(d.getElementById('adventure-restart-dialog').open,false);eq(password.disabled,false);
 eq(errors,[]);console.log(JSON.stringify({project_adventure_ui:'PASS',checks}));w.close();
})().catch(e=>{console.error(e);w.close();process.exit(1)});
