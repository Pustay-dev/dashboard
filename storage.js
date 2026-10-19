import {clone,validRecord} from './core.js';
const CONFIG={check:{bin:'6a9b3c7dda38895dfe3a22ef',legacy:'daily_checkin_v1'},road:{bin:'6a9a937ada38895dfe37c125',legacy:'roadmap_state_cache'},body:{bin:'6a9c92e0da38895dfe3df482',legacy:'BODY_DASH_V4'}};
export class Records{
 constructor(defaults,storage,fetcher=globalThis.fetch){this.storage=storage;this.fetcher=fetcher;this.slots={};this.chain=Promise.resolve();this.onchange=()=>{};this.key=storage.getItem('jp_cloud_key')||'';
  for(const [kind,seed] of Object.entries(defaults)){
   let saved=this.read('jp_'+kind),legacy=this.read(CONFIG[kind].legacy);
   // Preserve unsent edits from the previous roadmap implementation.
   if(kind==='road'){const pending=this.read('roadmap_pending_v2');if(validRecord(kind,pending?.state)&&!saved)saved={data:pending.state,base:pending.baseText,dirty:true,established:true}}
   const data=validRecord(kind,saved?.data)?saved.data:validRecord(kind,legacy)?legacy:clone(seed);
   this.slots[kind]={data,base:saved?.base??null,dirty:!!saved?.dirty,established:saved?.established??!!legacy,status:'local'};
  }
 }
 read(k){try{return JSON.parse(this.storage.getItem(k)||'null')}catch{return null}}
 persist(kind){const s=this.slots[kind];this.storage.setItem('jp_'+kind,JSON.stringify(s));this.storage.setItem(CONFIG[kind].legacy,JSON.stringify(s.data))}
 get(kind){return this.slots[kind].data}
 edit(kind,fn){fn(this.slots[kind].data);this.slots[kind].dirty=true;this.slots[kind].established=true;this.slots[kind].status=this.key?'pending':'local';this.persist(kind);this.onchange();if(this.key)this.sync(kind)}
 async remote(kind){const res=await this.fetcher(`https://api.jsonbin.io/v3/b/${CONFIG[kind].bin}/latest`,{headers:{'X-Master-Key':this.key},cache:'no-store',signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error('Cloud read failed ('+res.status+')');const j=await res.json();const r=j.record??j;if(!validRecord(kind,r))throw Error('Cloud returned invalid data');return r}
 sync(kind){const task=async()=>{
  const run=async()=>{const s=this.slots[kind];if(!this.key)return;
   try{const r=await this.remote(kind),text=JSON.stringify(r);
    if(s.dirty){
     if(JSON.stringify(s.data)===text){s.base=text;s.dirty=false;s.status='synced'}
     else if(s.base!==text){s.status='conflict';this.persist(kind);this.onchange();return}
     else{const sent=JSON.stringify(s.data);const res=await this.fetcher(`https://api.jsonbin.io/v3/b/${CONFIG[kind].bin}`,{method:'PUT',headers:{'X-Master-Key':this.key,'Content-Type':'application/json'},body:sent,signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error('Cloud save failed ('+res.status+')');s.base=sent;s.dirty=JSON.stringify(s.data)!==sent;s.status=s.dirty?'pending':'synced'}
    }else{s.data=r;s.base=text;s.status='synced';s.established=true}
    this.persist(kind);
   }catch(e){s.status='offline';s.error=e.message;this.persist(kind)}this.onchange();
  };
  if(globalThis.navigator?.locks)return navigator.locks.request('jp-cloud-'+kind,run);return run();
 };this.chain=this.chain.then(task,task);return this.chain}
 async connect(key){this.key=key.trim();this.storage.setItem('jp_cloud_key',this.key);if(!this.key)return;for(const kind of Object.keys(this.slots))await this.sync(kind)}
 async useCloud(kind){const r=await this.remote(kind);this.slots[kind]={data:r,base:JSON.stringify(r),dirty:false,established:true,status:'synced'};this.persist(kind);this.onchange()}
 export(){return {version:1,exportedAt:new Date().toISOString(),check:clone(this.get('check')),road:clone(this.get('road')),body:clone(this.get('body'))}}
 import(data){for(const k of ['check','road','body'])if(!validRecord(k,data[k]))throw Error('This is not a complete jakub.pustay backup');for(const k of ['check','road','body']){const s=this.slots[k];s.data=clone(data[k]);s.dirty=true;s.established=true;s.status=this.key?'pending':'local';this.persist(k)}this.onchange()}
}
