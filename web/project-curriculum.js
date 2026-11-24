// Recommended and explicitly selected projects are persisted separately.
let projectCurriculum=null,projectSelected=null,projectRoadKey=null,projectLoading=false,projectError='',projectNotice='',projectExpanded=false,projectController=null,projectEpoch=0;
function resetProjectCurriculum(){
    projectEpoch++;projectController?.abort();projectController=null;projectCurriculum=null;projectSelected=null;projectRoadKey=null;projectLoading=false;projectError='';projectNotice='';projectExpanded=false;
}
async function loadProjectCurriculum(road,initial,initialError){
    if(!road){resetProjectCurriculum();return;}
    const key=[road.road_id,road.weak,certEl('input-stack')?.value].join('|');
    if(projectRoadKey===key)return;
    resetProjectCurriculum();projectRoadKey=key;
    if(initial){projectCurriculum=initial.curriculum;projectSelected=initial.selected_project;renderCertificateCurriculum();return;}
    if(initialError){projectError=initialError;renderCertificateCurriculum();return;}
    await requestProjectCurriculum(false);
}
async function requestProjectCurriculum(force=false){
    if(projectLoading || !currentRoadmap)return;
    projectLoading=true;projectError='';projectNotice='';const epoch=projectEpoch,roadId=currentRoadmap.road_id;
    projectController=new AbortController();renderCertificateCurriculum();
    try{
        const token=await matchingToken();if(epoch!==projectEpoch)return;
        const body=await matchingResponse(await fetch('/api/projects/recommendations',{
            signal:projectController.signal,method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
            body:JSON.stringify({road_id:roadId,force})
        }));
        if(epoch!==projectEpoch || roadId!==currentRoadmap?.road_id || body.road_id!==roadId)return;
        projectCurriculum=body.curriculum;projectSelected=body.selected_project;
        if(body.curriculum?.no_alternative)projectNotice='보완점에 맞는 다른 프로젝트가 없어 기존 추천을 유지합니다.';
    }catch(error){if(epoch===projectEpoch && error.name!=='AbortError')projectError=error.message || '프로젝트 추천을 불러오지 못했습니다.';}
    finally{if(epoch===projectEpoch){projectLoading=false;projectController=null;renderCertificateCurriculum();}}
}
function renderProjectPanel(){
    const panel=document.querySelector('.project-route-footer');if(!panel || !currentRoadmap)return;panel.replaceChildren();
    const item=projectCurriculum?.recommendations?.[0];
    if(projectError || projectNotice){const p=document.createElement('p');p.className=projectError?'license-error':'license-notice';p.setAttribute('role','status');p.textContent=projectError || projectNotice;panel.append(p);}
    if(projectSelected && projectSelected.project_id!==item?.project_id){
        const p=document.createElement('small');p.textContent='현재 선택한 프로젝트: '+projectSelected.project_name;panel.append(p);
    }

    if(item && projectExpanded){
        const gap=document.createElement('small');gap.textContent=(item.basis_type && item.basis_type!=='gaps'?'추천 기준: ':'연결된 보완점: ')+item.gap;panel.append(gap);
        const goal=document.createElement('p');goal.className='project-final-goal';goal.textContent=item.final_goal;panel.append(goal);
        const list=document.createElement('ol');list.className='project-stage-list';
        for(const stage of item.mid_goals || []){
            const li=document.createElement('li'),title=document.createElement('strong'),daily=document.createElement('small');
            title.textContent=`${stage.title} · ${stage.duration_days}일`;daily.textContent='고정 일일목표: '+stage.daily;li.append(title,daily);list.append(li);
        }
        panel.append(list);
        const select=document.createElement('button');select.type='button';select.className='license-start';
        const selected=projectSelected?.project_id===item.project_id;select.textContent=selected?'선택된 프로젝트':'이 프로젝트 선택하기';select.disabled=projectLoading || selected;
        select.textContent=selected?'이 프로젝트로 새로 시작':'이 프로젝트로 모험 시작';select.disabled=projectLoading || certBusy;
        select.addEventListener('click',()=>void beginAdventure({kind:'project',project_id:item.project_id}));panel.append(select);
    }
    const refresh=document.createElement('button');refresh.type='button';refresh.className='license-reroll';refresh.disabled=projectLoading;
    refresh.textContent='🔄️다른 프로젝트 추천받기';refresh.addEventListener('click',()=>void requestProjectCurriculum(!!item));panel.append(refresh);
}
