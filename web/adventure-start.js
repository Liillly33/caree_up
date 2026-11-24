// A two-step warning and password check precede replacement of an active adventure.
let adventureStartPending=null,adventureStartController=null,adventureStartBusy=false,adventureStartEpoch=0;
function resetAdventureStart(){
    adventureStartEpoch++;adventureStartController?.abort();adventureStartController=null;adventureStartBusy=false;
    const pending=adventureStartPending;adventureStartPending=null;pending?.resolve(null);
    certEl('adventure-restart-password').value='';certEl('adventure-restart-password').disabled=false;
    certEl('adventure-restart-dialog').querySelectorAll('button').forEach(b=>b.disabled=false);
    if(certEl('adventure-restart-dialog').open)certEl('adventure-restart-dialog').close();
}
async function beginAdventure(target){
    if(adventureStartPending || adventureStartBusy || certBusy || !currentRoadmap)return null;
    const epoch=adventureStartEpoch,roadId=currentRoadmap.road_id;
    adventureStartBusy=true;adventureStartController=new AbortController();
    try{
        const token=await matchingToken();if(epoch!==adventureStartEpoch)return null;
        const state=await matchingResponse(await fetch('/api/adventure',{signal:adventureStartController.signal,headers:{Authorization:'Bearer '+token}}));
        if(epoch!==adventureStartEpoch || roadId!==currentRoadmap?.road_id)return null;
        const a=state.adventure,body={...target,road_id:roadId,expected_run_id:a?.run_id || null};
        if(a && (a.restart_requires_password ?? !a.state.final_at)){
            adventureStartBusy=false;adventureStartController=null;
            return await new Promise(resolve=>{
                adventureStartPending={body,epoch,resolve};
                certEl('adventure-restart-warning').hidden=false;certEl('adventure-restart-form').hidden=true;
                certEl('adventure-restart-password').value='';certEl('adventure-restart-error').textContent='';
                certEl('adventure-restart-dialog').showModal();certEl('adventure-restart-no').focus();
            });
        }
        adventureStartBusy=false;return await submitAdventureStart(body,'',epoch);
    }catch(error){if(epoch===adventureStartEpoch && error.name!=='AbortError')showToast(error.message || '모험을 확인하지 못했습니다.');return null;}
    finally{if(epoch===adventureStartEpoch && !adventureStartPending){adventureStartBusy=false;adventureStartController=null;}}
}
async function submitAdventureStart(body,password,epoch=adventureStartEpoch){
    if(adventureStartBusy)return null;
    adventureStartBusy=true;certBusy=true;adventureStartController=new AbortController();
    certEl('adventure-restart-error').textContent='';
    certEl('adventure-restart-dialog').querySelectorAll('button').forEach(b=>b.disabled=true);
    certEl('adventure-restart-password').disabled=true;renderCertificateAdventure();
    try{
        const token=await matchingToken();if(epoch!==adventureStartEpoch)return null;
        const request={...body};if(password)request.password=password;
        const data=await matchingResponse(await fetch('/api/adventure/start',{method:'POST',signal:adventureStartController.signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(request)}));
        if(epoch!==adventureStartEpoch || body.road_id!==currentRoadmap?.road_id)return null;
        certificateReport=null;certPendingTestClock=null;clearMainQuestAttack();receiveCertificate(data);
        if(data.adventure?.kind==='project'){
            projectSelected=projectCurriculum?.recommendations?.find(p=>p.project_id===data.adventure.project_id) || projectSelected;
        }
        certEl('adventure-restart-password').value='';
        const pending=adventureStartPending;adventureStartPending=null;
        if(certEl('adventure-restart-dialog').open)certEl('adventure-restart-dialog').close();
        switchNavTab('dashboard');showToast('새로운 커리업 어드벤처를 시작합니다.');pending?.resolve(data);return data;
    }catch(error){
        if(epoch===adventureStartEpoch && error.name!=='AbortError'){
            const message=error.message || '모험 시작에 실패했습니다.';
            if(adventureStartPending)certEl('adventure-restart-error').textContent=message;else showToast(message);
        }
        return null;
    }finally{
        if(epoch===adventureStartEpoch){adventureStartBusy=false;certBusy=false;adventureStartController=null;
            certEl('adventure-restart-dialog').querySelectorAll('button').forEach(b=>b.disabled=false);
            certEl('adventure-restart-password').disabled=false;certEl('adventure-restart-password').value='';renderCertificateAdventure();}
    }
}
document.addEventListener('DOMContentLoaded',()=>{
    const cancel=()=>{if(!adventureStartBusy)resetAdventureStart();};
    for(const id of ['adventure-restart-no','adventure-restart-cancel'])certEl(id).addEventListener('click',cancel);
    certEl('adventure-restart-dialog').addEventListener('cancel',e=>{e.preventDefault();cancel();});
    certEl('adventure-restart-dialog').addEventListener('close',()=>{if(adventureStartPending && !adventureStartBusy)resetAdventureStart();});
    certEl('adventure-restart-yes').addEventListener('click',()=>{certEl('adventure-restart-warning').hidden=true;certEl('adventure-restart-form').hidden=false;certEl('adventure-restart-password').focus();});
    certEl('adventure-restart-form').addEventListener('submit',e=>{e.preventDefault();if(adventureStartPending && !adventureStartBusy)void submitAdventureStart(adventureStartPending.body,certEl('adventure-restart-password').value,adventureStartPending.epoch);});
});
