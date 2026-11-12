/* Optional storefront bridge. Load once, after the existing creator scripts. */
(()=>{
 'use strict';
 if(window.__nslAdminSuggestions)return;window.__nslAdminSuggestions=true;
 const rules=new Map();
 let load=Promise.resolve();
 customElements.whenDefined('nsl-portrait-creator').then(()=>{
  load=Promise.resolve().then(()=>window.NSLCatalogue.refresh()).then(data=>{for(const s of data?.styles||[])if(Array.isArray(s.suggested_style_ids))rules.set(s.id,s.suggested_style_ids);}).catch(()=>{});
  const proto=customElements.get('nsl-portrait-creator').prototype,original=proto.styleChoices;
  if(typeof original!=='function')return;
  proto.styleChoices=function(context){
   const result=original.call(this,context),source=this.styles.get(context.style_id),ids=rules.get(context.style_id)||source?.suggested_style_ids;
   if(!Array.isArray(ids)||!ids.length)return result;
   const candidates=[...result.ranked,...result.remaining],key=s=>window.NSLCatalogue.familyKey(s).replace(/^(family|style):/,'');
   const chosen=[];for(const id of ids){const style=candidates.find(s=>key(s)===id||s.id===id);if(style&&!chosen.includes(style))chosen.push(style);}
   return {ranked:chosen,remaining:candidates.filter(s=>!chosen.includes(s))};
  };
  // Resolve the public rules before opening; failures preserve the original choices.
  const open=proto.openStyleMenu;
  if(typeof open==='function')proto.openStyleMenu=async function(...args){await load;return open.apply(this,args);};
 });
})();
