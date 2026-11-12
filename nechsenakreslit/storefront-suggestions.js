/* Exact admin-selected variants, constrained by the creator's subject rules. */
(()=>{
 'use strict';
 if(window.__nslAdminSuggestions)return;window.__nslAdminSuggestions=true;
 const rules=new Map(),liveStyles=new Map();let refreshed=false,load=Promise.resolve();
 customElements.whenDefined('nsl-portrait-creator').then(()=>{
  load=Promise.resolve().then(()=>window.NSLCatalogue.refresh()).then(data=>{for(const s of data?.styles||[]){liveStyles.set(s.id,s);if(Array.isArray(s.suggested_style_ids))rules.set(s.id,s.suggested_style_ids);}refreshed=true;}).catch(()=>{});
  const proto=customElements.get('nsl-portrait-creator').prototype,original=proto.styleChoices;
  if(typeof original!=='function')return;
  proto.styleChoices=function(context){
   const result=original.call(this,context),source=this.styles.get(context.style_id),ids=rules.get(context.style_id)||source?.suggested_style_ids;
   if(!Array.isArray(ids)||!ids.length)return result;
   const count=Number(context.subject_count)||0,kinds=context.subject_kinds||[],person=kinds.includes('person'),pet=kinds.some(k=>['animal','pet'].includes(k));
   const eligible=s=>s&&s.id!==context.style_id&&!s.pending&&!s.landing_only&&(!refreshed||liveStyles.has(s.id))&&count<=s.max_subjects&&!(person&&s.subject_type==='pet')&&!(pet&&s.subject_type==='human')&&!(count===1&&(s.placements||[]).filter(p=>!['popular','occupations'].includes(p.category_id)).length&&(s.placements||[]).filter(p=>!['popular','occupations'].includes(p.category_id)).every(p=>['couples','family'].includes(p.category_id)));
   const chosen=[];
   for(const id of ids){const known=this.styles.get(id),s=known?{...known,...liveStyles.get(id)}:null;if(!eligible(s)||chosen.some(v=>v.id===id))continue;const artwork=s.example_image_url||(s.placements||[]).find(p=>p.example_image_url)?.example_image_url;if(artwork)chosen.push({...s,example_image_url:artwork});}
   return {ranked:chosen,remaining:[...result.ranked,...result.remaining].filter(s=>!chosen.some(v=>v.id===s.id))};
  };
  const open=proto.openStyleMenu;
  if(typeof open==='function')proto.openStyleMenu=async function(...args){await load;return open.apply(this,args);};
 });
})();
