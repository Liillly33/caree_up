// A single recommendation is generated automatically and persisted per roadmap.
let licenseCurriculum=null,licenseRoadKey=null,licenseLoading=false,licenseError='',licenseNotice='',licenseController=null,licenseEpoch=0,licenseExpanded=false;
function resetLicenseCurriculum(){licenseEpoch++;licenseController?.abort();licenseController=null;licenseCurriculum=null;licenseRoadKey=null;licenseLoading=false;licenseError='';licenseNotice='';licenseExpanded=false;document.getElementById('license-recommendations')?.remove();}
async function loadLicenseCurriculum(road,initial,initialError){
    if(!road){resetLicenseCurriculum();return;}
    const key=[road.road_id,road.weak,certEl('input-stack')?.value,certEl('input-certificates')?.value].join('|');
    if(licenseRoadKey===key)return;
    resetLicenseCurriculum();licenseRoadKey=key;
    if(initial){licenseCurriculum=initial;renderCertificateCurriculum();return;}
    if(initialError){licenseError=initialError;renderCertificateCurriculum();return;}
    await requestLicenseCurriculum(true,false);
}
async function requestLicenseCurriculum(generate=true,force=false){
    if(licenseLoading || !currentRoadmap)return;
    licenseLoading=true;licenseError='';licenseNotice='';const epoch=licenseEpoch,roadId=currentRoadmap.road_id;licenseController=new AbortController();renderCertificateCurriculum();
    try{
        const token=await matchingToken();if(epoch!==licenseEpoch)return;
        const options={signal:licenseController.signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},method:'POST',body:JSON.stringify({force})};
        const body=await matchingResponse(await fetch('/api/curriculum/recommendations',options));
        if(epoch!==licenseEpoch || roadId!==currentRoadmap?.road_id || body.road_id!==roadId)return;
        licenseCurriculum=body.curriculum;
        if(body.curriculum?.no_alternative)licenseNotice='현재 보완점에 맞는 다른 자격증이 없어 기존 추천을 유지합니다.';
    }catch(error){if(epoch===licenseEpoch && error.name!=='AbortError')licenseError=error.message || '자격증 추천을 불러오지 못했습니다.';}
    finally{if(epoch===licenseEpoch){licenseLoading=false;licenseController=null;renderCertificateCurriculum();}}
}
function licenseRoundDate(){
    // Adventure's server-provided calendar date is shared by the demo and its exam picker.
    const adventure=certificateData?.adventure;
    if(certPendingTestClock?.date)return certPendingTestClock.date;
    if(adventure?.today)return adventure.today;
    return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function licenseRoundsAtCalendar(item){
    const date=licenseRoundDate();
    return item.rounds.map(round=>({...round,expired:round.exam_date<date})).sort((a,b)=>(Number(a.expired)-Number(b.expired)) || a.exam_date.localeCompare(b.exam_date) || a.lc_id-b.lc_id);
}
function renderLicensePanel(){
    const panel=document.querySelector('.certificate-route-footer');if(!panel || !currentRoadmap)return;panel.replaceChildren();
    const item=licenseCurriculum?.recommendations?.[0];
    if(certPendingTestClock){
        const warning=document.createElement('p');warning.className='license-error';warning.textContent='테스트 날짜를 다시 적용한 뒤 모험을 진행해주세요.';
        const retry=document.createElement('button');retry.type='button';retry.className='cert-clock-retry';retry.disabled=certBusy;retry.textContent='테스트 날짜 다시 적용';retry.addEventListener('click',()=>void certificateAction('test_on',certPendingTestClock));panel.append(warning,retry);
    }
    if(licenseError || licenseNotice){const msg=document.createElement('p');msg.setAttribute('role','status');msg.className=licenseError?'license-error':'license-notice';msg.textContent=licenseError || licenseNotice;panel.append(msg);}

    if(item && licenseExpanded){
        const gap=document.createElement('small');gap.className='license-gap';gap.textContent=(item.basis_type && item.basis_type!=='gaps'?'추천 기준: ':'연결된 보완점: ')+item.gap;
        const rounds=licenseRoundsAtCalendar(item),firstDemo=!certificateData?.adventure;
        const calendarNote=document.createElement('small');calendarNote.className='license-calendar-note';calendarNote.textContent=`회차 선택 기준: ${licenseRoundDate()}${(certificateData?.adventure?.test_mode || certPendingTestClock)?' · 어드벤처 날짜 테스트':''}`;
        const select=document.createElement('select');select.setAttribute('aria-label',item.certificate_name+' 시험 회차');
        for(const round of rounds){const option=document.createElement('option');option.value=round.lc_id;option.disabled=round.expired && !firstDemo;option.textContent=`${round.name} · ${round.exam_date}${round.expired?(firstDemo?' · 지난 회차 · 데모 선택 가능':' · 지난 시험'):''}`;select.append(option);}
        const next=rounds.find(x=>!x.expired || firstDemo);if(next)select.value=String(next.lc_id);else select.selectedIndex=-1;
        const note=document.createElement('small');note.className='license-round-note';
        const updateNote=()=>{const round=rounds.find(r=>String(r.lc_id)===select.value);note.textContent=round?`발표 ${round.result_date}${round.practical_date?' · 실기 '+round.practical_date:''}${round.prerequisite_note?' · '+round.prerequisite_note:''}`:'현재 등록된 회차에 응시 가능한 시험이 없습니다.';};select.addEventListener('change',updateNote);updateNote();
        const start=document.createElement('button');start.type='button';start.className='license-start';start.textContent='이 회차로 모험 시작';start.disabled=certBusy || !!certPendingTestClock || licenseLoading || !next;
        start.addEventListener('click',async()=>{if(!select.value)return;const result=await certificateAction('start',{lc_id:select.value});if(result){switchNavTab('dashboard');showToast(item.certificate_name+' 모험을 시작합니다.');}});
        panel.append(gap,calendarNote,select,note,start);
    }
    const refresh=document.createElement('button');refresh.type='button';refresh.className='license-reroll';refresh.disabled=licenseLoading || certBusy || !!certPendingTestClock;refresh.textContent='🔄️다른 자격증 추천받기';refresh.addEventListener('click',()=>void requestLicenseCurriculum(true,!!item));panel.append(refresh);
}
