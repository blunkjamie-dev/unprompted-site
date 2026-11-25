(()=>{'use strict';const E=KeeperEngine,$=id=>document.getElementById(id),KEY='last-light-beacon-v2';const unique=()=>crypto.randomUUID();let s=E.create(unique()),saveOK=true,hiddenHeld=false,started=false;
try{const raw=localStorage.getItem(KEY);if(raw){const restored=E.restore(raw);if(restored){s=restored;started=true;}else $('feedback').textContent='Old save could not be read. A fresh watch has begun.';}}catch{saveOK=false;}
function persist(){try{localStorage.setItem(KEY,E.serialize(s));saveOK=true;}catch{saveOK=false;}$('save-status').textContent=saveOK?'Saved in this browser · same file, same watch':'Save unavailable · this tab only; reload will lose progress';}
function render(){
document.body.dataset.paused=String(s.paused);document.body.dataset.lit=String(s.lit);
$('watch-status').textContent=s.paused?'● WATCH PAUSED':'● ON WATCH';$('pause').textContent=s.paused?'Resume':'Pause';$('clock').textContent=`${String(Math.floor(s.elapsed/60)).padStart(2,'0')}:${String(s.elapsed%60).padStart(2,'0')} / 05:00`;
$('wedge-art').style.opacity=s.aligned?1:.15;$('barrel').style.transform=s.aligned?'rotate(0deg)':'rotate(12deg)';$('aim-beam').style.transform=s.aligned?'rotate(0deg)':'rotate(12deg)';$('aim-beam').style.opacity=s.lit?1:.3;
$('beam-label').textContent=s.lit?'Full beam: boat windows lit':s.aligned?'Pilot beam: aligned · shutter still closed':'Pilot beam: below the boat';
$('lens').style.transform=s.seated?'translate(-100px,-42px) scale(1)':'none';$('cloth').style.opacity=s.seated?.25:1;
s.segments.forEach((v,i)=>{$('patch-'+(i+1)).style.opacity=.12+v/35*.88;$('segment-'+(i+1)).style.setProperty('--fill',(v/35*100)+'%');});
const at=s.active?s.active.type:s.step===0?'inspect':s.step<4?'polish':s.step===4?'seat':'ready';const positions={wedge:[223,395],bell:[582,376],shutter:[310,386],inspect:[322,402],polish:[407,416],seat:[374,405],ready:[568,393]};$('pip').setAttribute('transform','translate('+positions[at].join(' ')+')');
$('cloth').style.transform=at==='polish'?`translate(${Math.floor((35-s.remaining)/5)%2*6}px,0)`:'none';
const work=E.activity(s);$('current').textContent=work+(s.active?' · '+s.active.remaining+'s':'');$('saved-step').textContent=`${['Inspect miss','Lens patch 1','Lens patch 2','Lens patch 3','Seat lens','Inspect finished light'][s.step]} · ${s.remaining}s left`;
$('progress-label').textContent=s.seated?'3 / 3 patches · seated':s.step===0?'Checking the miss':`${s.segments.filter(x=>x===35).length} / 3 patches clear`;
$('mount-check').textContent=s.aligned?'●':'○';$('mount-state').textContent=s.aligned?'level':'needs leveling';$('lens-check').textContent=s.seated?'●':'○';$('lens-state').textContent=s.seated?'seated & clear':s.step===4?'seating':s.step===0?'checking':`patch ${s.step} of 3`;
const pending=s.ledger.filter(e=>e.status==='waiting-ready').length;$('shutter-state').textContent=s.lit?'open · boat lit':pending?'requested · waiting':'closed';$('light-check').textContent=s.lit?'●':'○';$('waiting').textContent=(s.queue.length+pending)+' waiting'+(pending?' · shutter held':'');
const last=s.ledger.at(-1);$('latest').textContent=last?`${last.type} · ${last.status}`:'No visits yet';$('activity-kind').textContent=s.active?'WITH YOU':s.verified?'WATCH COMPLETE':'AT WORK';
const idleLines=['The beam misses low. I’ll start with the lens.','First patch: a little less fog between us and the boat.','Second patch. The cloth is making a clear path.','One patch left. Nearly enough light to travel.','Three clear patches. Seating the lens in its mount.',s.lit?(s.verified?'Windows checked. I’ll keep the tools out of the beam.':'There’s the boat. Checking that every window caught the light.'):s.aligned?'Lens seated, mount level. Pull the shutter whenever you’re ready.':'Lens seated. The mount still needs your copper wedge.'];
const line=s.active?s.notice:pending&&!s.lit?`Shutter request saved. ${s.aligned?'Finishing the lens before opening.':'The copper wedge is still needed.'} ${s.step<5?'Work continues.':''}`:idleLines[s.step];if($('dialogue').textContent!==line)$('dialogue').textContent=line;
}
function commit(){persist();render();}
function send(type){const result=E.dispatch(s,{id:unique(),type});commit();$('feedback').textContent=result.accepted?(s.paused?'Visit saved. Resume to begin.':s.queue.length?'Visit saved in the waiting line.':s.notice):result.reason==='queue-full'?'Waiting line full (3). This visit was not accepted. Try after Pip finishes one.':'Watch ledger full. Reset for a new watch.';}
$('wedge').onclick=()=>send('wedge');$('bell').onclick=()=>send('bell');$('release').onclick=()=>send('shutter');
$('pause').onclick=()=>{hiddenHeld=false;E.pause(s,!s.paused);commit();$('feedback').textContent=s.paused?'Paused at the saved unfinished step.':'Resumed the saved unfinished work.';};
$('cancel').onclick=()=>{E.cancel(s);commit();$('feedback').textContent=s.notice;};$('reset').onclick=()=>{s=E.create(unique());hiddenHeld=false;commit();$('feedback').textContent='Fresh watch. The previous watch is cleared.';};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!s.paused){hiddenHeld=true;E.pause(s,true);}else if(!document.hidden&&hiddenHeld){hiddenHeld=false;E.pause(s,false);}commit();});window.addEventListener('pagehide',()=>{E.pause(s,true);persist();});
if(started)$('feedback').textContent='Welcome back. Your work is restored; resume when ready.';commit();
setInterval(()=>{if(document.hidden||s.paused)return;const before=s.active?.id,lit=s.lit;E.tick(s);if(before&&!s.active)$('feedback').textContent=s.notice;if(!lit&&s.lit)$('feedback').textContent=s.notice;if(s.elapsed===300){E.pause(s,true);$('feedback').textContent='Five active minutes. Resume to stay, or reset for another watch.';}commit();},1000);
})();
