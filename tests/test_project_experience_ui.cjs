const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),vc=new VirtualConsole(),errors=[];vc.on('jsdomError',e=>errors.push(e.message));
let spec=null,prefs=[],lastPayload=null,selects=[],fail=false,checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const account={id:'test-auth'};
const client={auth:{onAuthStateChange(){},getUser:async()=>({data:{user:account}}),getSession:async()=>({data:{session:null}})},
 from(table){const q={select(columns){selects.push([table,columns]);return this},eq(){return this},order(){return this},async single(){return {data:{USER_ID:6}}},async maybeSingle(){return {data:spec}},then(resolve){resolve({data:table==='SC_JOB_CLASSIFICATION'?[{JOB_CODE:'BE',JOB_NAME:'백엔드/서버개발'}]:prefs})}};return q},
 async rpc(name,p){eq(name,'save_user_spec');lastPayload=p;if(fail)return {error:{message:'저장 거절'}};spec={SPEC_GRADE:p.p_grade,SPEC_GPA:p.p_gpa,SPEC_TECH_SKILL:p.p_tech_skill,SPEC_LICENSES:p.p_licenses,SPEC_PROJECT_EXPERIENCE:p.p_project_experience};prefs=p.p_job_codes.map((code,i)=>({JOB_CODE:code,PRFD_RANK:i+1}));return {data:{saved:true,user_id:6}}}
};
const dom=new JSDOM(fs.readFileSync(root+'/web/index.html','utf8'),{url:'http://localhost:8000',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window,d=w.document;
const gradient={addColorStop(){}};const ctx=new Proxy({createLinearGradient(){return gradient},createRadialGradient(){return gradient}},{get(o,p){return p in o?o[p]:()=>{}},set(o,p,v){o[p]=v;return true}});
w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.HTMLElement.prototype.getClientRects=()=>[{}];w.HTMLElement.prototype.scrollIntoView=function(){};
w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
w.tailwind={};w.lucide={createIcons(){}};w.supabase={createClient:()=>client};w.fetch=async()=>({ok:true,json:async()=>({roadmap:null,adventure:null})});
w.eval([...d.querySelectorAll('script:not([src])')].map(s=>s.textContent).join('\n'));
const tick=()=>new Promise(r=>setTimeout(r,20));
(async()=>{
 await tick();w.loadCurrentRoadmap=async()=>{};w.loadCertificateAdventure=async()=>{};
 eq(d.querySelector('label[for="input-project-experience"]').textContent,'프로젝트에서 맡은 역할을 한 문장으로 적어주세요.(프로젝트 경험 없을 시 미기재)');
 eq(d.getElementById('input-stack-help').textContent.includes('프로젝트에서 사용한 기술 스택도 빠짐없이'),true);eq(d.getElementById('survey-stack-help').textContent.includes('프로젝트에서 사용한 기술 스택도 빠짐없이'),true);
 await w.loadMyPageData(account);eq(d.getElementById('spec-survey').open,true);
 w.nextSurveyStep();d.getElementById('survey-grade').value='3';w.nextSurveyStep();d.getElementById('survey-gpa').value='3.8';w.nextSurveyStep();d.getElementById('survey-stack').value='Python, Docker';w.nextSurveyStep();
 eq(d.querySelector('[data-survey-step="3"]').hidden,false);eq(d.getElementById('survey-progress').textContent,'4 / 6');
 // Project experience is optional and the user can return to fill it.
 w.nextSurveyStep();eq(d.querySelector('[data-survey-step="4"]').hidden,false);w.previousSurveyStep();
 const text='FastAPI로 API를 구현하고, Docker로 배포했습니다.\n<img src=x> 문자열을 검증했습니다.';
 d.getElementById('survey-project-experience').value=text;w.nextSurveyStep();w.nextSurveyStep();
 const job=d.querySelector('#survey-job-options input');job.checked=true;job.dispatchEvent(new w.Event('change'));w.nextSurveyStep();
 eq(d.getElementById('survey-review-project-experience').textContent,text);eq(d.querySelector('#survey-review-project-experience img'),null);
 await w.finishSpecSurvey(false);eq(d.getElementById('spec-survey').open,false);eq(lastPayload.p_project_experience,text);eq(Array.from(lastPayload.p_tech_skill),['Python','Docker']);
 await w.loadMyPageData(account);eq(d.getElementById('input-project-experience').value,text);eq(selects.some(([t,c])=>t==='SC_SPEC_INFO'&&c.includes('SPEC_PROJECT_EXPERIENCE')),true);
 const completion='Spring Boot · 예매 서버: Redis 분산 락으로 동시성 제어를 구현했습니다.';
 w.syncCompletedAdventureSpec({kind:'project',state:{final_at:'done'}},completion);w.syncCompletedAdventureSpec({kind:'project',state:{final_at:'done'}},completion);
 eq(d.getElementById('input-project-experience').value,text+'\n'+completion);eq(d.getElementById('input-stack').value,'Python, Docker');
 await w.saveMyPageInfo();eq(lastPayload.p_project_experience,text+'\n'+completion);
 d.getElementById('input-project-experience').value='';await w.saveMyPageInfo();eq(lastPayload.p_project_experience,null);await w.loadMyPageData(account);eq(d.getElementById('input-project-experience').value,'');
 fail=true;d.getElementById('input-project-experience').value='失敗';eq(await w.saveMyPageInfo(),undefined);eq(d.getElementById('mypage-status').textContent.includes('저장 실패'),true);fail=false;
 eq(w.hasSpecInformation({SPEC_PROJECT_EXPERIENCE:'프로젝트 역할'}),true);eq(w.hasSpecInformation({SPEC_PROJECT_EXPERIENCE:'   '}),false);
 w.clearMyPageState();eq(d.getElementById('input-project-experience').value,'');eq(errors,[]);
 console.log(JSON.stringify({project_experience_ui:'PASS',checks}));w.close();
})().catch(e=>{console.error(e);w.close();process.exit(1)});
