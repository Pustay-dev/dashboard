// This source is embedded in the n8n Code nodes; it has no external dependencies.
function dateKey(now=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;
}
function shift(date,n){const d=new Date(date+'T12:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function week(date){return shift(date,-((new Date(date+'T12:00Z').getUTCDay()+6)%7))}
function clean(value,max=300){return String(value??'').slice(0,max)}
function validate(plan,start){
 if(!plan||plan.weekStart!==start||typeof plan.summary!=='string'||plan.summary.length>600||!Array.isArray(plan.days)||plan.days.length!==7)throw Error('Invalid weekly plan');
 const ids=['monday','mobility','wednesday','mobility','friday','rest','rest'];
 for(const [i,d] of plan.days.entries()){
  const w=d?.workout,max=i===0?65:i===1||i===3?15:i===5||i===6?0:25;
  if(d?.date!==shift(start,i)||!['meditation','mindset'].every(k=>typeof d[k]==='string'&&d[k].length>0&&d[k].length<=300)||w?.id!==ids[i]||typeof w.name!=='string'||w.name.length>90||typeof w.place!=='string'||w.place.length>80||!Number.isFinite(w.duration)||w.duration<0||w.duration>max||!Array.isArray(w.rows)||w.rows.length>10||(max===0?w.rows.length!==0:w.rows.length<1)||typeof w.note!=='string'||w.note.length>300)throw Error('Invalid workout day '+i);
  if(max>0&&!/warm|march|bike|mobility|joint/i.test(w.rows[0]?.name||''))throw Error('Missing warm-up');
  for(const r of w.rows)if(!['time','name','sets','rest','note','load'].every(k=>typeof r[k]==='string'&&r[k].length<=({name:90,time:32,sets:120,rest:80,note:300,load:80}[k])))throw Error('Invalid exercise');
 }
 return plan;
}
function starter(start){
 const med=['Feel the breath. Return gently when distracted.','Relax your shoulders and notice each breath.','Count ten natural breaths, then begin again.','Scan your body slowly from feet to face.','Notice thoughts without following them.','Listen to sounds without judging them.','Sit comfortably and let your breathing settle.'];
 const mind=['What is one small thing I can finish today?','What deserves my attention today?','What can I simplify today?','What would make today worthwhile?','Where can I choose action over more planning?','What is already going well?','What should I carry into next week?'];
 return {weekStart:start,summary:'Fixed plan active until the first weekly AI update.',days:Array.from({length:7},(_,i)=>{const date=shift(start,i),id=BASELINE.WEEK[new Date(date+'T12:00Z').getUTCDay()],w=JSON.parse(JSON.stringify(BASELINE.PLAN[id]));w.note=w.note||'';w.rows=w.rows.map(r=>({time:r.time,name:r.name,sets:r.sets,rest:r.rest||'',note:r.note||'',load:r.load||''}));return {date,meditation:med[i],mindset:mind[i],workout:w}})};
}
function availablePlan(state,start){
 if(state.weeks?.[start])return {...state.weeks[start],source:'AI weekly plan'};
 const previous=Object.keys(state.weeks||{}).filter(k=>k<start).sort().at(-1);
 if(previous){const p=JSON.parse(JSON.stringify(state.weeks[previous]));p.weekStart=start;p.days.forEach((d,i)=>d.date=shift(start,i));p.summary=('Using the last valid weekly plan. '+p.summary).slice(0,600);return {...p,source:'Previous valid AI plan'}}
 return {...starter(start),source:'Fixed starter plan'};
}
