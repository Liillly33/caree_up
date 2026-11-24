// Authenticated server API; Gemini keys and scoring internals never enter the UI.
let recommendationRequest=0, recommendationAbort=null;
let historyRequest=0, historyAbort=null, historyOffset=0;
function resetRecommendations(){
    recommendationRequest++; recommendationAbort?.abort(); recommendationAbort=null;
    historyRequest++; historyAbort?.abort(); historyAbort=null; historyOffset=0;
    document.getElementById('latest-recommendation-results').replaceChildren();
    document.getElementById('recommend-status').textContent='저장된 스펙정보로 추천 공고를 확인해보세요.';
    document.getElementById('recommend-start').disabled=false;
    document.getElementById('history-results').replaceChildren();
    document.getElementById('history-status').textContent='';
    document.getElementById('history-more').classList.add('hidden');
    resetCurrentRoadmap();
}
async function matchingToken(){
    const {data,error}=await authClient.auth.getSession();
    if(error || !data.session?.access_token)throw new Error('로그인 후 이용해주세요.');
    return data.session.access_token;
}
async function matchingResponse(response){
    const body=await response.json();
    if(!response.ok)throw new Error(typeof body.detail==='string'?body.detail:'추천 서버 요청에 실패했습니다.');
    return body;
}
async function startNewRecommendation(){
    recommendationAbort?.abort();
    const request=++recommendationRequest,controller=new AbortController();recommendationAbort=controller;
    const status=document.getElementById('recommend-status'),results=document.getElementById('latest-recommendation-results'),button=document.getElementById('recommend-start');
    button.disabled=true;results.replaceChildren();status.textContent='상위 공고를 찾고 추천 이유를 작성하고 있습니다…';
    try{
        const token=await matchingToken();if(request!==recommendationRequest)return;
        const body=await matchingResponse(await fetch('/api/recommendations',{
            method:'POST',signal:controller.signal,
            headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
            body:JSON.stringify({top_k:5,use_preferred_jobs:document.getElementById('recommend-preferred').checked})
        }));
        if(request!==recommendationRequest)return;
        renderRealRecommendations(body);
        status.textContent=body.results.length ? `상위 ${body.results.length}개 추천 공고입니다. 추천 기록에 저장했습니다.` : '현재 입력한 기술에 맞는 공고가 없습니다. 마이페이지의 기술 스택을 확인해주세요.';
    }catch(error){
        if(request!==recommendationRequest || error.name==='AbortError')return;
        status.textContent=error instanceof TypeError?'추천 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.':error.message;
    }finally{if(request===recommendationRequest){button.disabled=false;recommendationAbort=null;}}
}
let recommendationPanelSequence=0;
function matchingCard(job,rank,{collapsible=false}={}){
    const card=document.createElement('article');card.className='p-4 rounded-xl bg-brand-card/70 border border-brand-border space-y-3';
    const title=document.createElement(collapsible?'span':'h3');title.className='block font-bold text-white';title.textContent=`${rank}위 · ${job.company || '기업명 미기재'} · ${job.title || '공고명 미기재'}`;
    const reason=document.createElement(collapsible?'span':'p');reason.className='block text-sm text-slate-200';reason.textContent=`추천 이유: ${job.reason}`;
    const score=document.createElement(collapsible?'span':'p');score.className='block font-bold text-brand-accent';score.textContent=`매칭점수 ${Number(job.score_100).toFixed(2)}점 / 100점`;
    const panel=document.createElement('div');panel.className='recommendation-actions space-y-3';
    if(collapsible){
        panel.id=`recommendation-actions-${++recommendationPanelSequence}`;panel.hidden=true;
        const toggle=document.createElement('button');toggle.type='button';toggle.className='recommendation-toggle';
        toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',panel.id);
        const summary=document.createElement('span');summary.className='block min-w-0 space-y-2';summary.append(title,reason,score);
        const arrow=document.createElement('span');arrow.className='recommendation-chevron';arrow.textContent='▾';arrow.setAttribute('aria-hidden','true');
        toggle.append(summary,arrow);
        toggle.addEventListener('click',()=>{
            const expand=panel.hidden;
            for(const other of card.parentElement?.querySelectorAll('.recommendation-toggle') || []){
                other.setAttribute('aria-expanded','false');
                const content=document.getElementById(other.getAttribute('aria-controls'));if(content)content.hidden=true;
                other.closest('article').classList.remove('recommendation-open');
            }
            panel.hidden=!expand;toggle.setAttribute('aria-expanded',String(expand));card.classList.toggle('recommendation-open',expand);
        });
        card.append(toggle);
    }else card.append(title,reason,score);
    if(job.selected){const selected=document.createElement('p');selected.textContent='커리어 로드맵으로 선택한 공고';selected.className='text-xs text-brand-accent';panel.append(selected);}
    if(job.url){try{const url=new URL(job.url);if(['https:','http:'].includes(url.protocol)){
        const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.className='inline-block text-sm text-brand-accent underline';link.textContent='공고 원문 보기';panel.append(link);
    }}catch{}}
    const create=document.createElement('button');create.type='button';create.className='roadmap-create-button';
    create.textContent='이 공고로 커리어 로드맵 생성하기';create.disabled=roadmapCreateBusy || !job.match_id;
    create.addEventListener('click',()=>void createCareerRoadmap(job,create));panel.append(create);card.append(panel);
    return card;
}
function renderRealRecommendations(body){
    const container=document.getElementById('latest-recommendation-results');container.replaceChildren();
    body.results.slice(0,5).forEach((job,i)=>container.append(matchingCard({...job,match_id:body.saved?.match_id,rank:i+1},i+1,{collapsible:true})));
}
let historyPanelSequence=0;
function matchingHistoryCard(session){
    const jobs=[...session.results].sort((a,b)=>a.rank-b.rank).slice(0,5).map(job=>({...job,match_id:session.match_id}));
    const section=document.createElement('section');section.className='history-session';
    const header=document.createElement('h3');header.className='history-session-date';
    header.textContent=`${new Date(session.match_date).toLocaleString('ko-KR')} · 추천 #${session.match_id}`;
    section.append(header);
    const preview=document.createElement('div');preview.className='history-preview';
    if(jobs.length){
        const winner=jobs[0],spotlight=document.createElement('article');spotlight.className='history-winner';
        const heading=document.createElement('div');heading.className='history-winner-heading';
        const identity=document.createElement('div');identity.className='history-winner-identity';
        const badge=document.createElement('p');badge.className='history-winner-badge';badge.textContent='1위 추천';
        const company=document.createElement('h4');company.className='history-winner-company';company.textContent=winner.company || '기업명 미기재';
        const title=document.createElement('p');title.className='history-winner-title';title.textContent=winner.title || '공고명 미기재';title.title=title.textContent;
        identity.append(badge,company,title);
        const score=document.createElement('p');score.className='history-winner-score';score.textContent=`${Number(winner.score_100).toFixed(2)}점`;
        heading.append(identity,score);
        const reason=document.createElement('p');reason.className='history-winner-reason';reason.textContent=`추천 이유: ${winner.reason || '저장된 추천 이유가 없습니다.'}`;
        spotlight.append(heading,reason);preview.append(spotlight);
        const runners=document.createElement('div');runners.className='history-runners';
        for(const job of jobs.slice(1,3)){
            const line=document.createElement('div');line.className='history-compact-row';
            const rank=document.createElement('span');rank.className='history-compact-rank';rank.textContent=`${job.rank}위`;
            const name=document.createElement('span');name.className='history-compact-name';name.textContent=`${job.company || '기업명 미기재'} · ${job.title || '공고명 미기재'}`;name.title=name.textContent;
            const score=document.createElement('span');score.className='history-compact-score';score.textContent=`${Number(job.score_100).toFixed(2)}점`;
            line.append(rank,name,score);runners.append(line);
        }
        preview.append(runners);
    }
    const details=document.createElement('div');details.id=`history-details-${++historyPanelSequence}`;details.className='history-full-results space-y-3';details.hidden=true;
    const button=document.createElement('button');button.type='button';button.className='history-detail-button';
    button.textContent='자세히 보기';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',details.id);
    button.addEventListener('click',()=>{
        const expand=details.hidden;
        if(expand && !details.children.length)for(const job of jobs)details.append(matchingCard(job,job.rank));
        details.hidden=!expand;preview.hidden=expand;
        button.textContent=expand?'접기':'자세히 보기';button.setAttribute('aria-expanded',String(expand));
    });
    section.append(preview,details,button);return section;
}
async function loadMatchingHistory(append=false){
    historyAbort?.abort();const request=++historyRequest,controller=new AbortController();historyAbort=controller;
    const container=document.getElementById('history-results'),status=document.getElementById('history-status'),more=document.getElementById('history-more');
    if(!append){container.replaceChildren();historyOffset=0;}
    more.disabled=true;status.textContent='추천 기록을 불러오고 있습니다…';
    try{
        const token=await matchingToken();if(request!==historyRequest)return;
        const body=await matchingResponse(await fetch('/api/history?offset='+historyOffset,{signal:controller.signal,headers:{'Authorization':'Bearer '+token}}));
        if(request!==historyRequest)return;
        for(const session of body.sessions)container.append(matchingHistoryCard(session));
        historyOffset=body.next_offset;more.classList.toggle('hidden',!body.has_more);
        status.textContent=container.children.length?'저장된 추천 결과입니다.':'아직 추천 기록이 없습니다.';
    }catch(error){if(request===historyRequest && error.name!=='AbortError')status.textContent=error.message || '추천 기록을 불러오지 못했습니다.';}
    finally{if(request===historyRequest){more.disabled=false;historyAbort=null;}}
}

let currentRoadmap=null,roadmapEpoch=0,roadmapReadRequest=0,roadmapReadAbort=null,roadmapCreateAbort=null,roadmapCreateBusy=false;
function resetCurrentRoadmap(){
    if(typeof resetCertificateAdventure==='function')resetCertificateAdventure();
    roadmapEpoch++;roadmapReadRequest++;roadmapReadAbort?.abort();roadmapCreateAbort?.abort();
    roadmapReadAbort=null;roadmapCreateAbort=null;roadmapCreateBusy=false;currentRoadmap=null;
    document.getElementById('current-roadmap-target').replaceChildren();document.getElementById('current-roadmap-target').hidden=true;
    document.getElementById('roadmap-content').hidden=true;document.getElementById('roadmap-empty').hidden=true;
    document.getElementById('roadmap-status').textContent='';
    document.getElementById('roadmap-strengths').replaceChildren();document.getElementById('roadmap-gaps').replaceChildren();
}
function renderRoadmapScore(score){
    const valid=score!==null && score!==undefined && Number.isFinite(Number(score));
    const value=valid?Math.min(100,Math.max(0,Number(score))):0,gauge=document.getElementById('roadmap-score-gauge');
    gauge.style.setProperty('--score-angle',`${value*3.6}deg`);
    gauge.setAttribute('aria-label',valid?`매칭점수 ${value.toFixed(2)}점, 100점 만점`:'매칭점수 계산 대기');
    document.getElementById('roadmap-score').textContent=valid?value.toFixed(1):'—';
}
function renderCurrentRoadmap(roadmap,initialCurriculum,initialError,initialProject,initialProjectError){
    if(roadmap && typeof certificateReport!=='undefined' && certificateReport?.road_id===roadmap.road_id){
        const report=certificateReport;
        roadmap={...roadmap,score_100:report.score_100,strong:(report.explanation?.strengths || []).map(x=>x.message.replaceAll(',',' ·')).join(', '),weak:(report.explanation?.improvements || []).map(x=>x.message.replaceAll(',',' ·')).join(', ')};
    }
    currentRoadmap=roadmap || null;
    if(typeof loadLicenseCurriculum==='function')void loadLicenseCurriculum(currentRoadmap,initialCurriculum,initialError);
    if(typeof loadProjectCurriculum==='function')void loadProjectCurriculum(currentRoadmap,initialProject,initialProjectError);
    const target=document.getElementById('current-roadmap-target');target.replaceChildren();target.hidden=!roadmap;
    document.getElementById('roadmap-empty').hidden=!!roadmap;document.getElementById('roadmap-content').hidden=!roadmap;
    document.getElementById('roadmap-status').textContent='';
    if(!roadmap)return;
    if(typeof renderCertificateCurriculum==='function')renderCertificateCurriculum();
    const info=document.createElement('div');info.className='current-target-info';
    const label=document.createElement('h3');label.className='current-target-label';label.textContent='현재 목표 공고';
    const title=document.createElement('p');title.className='current-target-title';title.textContent=`${roadmap.company || '기업명 미기재'} · ${roadmap.title || '공고명 미기재'}`;info.append(label,title);
    const numeric=Number(roadmap.score_100),value=Number.isFinite(numeric)?Math.min(100,Math.max(0,numeric)):0;
    const score=document.createElement('div');score.className='current-target-score';score.style.setProperty('--score-angle',`${value*3.6}deg`);score.setAttribute('role','img');score.setAttribute('aria-label',`매칭점수 ${value.toFixed(2)}점, 100점 만점`);
    const inner=document.createElement('div');inner.className='current-target-score-inner';
    const number=document.createElement('span');number.className='current-target-score-value';number.textContent=`${value.toFixed(1)}점`;
    const caption=document.createElement('span');caption.className='current-target-score-caption';caption.textContent='매칭점수';inner.append(number,caption);score.append(inner);
    const link=document.createElement('button');link.type='button';link.className='current-target-link';link.textContent='커리어 로드맵 바로가기';link.addEventListener('click',()=>switchNavTab('roadmap'));
    target.append(info,score,link);
    document.getElementById('roadmap-title').textContent=`${roadmap.company || '기업명 미기재'} 커리어 로드맵`;
    document.getElementById('roadmap-subtitle').textContent=roadmap.title || '공고명 미기재';
    renderRoadmapScore(roadmap.score_100);
    for(const [id,text,empty] of [['roadmap-strengths',roadmap.strong,'확인된 강점이 없습니다.'],['roadmap-gaps',roadmap.weak,'확인된 보완점이 없습니다.']]){
        const list=document.getElementById(id);list.replaceChildren();const items=(text || '').split(',').map(s=>s.trim()).filter(Boolean);
        for(const item of (items.length?items:[empty])){
            const li=document.createElement('li');li.className='roadmap-evidence-item';
            if(items.length){const icon=document.createElement('span');icon.className='roadmap-evidence-icon';icon.setAttribute('aria-hidden','true');icon.textContent=id==='roadmap-strengths'?'✓':'↗';li.append(icon);}
            const text=document.createElement('span');text.textContent=item;li.append(text);list.append(li);
        }
    }
}
async function loadCurrentRoadmap(){
    if(roadmapCreateBusy)return;
    roadmapReadAbort?.abort();const request=++roadmapReadRequest,epoch=roadmapEpoch,controller=new AbortController();roadmapReadAbort=controller;
    if(!currentRoadmap){document.getElementById('roadmap-status').textContent='로드맵을 불러오고 있습니다…';document.getElementById('roadmap-empty').hidden=true;}
    try{
        const token=await matchingToken();if(epoch!==roadmapEpoch || request!==roadmapReadRequest)return;
        const body=await matchingResponse(await fetch('/api/roadmaps/current',{signal:controller.signal,headers:{'Authorization':'Bearer '+token}}));
        if(epoch!==roadmapEpoch || request!==roadmapReadRequest)return;
        renderCurrentRoadmap(body.roadmap);
    }catch(error){if(epoch===roadmapEpoch && request===roadmapReadRequest && error.name!=='AbortError')document.getElementById('roadmap-status').textContent=error.message || '로드맵을 불러오지 못했습니다.';}
    finally{if(epoch===roadmapEpoch && request===roadmapReadRequest)roadmapReadAbort=null;}
}
async function createCareerRoadmap(job,button){
    if(roadmapCreateBusy || !job.match_id)return;
    const epoch=roadmapEpoch,controller=new AbortController();roadmapCreateAbort=controller;roadmapCreateBusy=true;
    roadmapReadRequest++;roadmapReadAbort?.abort();
    document.querySelectorAll('.roadmap-create-button').forEach(b=>b.disabled=true);button.textContent='로드맵 생성 중…';
    try{
        const token=await matchingToken();if(epoch!==roadmapEpoch)return;
        const body=await matchingResponse(await fetch('/api/roadmaps',{
            method:'POST',signal:controller.signal,headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
            body:JSON.stringify({match_id:job.match_id,match_rank:job.rank})
        }));
        if(epoch!==roadmapEpoch)return;
        if(!body.roadmap)throw new Error('생성 결과를 확인할 수 없습니다.');
        renderCurrentRoadmap(body.roadmap,body.curriculum,body.curriculum_error,body.project_curriculum,body.project_curriculum_error);switchNavTab('roadmap');showToast('커리어 로드맵이 생성되었습니다.');
    }catch(error){if(epoch===roadmapEpoch && error.name!=='AbortError')showToast(error.message || '로드맵 생성에 실패했습니다.');}
    finally{if(epoch===roadmapEpoch){roadmapCreateBusy=false;roadmapCreateAbort=null;document.querySelectorAll('.roadmap-create-button').forEach(b=>b.disabled=false);button.textContent='이 공고로 커리어 로드맵 생성하기';}}
}
