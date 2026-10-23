export const dayKey=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function financials(m,today=dayKey()){
 const costs=m.costs||[],daily=costs.find(x=>x.day===today),sum=x=>Number(x.ads)+Number(x.generation)+Number(x.printing)+Number(x.other);
 const first=m.first_day||today;let complete=true;
 for(let d=new Date(first+'T12:00:00Z');d.toISOString().slice(0,10)<=today;d.setUTCDate(d.getUTCDate()+1)){
  if(!costs.some(x=>x.day===d.toISOString().slice(0,10))){complete=false;break;}
 }
 const totalCost=costs.filter(x=>x.day>=first&&x.day<=today).reduce((n,x)=>n+sum(x),0);
 const known=costs.every(x=>Number.isFinite(Number(x.revenue)));
 return {today:daily&&known?Number(daily.revenue)-sum(daily):null,total:complete&&known?costs.filter(x=>x.day>=first&&x.day<=today).reduce((n,x)=>n+Number(x.revenue),0)-totalCost:null,perPrint:complete&&known&&m.prints>0?totalCost/m.prints:null,complete,missingDays:!complete};
}
export function selectSessions(rows,{sort='activity',filter='active',search=''}={}){
 const q=search.trim().toLowerCase();
 const predicates={active:s=>!s.admin_archived_at,today:s=>s.gen_today>0,gallery:s=>s.gallery_count>0,cart:s=>s.cart_count>0,buyers:s=>Number(s.spent)>0,errors:s=>s.errors>0,archived:s=>!!s.admin_archived_at,all:()=>true};
 const ts=x=>x?Date.parse(x):0;
 const compare={activity:(a,b)=>ts(b.last_activity)-ts(a.last_activity),buy:(a,b)=>ts(b.last_purchase)-ts(a.last_purchase),spent:(a,b)=>Number(b.spent)-Number(a.spent),gallery:(a,b)=>b.gallery_count-a.gallery_count,today:(a,b)=>b.gen_today-a.gen_today,newest:(a,b)=>ts(b.created_at)-ts(a.created_at),oldest:(a,b)=>ts(a.created_at)-ts(b.created_at),name:(a,b)=>(a.admin_label||a.default_label).localeCompare(b.admin_label||b.default_label)}[sort];
 return rows.filter(predicates[filter]||predicates.active).filter(s=>!q||[s.admin_label,s.default_label,s.id].some(x=>String(x||'').toLowerCase().includes(q))).sort((a,b)=>(compare||compareActivity)(a,b)||a.id.localeCompare(b.id));
}
const compareActivity=(a,b)=>Date.parse(b.last_activity||0)-Date.parse(a.last_activity||0);

export function cartSize(item){
 const known={'58853928042840':'45 × 30 cm','58772755317080':'60 × 40 cm','58772755284312':'60 × 90 cm'};
 return (/\d+\s*[×x]\s*\d+/.test(item.size||'')?item.size:known[String(item.variant_id)])||item.size||'Size unavailable';
}
