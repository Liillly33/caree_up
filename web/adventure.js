// Server-authoritative certificate adventure. Test progress is isolated from the real state.
let certPendingTestClock=null;
let certCalendarMonth=null,certAuraUntil=0,certCombatMonster=null,certCombatTimers=[],certCombatFlights=new Set();
let certificateData=null,certificateReport=null,certEpoch=0,certRequest=0,certAbort=null,certBusy=false,certBossStage=null,certCelebrationTimer=null;
function certEl(id){return document.getElementById(id);}
function resetCertificateAdventure(){
    if(typeof resetAdventureStart==='function')resetAdventureStart();
    certPendingTestClock=null;
    if(typeof resetLicenseCurriculum==='function')resetLicenseCurriculum();
    if(typeof resetProjectCurriculum==='function')resetProjectCurriculum();
    clearMainQuestAttack();certAuraUntil=0;certEpoch++;certRequest++;certAbort?.abort();certAbort=null;certBusy=false;certificateData=null;certificateReport=null;certCalendarMonth=null;
    certEl('cert-password').value='';certEl('cert-password-error').textContent='';certEl('cert-drawer-status').textContent='';certEl('cert-add-text').value='';certEl('cert-status').textContent='';certEl('cert-calendar-toggle').hidden=true;for(const id of ['cert-calendar','cert-password-dialog']){const dialog=certEl(id);if(dialog?.open)dialog.close();}
    clearTimeout(certCelebrationTimer);certEl('cert-celebration').hidden=true;renderCertificateAdventure();
}
async function loadCertificateAdventure(){
    if(certBusy)return;certAbort?.abort();const request=++certRequest,epoch=certEpoch,controller=new AbortController();certAbort=controller;
    try{
        const token=await matchingToken();if(epoch!==certEpoch || request!==certRequest)return;
        const data=await matchingResponse(await fetch('/api/adventure',{signal:controller.signal,headers:{Authorization:'Bearer '+token}}));
        if(epoch!==certEpoch || request!==certRequest)return;
        receiveCertificate(data);
    }catch(error){if(epoch===certEpoch && request===certRequest && error.name!=='AbortError')certEl('cert-status').textContent=error.message || '모험을 불러오지 못했습니다.';}
    finally{if(epoch===certEpoch && request===certRequest)certAbort=null;}
}
async function certificateAction(action,args={}){
    if(action==='start')return await beginAdventure({kind:'certificate',lc_id:Number(args.lc_id)});
    if(certBusy)return null;
    if(certPendingTestClock && !['test_on','test_off','test_reset'].includes(action)){certEl('cert-status').textContent='먼저 테스트 날짜를 다시 적용해주세요.';return null;}
    const testClock=action==='start' && certificateData?.adventure?.test_mode?{date:certificateData.adventure.today,time:certificateData.adventure.clock_time || '12:00'}:null;
    const attack=prepareMainQuestAttack(action,args);certBusy=true;certRequest++;certAbort?.abort();const epoch=certEpoch,controller=new AbortController();certAbort=controller;renderCertificateAdventure();
    certEl('cert-status').textContent='저장하고 있습니다…';certEl('cert-password-error').textContent='';certEl('cert-drawer-status').textContent='';
    try{
        const token=await matchingToken();if(epoch!==certEpoch)return null;
        let data=await matchingResponse(await fetch('/api/adventure',{method:'POST',signal:controller.signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,args})}));
        if(epoch!==certEpoch)return null;
        if(testClock && (!data.adventure?.test_mode || data.adventure.today!==testClock.date || data.adventure.clock_time!==testClock.time)){
            certPendingTestClock=testClock;
            try{
                data=await matchingResponse(await fetch('/api/adventure',{method:'POST',signal:controller.signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'test_on',args:testClock})}));
                if(epoch!==certEpoch)return null;
                certPendingTestClock=null;
            }catch(error){
                if(epoch!==certEpoch || error.name==='AbortError')return null;
                receiveCertificate(data);
                certEl('cert-status').textContent='회차는 선택됐지만 테스트 날짜 적용에 실패했습니다. 다시 적용한 뒤 진행해주세요.';
                const retry=document.createElement('button');retry.type='button';retry.className='cert-clock-retry';retry.textContent='테스트 날짜 다시 적용';retry.addEventListener('click',()=>void certificateAction('test_on',certPendingTestClock || testClock));certEl('cert-status').append(' ',retry);return null;
            }
        }
        if(['test_on','test_off','test_reset'].includes(action))certPendingTestClock=null;
        if(attack){certCombatMonster=attack.monster;playMainQuestAttack(attack);}
        receiveCertificate(data);
        if(data.leveled_up){certAuraUntil=Date.now()+3000;window.CareerupCharacter?.update(certificateSceneData());const auraEpoch=certEpoch;setTimeout(()=>{if(auraEpoch===certEpoch)window.CareerupCharacter?.update(certificateSceneData());},3100);}
        if(data.leveled_up)celebrateCertificate('레벨 업!',`100 EXP 달성 · Lv. ${data.adventure.state.level}`);
        if(action==='boss'){
            const stage=args.stage;
            const a=data.adventure,name=a.certificate_name || a.name;
            const finalText=a.kind==='project'?'프로젝트 완성을 축하합니다! 완료한 핵심 내용을 프로젝트 경험에 반영했습니다.':a.qualification_awarded?name+' 합격을 축하합니다! 보유 자격증에 반영했습니다.':name+' 1차 합격을 기록했습니다. 최종 자격증 취득은 다음 차수 합격 후 반영됩니다.';
            celebrateCertificate(stage==='final'?'보스 토벌 완료!':'중간보스 토벌!',(stage==='final'?finalText:a.kind==='project'?'중기목표 완료':'시험 완료')+(data.milestone_level_reward?' · +40 레벨!':''));

        }
        return data;
    }catch(error){if(epoch===certEpoch && error.name!=='AbortError'){const message=error.message || '모험 저장에 실패했습니다.';certEl('cert-status').textContent=message;certEl('cert-password-error').textContent=message;certEl('cert-drawer-status').textContent=message;}return null;}
    finally{if(epoch===certEpoch){certBusy=false;certAbort=null;renderCertificateAdventure();}}
}
function syncCompletedAdventureSpec(a,projectEntry){
    if(!a?.state?.final_at)return;
    if(a.kind==='project'){
        const input=certEl('input-project-experience');
        if(!input || !projectEntry)return;
        const entries=input.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
        if(!entries.includes(projectEntry.trim()))input.value=[input.value.trim(),projectEntry.trim()].filter(Boolean).join('\n');
    }else if(a.qualification_awarded){
        const input=certEl('input-certificates'),entry=a.credential_name || a.certificate_name || a.name;
        const values=input.value.split(',').map(x=>x.trim()).filter(Boolean);
        if(!values.includes(entry))input.value=[...values,entry].join(', ');
    }
}
function receiveCertificate(data){
    certificateData=data;
    const storedEntry=typeof data.project_experience==='string' && data.project_experience.split(/\r?\n/).some(line=>line.trim()===data.project_experience_entry?.trim())?data.project_experience_entry:null;
    syncCompletedAdventureSpec(data.adventure,storedEntry);if(data.adventure)certCalendarMonth=data.adventure.today.slice(0,7);certEl('cert-status').textContent='';certEl('cert-calendar-toggle').hidden=false;
    if(data.report_pending)certificateReport=null;
    if(data.match_report){certificateReport=data.match_report;if(currentRoadmap?.road_id===certificateReport.road_id)renderCurrentRoadmap(currentRoadmap);}
    renderCertificateAdventure();
}
function certDateDiff(end,start){return Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000);}
function prepareMainQuestAttack(action,args){
    const a=certificateData?.adventure,main=a?.state.main_goal;
    if(!main || !a.monster || Object.hasOwn(a.state.rewarded?.[a.quest_day || a.today] || {},main.id))return null;
    const completes=action==='toggle' && args.id===main.id && !a.state.done[main.id] || action==='boss' && args.stage===main.id && !a.state[args.stage+'_at'];
    if(!completes)return null;
    const row=[...certEl('cert-todos').children].find(el=>el.dataset.goalId===main.id),canvas=certEl('cert-character-canvas');
    if(!row || !canvas)return null;
    const source=row.getBoundingClientRect(),target=canvas.getBoundingClientRect();
    if(!source.width || !target.width)return null;
    return {node:row.cloneNode(true),source,target,monster:a.monster,epoch:certEpoch};
}
function clearMainQuestAttack(){
    certCombatTimers.forEach(clearTimeout);certCombatTimers=[];
    for(const el of certCombatFlights){el.getAnimations?.().forEach(a=>a.cancel());el.remove();}
    certCombatFlights.clear();certCombatMonster=null;certEl('cert-character-canvas')?.parentElement.classList.remove('cert-impact');
}
function playMainQuestAttack(attack){
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const impact=()=>{
        if(attack.epoch!==certEpoch)return;
        window.CareerupCharacter?.hit(attack.monster);
        const scene=certEl('cert-character-canvas').parentElement;scene.classList.add('cert-impact');
        certCombatTimers.push(setTimeout(()=>{if(attack.epoch!==certEpoch)return;scene.classList.remove('cert-impact');certCombatMonster=null;window.CareerupCharacter?.update(certificateSceneData());},650));
    };
    if(reduced || !attack.node.animate){impact();return;}
    const flight=attack.node;flight.className='cert-quest-projectile';flight.setAttribute('aria-hidden','true');flight.removeAttribute('id');flight.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
    flight.querySelectorAll('input,button').forEach(el=>{el.disabled=true;el.tabIndex=-1;});
    const {source,target}=attack,dx=target.left+target.width*.78-source.left-source.width/2,dy=target.top+target.height*.65-source.top-source.height/2;
    Object.assign(flight.style,{left:source.left+'px',top:source.top+'px',width:source.width+'px',height:source.height+'px'});
    document.body.append(flight);certCombatFlights.add(flight);
    const anim=flight.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${dx*.45}px,${dy*.45-65}px) scale(.65) rotate(-10deg)`,opacity:1,offset:.5},{transform:`translate(${dx}px,${dy}px) scale(.12) rotate(-24deg)`,opacity:.8}],{duration:720,easing:'cubic-bezier(.35,0,.75,.5)',fill:'forwards'});
    anim.onfinish=()=>{flight.remove();certCombatFlights.delete(flight);impact();};
}
function certGoals(a){const main=a.state.main_goal;return [...(main?[{...main,fixed:true,main:true}]:[]),...(a.state.custom || []).map(g=>({...g,main:false}))];}
function certificateSceneData(){
    const a=certificateData?.adventure;
    return a?{level:a.state.level,classNameType:a.route==='priest'?'성직자':a.route==='mage'?'마법사':'전사',hour:a.test_mode?Number(a.clock_time?.slice(0,2) ?? 12):undefined,minute:a.test_mode?a.clock_time?.slice(3,5):undefined,monster:certCombatMonster ?? a.monster,showLevelUpAura:Date.now()<certAuraUntil}:{};
}
function renderCertificateAdventure(){
    const a=certificateData?.adventure;
    certEl('cert-start-empty').hidden=!!a;certEl('cert-active').hidden=!a;certEl('cert-test-label').hidden=!a?.test_mode;
    certEl('cert-todos').replaceChildren();certEl('cert-midgoals').replaceChildren();
    certEl('cert-add-text').disabled=!a || certBusy || !!certPendingTestClock;certEl('cert-add-form').querySelector('button').disabled=!a || certBusy || !!certPendingTestClock;
    certEl('cert-calendar').querySelectorAll('[data-cert-write],input').forEach(el=>el.disabled=!a || certBusy);
    if(!a){
        window.CareerupCharacter?.stop();
        const license=certificateData?.license;
        for(const [id,key] of [['cert-written-date','written_date'],['cert-practical-date','practical_date'],['cert-result-date','result_date']])certEl(id).value=license?.[key] || '';
        certEl('cert-test-date').value='';certEl('cert-real-today').textContent='모험을 시작하면 일정을 수정하고 날짜를 테스트할 수 있습니다.';certEl('cert-date-presets').replaceChildren();certEl('cert-report').replaceChildren();certEl('cert-report').hidden=true;
        certEl('adventure-quest-count').textContent='0 / 0';certEl('cert-day').textContent='모험을 선택하면 오늘의 목표가 표시됩니다.';certEl('cert-final-date').textContent='';renderCertificateCurriculum();return;}
    document.querySelector('.cert-goal-title').textContent=a.certificate_name?(a.certificate_name+(a.phase===1?' 1차 합격':' 취득')):a.name;
    certEl('cert-written-date').closest('label').firstChild.textContent=a.kind==='project'?'중기목표 1일':(a.mid_goals.find(g=>g.id==='written')?.title || '시험 완료').replace('완료','일');
    certEl('cert-practical-date').closest('label').firstChild.textContent=a.kind==='project'?'중기목표 2일':'실기시험일';
    certEl('cert-result-date').closest('label').firstChild.textContent=a.kind==='project'?'프로젝트 최종목표일':'최종 합격발표일';
    certEl('cert-third-label').hidden=!a.mid_goals.some(g=>g.id==='third');certEl('cert-third-date').required=!!a.third_date;
    certEl('cert-practical-date').closest('label').hidden=!a.mid_goals.some(g=>g.id==='practical');certEl('cert-practical-date').required=!!a.practical_date;
    certEl('cert-dates-form').querySelector('h3').textContent=a.kind==='project'?'내 프로젝트 일정':'내 시험 일정';certEl('cert-dates-form').querySelector('button').textContent='일정 저장';
    const s=a.state,stage=s.level>=80?2:s.level>=40?1:0;
    const tier=s.level>=150?4:s.level>=80?3:s.level>=40?2:1;
    window.CareerupCharacter?.update(certificateSceneData());
    certEl('adventure-level').textContent=`Lv. ${s.level}`;certEl('adventure-class').textContent=(a.kind==='project'?['초보 모험가','견습마법사','마법사']:['초보 모험가','견습전사','전사'])[stage];
    certEl('cert-evolution').textContent=(a.kind==='project'?['견습 마법사','정식 마법사','대마법사','현자']:['견습 기사','정식 기사','성기사','국왕'])[tier-1]+' · '+tier+' Tier';
    const exp=Math.min(100,s.exp || 0);certEl('cert-exp-value').textContent=`${exp} / 100 EXP`;certEl('cert-exp-fill').style.width=exp+'%';certEl('cert-exp').setAttribute('aria-valuenow',String(exp));
    certEl('adventure-job-stage').textContent=s.final_at?'모험등급 · '+(a.kind==='project'?'프로젝트 정복자':(a.certificate_name || a.name)+' 정복자'):stage?`${stage}차 전직 완료`:'전직 준비';
    const days=certDateDiff(a.result_date,a.today);certEl('adventure-dDay').textContent=days===0?'D-DAY':days>0?`D-${days}`:`D+${-days}`;
    certEl('cert-test-label').textContent=`날짜 테스트 · ${a.today}`;
    certEl('cert-day').textContent=`${a.quest_day || a.today} · 오전 6시 초기화${a.test_mode?' · 테스트 기록':''}`;
    const goals=certGoals(a),done=goals.filter(g=>s.done[g.id]).length;certEl('adventure-quest-count').textContent=`${done} / ${goals.length}`;certEl('cert-top-count').textContent=`${done} / ${goals.length}`;
    certEl('cert-daily-note').textContent='100 EXP당 레벨업 · 횟수·레벨 제한 없음 · 메인 +70 / 일일 하나당 +30 EXP';
    for(const goal of goals){
        const row=document.createElement('div');row.dataset.goalId=goal.id;row.className='cert-todo'+(goal.main?' main':'')+(s.done[goal.id]?' done':'');
        const check=document.createElement('input');check.type='checkbox';check.checked=!!s.done[goal.id];check.disabled=certBusy || !!certPendingTestClock || !!(goal.milestone && s[goal.id+'_at']);check.setAttribute('aria-label',goal.text+' 완료');check.addEventListener('change',()=>{if(goal.milestone){check.checked=!!s.done[goal.id];openCertificateBoss(goal.milestone);}else void certificateAction('toggle',{id:goal.id});});row.append(check);
        if(goal.fixed){const text=document.createElement('span');text.className='cert-todo-text';text.textContent=goal.text;const fixed=document.createElement('small');fixed.textContent='메인 · 고정';row.append(text,fixed);}
        else{const input=document.createElement('input');input.className='cert-todo-text';input.value=goal.text;input.maxLength=200;input.disabled=certBusy || !!certPendingTestClock;input.setAttribute('aria-label','사용자 일일목표 수정');input.addEventListener('change',()=>void certificateAction('edit',{id:goal.id,text:input.value}));const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.disabled=certBusy || !!certPendingTestClock;remove.setAttribute('aria-label','사용자 일일목표 삭제');remove.addEventListener('click',()=>void certificateAction('delete',{id:goal.id}));row.append(input,remove);}
        const reward=document.createElement('small');reward.className='cert-reward';reward.textContent=goal.main?'+70 EXP':'+30 EXP';row.append(reward);
        certEl('cert-todos').append(row);
    }
    for(const goal of a.mid_goals){
        const date=goal.id==='written'?a.written_date:goal.id==='third'?a.third_date:a.practical_date,completed=!!s[goal.id+'_at'],available=a.today>=date && a.mid_goals.slice(0,a.mid_goals.indexOf(goal)).every(g=>!!s[g.id+'_at']);
        const button=document.createElement('button');button.type='button';button.className='cert-mid'+(completed?' completed':'');button.disabled=certBusy || !!certPendingTestClock || completed || !available;
        const title=document.createElement('strong');title.textContent=`${completed?'✓ ':available?'👾 ':'🔒 '}${goal.title}`;
        const note=document.createElement('small');note.textContent=`${date} · ${completed?'토벌 완료':available?'중간보스 등장 · 클릭하여 완료 확인':a.kind==='project'?'목표일에 중간보스가 등장합니다':'시험일에 중간보스가 등장합니다'}`;button.append(title,note);button.addEventListener('click',()=>openCertificateBoss(goal.id));
        const row=document.createElement('div');row.className='cert-mid-row';
        const edit=document.createElement('button');edit.type='button';edit.className='cert-date-edit';edit.textContent='날짜 변경';edit.disabled=certBusy;edit.setAttribute('aria-label',goal.title+' 날짜 변경');edit.addEventListener('click',()=>editCertificateSchedule(goal.id));row.append(button,edit);certEl('cert-midgoals').append(row);
    }
    const boss=a.monster && a.monster!=='daily'?a.monster:null;
    certEl('cert-boss').hidden=!boss;certEl('cert-boss').disabled=certBusy || !!certPendingTestClock;certEl('cert-boss').onclick=boss?()=>openCertificateBoss(boss):null;
    certEl('cert-boss-name').textContent=boss==='final'?(a.kind==='project'?'최종 보스 · 프로젝트 완성':'최종 보스 · 합격 확인'):(a.mid_goals.find(g=>g.id===boss)?.title || '시험 완료')+' · 중간보스';
    certEl('cert-next-event').hidden=!!boss;
    certEl('cert-next-event').textContent=s.final_at?'모험 완료! 다음 목표를 향해 나아가세요.':a.monster==='daily'?'데일리 몹 출현 · 메인 퀘스트 완료 시 토벌':s.daily_defeated?'오늘의 데일리 몹 토벌 완료 · 다음 오전 6시 재등장':'오늘의 보스를 토벌했습니다.';
    certEl('cert-final-date').textContent=a.kind==='project'?`최종 목표: ${a.result_date} · ${s.final_at?'토벌 완료':'프로젝트 완성 후 최종 보스를 토벌해주세요.'}`:`최종 목표: ${a.result_date} 합격발표 · ${s.final_at?'토벌 완료':'합격 후 최종 보스를 토벌해주세요.'}`;
    certEl('cert-third-date').value=a.third_date || '';
    for(const [id,value] of [['cert-written-date',a.written_date],['cert-practical-date',a.practical_date],['cert-result-date',a.result_date],['cert-test-date',a.today]])certEl(id).value=value;
    certEl('cert-test-time').value=a.clock_time || '12:00';
    certEl('cert-real-today').textContent=`실제 오늘: ${a.real_today} (한국 시간)`;
    certEl('cert-date-presets').replaceChildren();
    const prior=new Date(a.written_date+'T00:00:00Z');prior.setUTCDate(prior.getUTCDate()-1);
    const presets=a.kind==='project'?[['첫 목표 전날',prior.toISOString().slice(0,10)],['중기목표 1일',a.written_date],['중기목표 2일',a.practical_date],['중기목표 3일',a.third_date],['최종목표일',a.result_date]]:[['필기 전날',prior.toISOString().slice(0,10)],['필기 당일',a.written_date],['실기 당일',a.practical_date],['합격발표일',a.result_date]];
    for(const [label,date] of presets.filter(([,date])=>!!date)){const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=certBusy;button.addEventListener('click',()=>void certificateAction('test_on',{date,time:certEl('cert-test-time').value || '12:00'}));certEl('cert-date-presets').append(button);}
    certEl('cert-test-exit').disabled=certBusy || !a.test_mode;certEl('cert-test-reset').disabled=certBusy || !a.test_mode;
    certEl('cert-dates-form').querySelector('button').disabled=certBusy;certEl('cert-test-apply').disabled=certBusy;
    const report=certEl('cert-report');report.replaceChildren();report.hidden=!certificateReport;
    if(certificateReport){const title=document.createElement('strong');title.textContent=`${a.kind==='project'?'프로젝트':'자격증'} 반영 매칭점수: ${certificateReport.score_100==null?'산출할 기술 정보 부족':certificateReport.score_100.toFixed(2)+'점'}`;report.append(title);for(const [key,label] of [['strengths','강점'],['improvements','보완점']]){for(const item of certificateReport.explanation?.[key] || []){const line=document.createElement('p');line.textContent=`${label}: ${item.message}`;report.append(line);}}}
    if(certificateData?.report_pending){report.hidden=false;const text=document.createElement('p');text.textContent='완료 기록은 저장되었습니다. 매칭 리포트를 다시 불러와주세요.';const retry=document.createElement('button');retry.textContent='리포트 다시 불러오기';retry.addEventListener('click',()=>void loadCertificateAdventure());report.append(text,retry);}
    renderCertificateMonth();renderCertificateCurriculum();
}
function routeChoiceIcon(index){
    // Icon names extracted from the uploaded index(2).html classRoutes.
    const icon=document.createElement('i');icon.setAttribute('data-lucide',['sword','cross','wand-2'][index]);icon.setAttribute('aria-hidden','true');
    return icon;
}
function renderCertificateCurriculum(){
    const container=certEl('roadmap-curriculum');if(!container)return;
    container.replaceChildren();
    const role={FE:'프론트엔드',BE:'백엔드',APP:'앱 개발',ERP:'시스템·ERP',OPS:'클라우드',SEC:'정보보안',DATA:'데이터',AIML:'AI·ML',QA:'QA',GAME:'게임',IOT:'임베디드·IoT',NET:'네트워크',ETC:'개발·IT'}[currentRoadmap?.job_code] || '개발·IT';
    const license=licenseCurriculum?.recommendations?.[0]?.certificate_name || (licenseLoading?'자격증을 고르고 있어요…':licenseError?'추천을 불러오지 못했어요':'자격증 학습');
    const selected=certificateData?.adventure && certificateData.adventure.road_id===currentRoadmap?.road_id && (licenseCurriculum?.recommendations?.[0]?.rounds || []).some(r=>r.lc_id===certificateData.adventure.lc_id);
    const project=typeof projectCurriculum!=='undefined'?projectCurriculum?.recommendations?.[0]:null;
    const projectBusy=typeof projectLoading!=='undefined' && projectLoading;
    const projectFailed=typeof projectError!=='undefined' && projectError;
    const choices=[
        {label:'자격증',route:'warrior',className:'전사',title:license,description:licenseCurriculum?.recommendations?.[0]?.reason || (licenseLoading?'보완점과 사용자 스펙을 바탕으로 가장 적합한 자격증을 찾고 있습니다.':'보완점에 직접 연결되는 자격증이 있는지 확인합니다.'),goal:licenseCurriculum?.recommendations?.[0]?`목표: ${license} 취득`:'보완점에 맞는 학습 목표를 확인합니다.'},
        {label:'공모전',route:'priest',className:'성직자',title:`${role} 공모전`,description:'팀을 구성해 실제 서비스 아이디어를 구현하고 문제 해결 과정을 포트폴리오로 정리합니다.',goal:'목표: 공모전 1회 참가 · 결과물 정리'},
        {label:'프로젝트',route:'mage',className:'마법사',title:project?.project_name || (projectBusy?'프로젝트를 고르고 있어요…':projectFailed?'추천을 불러오지 못했어요':'프로젝트 학습'),description:project?.reason || (projectBusy?'보완할 기술에 해당하는 프로젝트를 고르고 있습니다.':'보완점에 연결되는 프로젝트를 확인합니다.'),goal:project?`예상 기간: ${project.total_days}일 · 중기목표 ${project.mid_goals.length}개`:'프로젝트 학습 목표를 확인합니다.'}
    ];
    for(const [index,item] of choices.entries()){
        const active=(index===0 && !!selected) || (index===2 && !!project && certificateData?.adventure?.kind==='project' && certificateData.adventure.road_id===currentRoadmap?.road_id && certificateData.adventure.project_id===project.project_id),button=document.createElement('button');button.type='button';button.className='route-choice roadmap-curriculum-card';button.dataset.route=item.route;button.dataset.curriculumIndex=index;button.disabled=index===2?projectBusy:certBusy;button.setAttribute('aria-pressed',String(active));
        const top=document.createElement('span');top.className='route-choice-top';
        const badge=document.createElement('span');badge.className='route-choice-badge';badge.textContent=item.label;
        const status=document.createElement('span');status.className='route-choice-status';status.textContent=active?'선택됨':'선택하기';top.append(badge,status);
        const heading=document.createElement('span');heading.className='route-choice-heading';
        const icon=document.createElement('span');icon.className='route-choice-icon';icon.append(routeChoiceIcon(index));
        const identity=document.createElement('span');identity.className='route-choice-identity';
        const route=document.createElement('span');route.className='route-choice-class';route.textContent=`${item.className} ROUTE`;
        const title=document.createElement('span');title.className='route-choice-title';title.textContent=item.title;identity.append(route,title);heading.append(icon,identity);
        const description=document.createElement('span');description.className='route-choice-description';description.textContent=item.description;
        const goal=document.createElement('span');goal.className='route-choice-goal';goal.textContent=item.goal;
        button.append(top,heading,description,goal);button.addEventListener('click',()=>void selectCurriculum(index));
        if(index===0 || index===2){const wrapper=document.createElement('article');wrapper.className='license-route-wrapper';wrapper.dataset.selected=String(active);wrapper.append(button);const footer=document.createElement('div');footer.className='license-route-footer'+(index===2?' project-route-footer':'');if(index===0)footer.classList.add('certificate-route-footer');wrapper.append(footer);container.append(wrapper);}else container.append(button);
    }
    lucide.createIcons();if(typeof renderLicensePanel==='function')renderLicensePanel();
    if(typeof renderProjectPanel==='function')renderProjectPanel();
}
async function selectCurriculum(index){
    if(index===2){projectExpanded=!projectExpanded;renderProjectPanel();document.querySelector('.project-route-footer')?.scrollIntoView?.({behavior:'smooth',block:'nearest'});return;}
    if(index!==0){showToast('공모전 모험은 준비 중입니다.');return;}
    licenseExpanded=true;renderLicensePanel();document.querySelector('.license-route-footer')?.scrollIntoView?.({behavior:'smooth',block:'nearest'});
    if(!licenseCurriculum && !licenseLoading && !licenseError)await requestLicenseCurriculum(true,false);
}
function renderHomeAdventure(){renderCertificateAdventure();}
function renderCertificateMonth(){
    const a=certificateData?.adventure,selected=certEl('cert-test-date').value;
    if(!certCalendarMonth)certCalendarMonth=(selected || a?.today || new Date().toISOString().slice(0,10)).slice(0,7);
    const first=new Date(certCalendarMonth+'-01T00:00:00Z');
    if(!Number.isFinite(first.getTime()))return;
    certEl('cert-month-title').textContent=`${first.getUTCFullYear()}년 ${first.getUTCMonth()+1}월`;
    const grid=certEl('cert-month-grid');grid.replaceChildren();
    for(const day of ['일','월','화','수','목','금','토']){const label=document.createElement('small');label.textContent=day;grid.append(label);}
    for(let i=0;i<first.getUTCDay();i++)grid.append(document.createElement('span'));
    const last=new Date(first);last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
    for(let day=1;day<=last.getUTCDate();day++){
        const date=certCalendarMonth+'-'+String(day).padStart(2,'0'),button=document.createElement('button');button.type='button';button.textContent=day;button.disabled=!a || certBusy;button.setAttribute('aria-label',date);button.setAttribute('aria-pressed',String(selected===date));
        if(a && [a.written_date,a.practical_date,a.third_date,a.result_date].includes(date)){button.classList.add('cert-exam-day');button.title='시험 또는 합격발표 일정';}
        button.addEventListener('click',()=>{certEl('cert-test-date').value=date;renderCertificateMonth();});grid.append(button);
    }
}
function changeCertificateMonth(delta){const date=new Date(certCalendarMonth+'-01T00:00:00Z');date.setUTCMonth(date.getUTCMonth()+delta);certCalendarMonth=date.toISOString().slice(0,7);renderCertificateMonth();}
function editCertificateSchedule(stage){renderCertificateMonth();certEl('cert-calendar').showModal();const input=certEl(stage==='written'?'cert-written-date':stage==='practical'?'cert-practical-date':stage==='third'?'cert-third-date':'cert-result-date');input.focus();input.scrollIntoView?.({block:'center',behavior:'smooth'});}
function openCertificateBoss(stage){
    const a=certificateData?.adventure,isProject=a?.kind==='project';certBossStage=stage;
    certEl('cert-password-title').textContent=stage==='final'?(isProject?'최종 보스 · 프로젝트 완성':'최종 보스 · 합격 확인'):(a?.mid_goals.find(g=>g.id===stage)?.title || '목표 완료')+' · 완료 확인';
    certEl('cert-password').value='';certEl('cert-password').hidden=stage==='final';certEl('cert-password').required=stage!=='final';
    const due=stage==='written'?a?.written_date:stage==='practical'?a?.practical_date:a?.third_date;
    certEl('cert-password-description').textContent=isProject?(stage==='final'?('프로젝트를 완성하셨나요? 토벌 완료 시 완료 기록을 스펙에 반영합니다.'):'완료 비밀번호를 입력해주세요. (목표일의 월일 4자리: '+due?.slice(5).replace('-','')+')'):stage==='final'?('최종 합격을 확인하셨나요? 토벌 완료 시 보유 자격증에 반영합니다.'):'완료 비밀번호를 입력해주세요.';
    certEl('cert-password-error').textContent='';certEl('cert-password-dialog').showModal();if(stage!=='final')certEl('cert-password').focus();
}
function celebrateCertificate(title,text){clearTimeout(certCelebrationTimer);certEl('cert-celebration-title').textContent=title;certEl('cert-celebration-text').textContent=text;certEl('cert-celebration').hidden=false;certCelebrationTimer=setTimeout(()=>certEl('cert-celebration').hidden=true,3000);}
document.addEventListener('DOMContentLoaded',()=>{
    certEl('cert-final-date-edit').addEventListener('click',()=>editCertificateSchedule('final'));
    certEl('cert-go-roadmap').addEventListener('click',()=>switchNavTab('roadmap'));
    certEl('cert-calendar-toggle').addEventListener('click',()=>{renderCertificateMonth();certEl('cert-calendar').showModal();});
    certEl('cert-month-prev').addEventListener('click',()=>changeCertificateMonth(-1));certEl('cert-month-next').addEventListener('click',()=>changeCertificateMonth(1));
    certEl('cert-test-date').addEventListener('change',()=>{if(certEl('cert-test-date').value)certCalendarMonth=certEl('cert-test-date').value.slice(0,7);renderCertificateMonth();});
    document.querySelector('[data-close-calendar]').addEventListener('click',()=>certEl('cert-calendar').close());
    certEl('cert-add-form').addEventListener('submit',async e=>{e.preventDefault();const text=certEl('cert-add-text').value;const data=await certificateAction('add',{text});if(data)certEl('cert-add-text').value='';});
    certEl('cert-dates-form').addEventListener('submit',e=>{e.preventDefault();void certificateAction('dates',{written:certEl('cert-written-date').value,practical:certEl('cert-practical-date').value,result:certEl('cert-result-date').value,...(certificateData?.adventure?.kind==='project'?{third:certEl('cert-third-date').value}:{})});});
    certEl('cert-test-apply').addEventListener('click',()=>void certificateAction('test_on',{date:certEl('cert-test-date').value,time:certEl('cert-test-time').value || '12:00'}));
    certEl('cert-test-reset').addEventListener('click',()=>void certificateAction('test_reset',{date:certEl('cert-test-date').value,time:certEl('cert-test-time').value || '12:00'}));
    certEl('cert-test-exit').addEventListener('click',()=>void certificateAction('test_off'));
    certEl('cert-password-cancel').addEventListener('click',()=>certEl('cert-password-dialog').close());
    certEl('cert-password-form').addEventListener('submit',async e=>{e.preventDefault();const result=await certificateAction('boss',{stage:certBossStage,password:certEl('cert-password').value});if(result){certEl('cert-password').value='';certEl('cert-password-dialog').close();}});
    renderCertificateAdventure();
    setInterval(()=>{if(!document.hidden && !certEl('cert-calendar').open && !certEl('cert-password-dialog').open && !document.activeElement?.matches('input,textarea') && certificateData?.adventure)void loadCertificateAdventure();},60000);
});
