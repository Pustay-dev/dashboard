export const clone=o=>JSON.parse(JSON.stringify(o));
export const pct=n=>Math.max(0,Math.min(100,Number(n)||0));
export function dayKey(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
export function shiftDay(d,n){const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)}
export function weekday(d){return new Date(d+'T12:00:00Z').getUTCDay()}
export function activeActivities(s){return s.activities.filter(a=>!a.archived)}
export function checkPct(s){const a=activeActivities(s),total=a.reduce((n,x)=>n+(Number(x.target)||0),0);return total?pct(a.reduce((n,x)=>n+(Number(x.progress)||0),0)/total*100):0}
export function normalizeCheck(s,today=dayKey()){
 s=clone(s);s.activities=Array.isArray(s.activities)?s.activities:[];
 const old=s.days?Object.values(s.days).at(-1)||{}:{};
 for(const a of s.activities){a.progress=Number(a.progress??old[a.id])||0;a.archived=!!a.archived;a.locked=!!a.locked}
 delete s.days;s.pending=s.pending||[];s.history=s.history||{};s.todos=s.todos||[];
 if(s.lastDate&&s.lastDate<today){
  const p=Math.round(checkPct(s));let d=s.lastDate;
  while(d<today){if(typeof s.history[d]!=='number')s.history[d]=p;d=shiftDay(d,1)}
  for(const a of activeActivities(s))if(Number(a.target)>0&&a.progress>=a.target)a.archived=true;
  const promote=s.pending.filter(a=>a.queuedOn<today);
  s.activities.push(...promote.map(a=>({...a,progress:0,archived:false,locked:true})));
  s.pending=s.pending.filter(a=>a.queuedOn>=today);
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
