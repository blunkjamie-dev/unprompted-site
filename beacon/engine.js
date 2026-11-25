(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KeeperEngine=api;})(globalThis,()=>{
  'use strict';
  const TYPES=['wedge','bell','shutter'], STATES=['queued','active','waiting-ready','completed','cancelled'];
  const STEPS=[['inspect',15],['polish-1',35],['polish-2',35],['polish-3',35],['seat',10],['ready',12]];
  const validId=x=>typeof x==='string'&&/^[\w.:-]{1,80}$/.test(x);
  function create(watchId){if(!validId(watchId))throw Error('Watch ID required');return {version:2,watchId,revision:0,attempt:0,elapsed:0,paused:false,step:0,remaining:15,segments:[0,0,0],aligned:false,seated:false,lit:false,verified:false,tidy:0,bells:0,queue:[],active:null,ledger:[],notice:'The beam is low. I’ll prepare the lens; you can level the mount.'};}
  const entry=(s,id)=>s.ledger.find(e=>e.id===id);
  const token=s=>`${s.watchId}:${++s.attempt}`;
  function start(s){if(s.paused||s.active||!s.queue.length)return;const id=s.queue.shift(),e=entry(s,id);e.status='active';s.active={id,type:e.type,remaining:e.type==='bell'?7:4,token:token(s)};s.notice=e.type==='bell'?'Cloth parked. Checking the window; this exact patch can wait.':e.type==='wedge'?'Sliding the copper wedge beneath the mount.':'Checking the shutter latch and the lens readiness.';}
  function dispatch(s,event){
    if(!event||!validId(event.id)||!TYPES.includes(event.type))return {accepted:false,reason:'invalid-event'};
    const old=entry(s,event.id);if(old)return {accepted:false,reason:'duplicate',status:old.status};
    if(s.ledger.length>=1000)return {accepted:false,reason:'ledger-full'};
    const held=s.ledger.filter(e=>e.status==='waiting-ready').length;
    const reserve=s.active?.type==='shutter'&&(!s.aligned||!s.seated)?1:0;
    if(s.queue.length+held+reserve>=3)return {accepted:false,reason:'queue-full'};
    s.ledger.push({id:event.id,type:event.type,status:'queued'});s.queue.push(event.id);s.revision++;start(s);return {accepted:true,status:entry(s,event.id).status};
  }
  function openIfReady(s){if(!s.aligned||!s.seated)return;const waiting=s.ledger.filter(e=>e.status==='waiting-ready');if(!waiting.length)return;s.lit=true;waiting.forEach(e=>e.status='completed');s.notice='There. The boat has its light. Now I’ll check the windows.';}
  function complete(s,callbackToken){
    if(s.paused||!s.active||s.active.token!==callbackToken||s.active.remaining!==0)return false;
    const e=entry(s,s.active.id);e.status='completed';
    if(e.type==='wedge'){s.aligned=true;s.notice='Mount level. The beam now points toward the boat.';}
    if(e.type==='bell'){s.bells++;s.notice='All quiet at the window. Back to the exact patch I left.';}
    if(e.type==='shutter'){
      if(s.aligned&&s.seated){s.lit=true;s.notice='Shutter open. The boat windows are glowing.';}
      else {e.status='waiting-ready';s.notice='Opening requested, not open yet. I’ll release it once the mount and lens are ready.';}
    }
    s.active=null;openIfReady(s);s.revision++;start(s);return true;
  }
  function tick(s){
    if(s.paused)return s;s.elapsed++;s.revision++;start(s);
    if(s.active){s.active.remaining--;complete(s,s.active.token);return s;}
    s.remaining--;
    if(s.step>=1&&s.step<=3)s.segments[s.step-1]=35-s.remaining;
    if(s.remaining===0){
      if(s.step<5){s.step++;s.remaining=STEPS[s.step][1];if(s.step===5)s.seated=true;}
      else {s.remaining=12;if(s.lit){if(!s.verified)s.verified=true;else s.tidy++;}}
      openIfReady(s);
    }
    return s;
  }
  function pause(s,value){const next=!!value;if(s.paused===next)return s;s.paused=next;s.revision++;if(s.active)s.active.token=token(s);if(!next)start(s);return s;}
  function cancel(s){
    let count=0;for(const e of s.ledger)if(['queued','active','waiting-ready'].includes(e.status)){e.status='cancelled';count++;}
    s.active=null;s.queue=[];s.attempt++;s.revision++;s.notice=count?'Pending visits cancelled. Finished work stays in place.':'No pending visits. Finished work stays in place.';return count;
  }
  function validate(v){
    const int=(n,max=Number.MAX_SAFE_INTEGER-1000)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
    if(!v||v.version!==2||!validId(v.watchId)||!int(v.revision)||!int(v.attempt)||!int(v.elapsed)||typeof v.paused!=='boolean'||!int(v.step,5)||!int(v.remaining,STEPS[v.step][1])||v.remaining<1)return null;
    if(!['aligned','seated','lit','verified'].every(k=>typeof v[k]==='boolean')||!int(v.tidy)||!int(v.bells,1000))return null;
    if(v.seated!==(v.step===5)||v.lit&&(!v.aligned||!v.seated)||v.verified&&!v.lit)return null;
    if(!Array.isArray(v.segments)||v.segments.length!==3||!v.segments.every(x=>int(x,35)))return null;
    for(let i=0;i<3;i++){const expected=v.step>i+1?35:v.step===i+1?35-v.remaining:0;if(v.segments[i]!==expected)return null;}
    if(!Array.isArray(v.ledger)||v.ledger.length>1000||!v.ledger.every(e=>e&&validId(e.id)&&TYPES.includes(e.type)&&STATES.includes(e.status))||new Set(v.ledger.map(e=>e.id)).size!==v.ledger.length)return null;
    if(v.ledger.some(e=>e.status==='waiting-ready'&&(e.type!=='shutter'||v.lit)))return null;
    if(!Array.isArray(v.queue)||v.queue.length>3||new Set(v.queue).size!==v.queue.length||!v.queue.every(id=>entry(v,id)?.status==='queued'))return null;
    if(v.ledger.filter(e=>e.status==='queued').length!==v.queue.length)return null;
    if(v.queue.length+v.ledger.filter(e=>e.status==='waiting-ready').length>3)return null;
    if(v.active!==null){const a=v.active;if(!a||!validId(a.id)||!TYPES.includes(a.type)||!int(a.remaining,a.type==='bell'?7:4)||a.remaining<1||a.token!==`${v.watchId}:${v.attempt}`||entry(v,a.id)?.status!=='active'||entry(v,a.id)?.type!==a.type)return null;}
    if(v.ledger.filter(e=>e.status==='active').length!==(v.active?1:0))return null;
    if(typeof v.notice!=='string'||v.notice.length>250)return null;
    // Only serialized known fields survive the persistence boundary.
    return {version:2,watchId:v.watchId,revision:v.revision,attempt:v.attempt,elapsed:v.elapsed,paused:v.paused,step:v.step,remaining:v.remaining,segments:[...v.segments],aligned:v.aligned,seated:v.seated,lit:v.lit,verified:v.verified,tidy:v.tidy,bells:v.bells,queue:[...v.queue],active:v.active?{id:v.active.id,type:v.active.type,remaining:v.active.remaining,token:v.active.token}:null,ledger:v.ledger.map(e=>({id:e.id,type:e.type,status:e.status})),notice:v.notice};
  }
  function serialize(s){const clean=validate(s);if(!clean)throw Error('Invalid watch');return JSON.stringify(clean);}
  function restore(raw){if(typeof raw!=='string'||raw.length>300000)return null;try{const s=validate(JSON.parse(raw));if(s){s.revision++;if(s.active)s.active.token=token(s);}return s;}catch{return null;}}
  function activity(s){if(s.active)return {wedge:'Leveling the mount',bell:'Inspecting the window',shutter:'Checking the shutter'}[s.active.type];if(s.step===5)return s.verified?'Tidying the light station':s.lit?'Verifying the boat windows':'Keeping the finished lens clear';return ['Checking where the beam misses','Polishing lens · patch 1 of 3','Polishing lens · patch 2 of 3','Polishing lens · patch 3 of 3','Seating the finished lens'][s.step];}
  return {create,dispatch,tick,pause,cancel,complete,serialize,restore,activity};
});
