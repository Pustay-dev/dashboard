export const clone=o=>JSON.parse(JSON.stringify(o));
export const pct=n=>Math.max(0,Math.min(100,Number(n)||0));
export function dayKey(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
export function shiftDay(d,n){const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)}
export function weekday(d){return new Date(d+'T12:00:00Z').getUTCDay()}
export function activeActivities(s){return s.activities.filter(a=>!a.archived)}
export function checkPct(s){const a=activeActivities(s),total=a.reduce((n,x)=>n+(Number(x.target)||0),0);return total?pct(a.reduce((n,x)=>n+Math.min(Number(x.target)||0,Math.max(0,Number(x.progress)||0)),0)/total*100):0}
export function normalizeCheck(s,today=dayKey()){
 s=clone(s);s.activities=Array.isArray(s.activities)?s.activities:[];
 const old=s.days?Object.values(s.days).at(-1)||{}:{};
 const start=s.lastDate||today;
 for(const a of s.activities){a.progress=Math.min(Number(a.target)||0,Math.max(0,Number(a.progress??old[a.id])||0));a.archived=!!a.archived;a.locked=!!a.locked;a.createdOn=a.createdOn||start}
 delete s.days;s.pending=s.pending||[];s.history=s.history||{};s.todos=s.todos||[];
 for(const a of s.pending)a.scheduledFor=a.scheduledFor||(a.queuedOn?shiftDay(a.queuedOn,1):today);
 function activate(date){const due=s.pending.filter(a=>a.scheduledFor<=date);s.activities.push(...due.map(a=>({...a,createdOn:a.createdOn||a.queuedOn||a.scheduledFor,progress:Number(a.progress)||0,archived:false,locked:true})));s.pending=s.pending.filter(a=>a.scheduledFor>date)}
 activate(start);
 let cursor=start;
 while(cursor<today){
  if(typeof s.history[cursor]!=='number')s.history[cursor]=Math.round(checkPct(s));
  for(const a of activeActivities(s)){if(Number(a.target)>0&&a.progress>=a.target)a.archived=true;else a.locked=true}
  cursor=shiftDay(cursor,1);activate(cursor);
 }
 activate(today);
 for(const a of activeActivities(s))if(a.createdOn<today)a.locked=true;
 // Legacy quick tasks now share the main activity list; retain the originals for backups.
 for(const t of s.todos){if(t.migratedToActivity)continue;const id='quick-'+t.id;
  if(!s.activities.some(a=>a.id===id))s.activities.push({id,name:t.text,target:15,progress:t.done?15:0,archived:!!t.done,locked:start<today,createdOn:start,kind:'quick'});
  t.migratedToActivity=id;
 }
 s.lastDate=today;return s;
}
export function roadPct(s){const all=s.phases.flatMap(p=>p.tasks||[]);return all.length?all.reduce((n,t)=>n+pct(t.pct),0)/all.length:0}
export function nextTasks(s,today=dayKey()){
 let i=s.phases.findIndex(p=>p.tasks.some(t=>pct(t.pct)<100));if(i<0)return [];
 const candidates=s.phases[i].tasks.map((t,j)=>({...t,pi:i,ti:j})).filter(t=>pct(t.pct)<100);
 return candidates.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,3);
}
export function latestValues(rows,fields){return Object.fromEntries(fields.map(k=>[k,[...rows].sort((a,b)=>a.date.localeCompare(b.date)).reverse().find(r=>r[k]!=null)?.[k]??null]))}
export function validRecord(kind,r){
 if(!r||typeof r!=='object'||Array.isArray(r))return false;
 if(kind==='check')return Array.isArray(r.activities)&&r.activities.every(a=>a&&typeof a.name==='string'&&Number.isFinite(a.target)&&a.target>0);
 if(kind==='body')return ['measurements','performance','workouts'].every(k=>Array.isArray(r[k]));
 return Array.isArray(r.phases)&&r.phases.length>0&&r.phases.every(p=>p&&typeof p.title==='string'&&Array.isArray(p.tasks)&&p.tasks.every(t=>t&&typeof t.title==='string'&&Number.isFinite(t.pct)&&t.pct>=0&&t.pct<=100));
}

export function canRemoveActivity(a,today=dayKey()){
 return !!a&&!a.locked&&(!a.createdOn||a.createdOn>=today)&&(!a.scheduledFor||a.scheduledFor>today);
}
export function scheduleActivity(s,activity,date,today=dayKey()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<today)throw Error('Choose today or a future date');
 const a={...activity,progress:0,archived:false,locked:false,createdOn:today};
 if(date===today)s.activities.push(a);else s.pending.push({...a,scheduledFor:date});
}
export function removeActivity(s,id,today=dayKey()){
 const a=s.activities.find(a=>a.id===id);if(!canRemoveActivity(a,today))return false;a.archived=true;return true;
}
export function roadmapStatus(s,today=dayKey()){
 const overdue=s.phases.flatMap(p=>p.tasks||[]).filter(t=>t.due&&t.due<today&&pct(t.pct)<100);
 return {behind:overdue.length>0,count:overdue.length,days:overdue.length?Math.round((new Date(today+'T12:00Z')-new Date(overdue.map(t=>t.due).sort()[0]+'T12:00Z'))/86400000):0};
}
// Monotone cubic interpolation: a smooth curve that stays inside the data's bounds.
export function smoothPath(points){
 if(!points.length)return '';if(points.length===1)return `M${points[0][0]},${points[0][1]}`;
 const d=points.slice(1).map((p,i)=>(p[1]-points[i][1])/(p[0]-points[i][0]));
 const m=points.map((p,i)=>i===0?d[0]:i===points.length-1?d.at(-1):(d[i-1]*d[i]<=0?0:2*d[i-1]*d[i]/(d[i-1]+d[i])));
 let path=`M${points[0][0]},${points[0][1]}`;
 for(let i=0;i<points.length-1;i++){const [x,y]=points[i],[nx,ny]=points[i+1],h=(nx-x)/3;path+=` C${x+h},${y+h*m[i]} ${nx-h},${ny-h*m[i+1]} ${nx},${ny}`}
 return path;
}
export function dailyAffirmation(date,items,storage,random=Math.random){
 let saved={};try{saved=JSON.parse(storage.getItem('jp_daily_affirmations')||'{}')}catch{}
 if(Number.isInteger(saved[date])&&saved[date]>=0&&saved[date]<items.length)return items[saved[date]];
 const previous=saved[shiftDay(date,-1)];const choices=items.map((_,i)=>i).filter(i=>items.length===1||i!==previous);
 const index=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];saved[date]=index;
 const dates=Object.keys(saved).sort().slice(-60);try{storage.setItem('jp_daily_affirmations',JSON.stringify(Object.fromEntries(dates.map(d=>[d,saved[d]]))))}catch{}
 return items[index];
}
