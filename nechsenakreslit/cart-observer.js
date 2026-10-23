// Operational cart snapshots. No cart tokens or customer contact details are sent.
(()=>{
 if(window.NSLAdminCartObserver)return;
 const diagnostic=window.NSLAdminCartObserver={status:'starting',lastSync:null,lastError:null};
 const nativeFetch=window.fetch.bind(window),base='https://nfurbsycuufhfgfnaiej.supabase.co',key='sb_publishable_RB9ObHXkF_4p4Kc8VMGhhw_wg-nvzyW',storageKey='nsl-creator-v1-nfurbsycuufhfgfnaiej';let timer,running=false,last='',lastSent=0;
 const read=()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'null');}catch{return null;}};
 async function visitor(){
  let state=read();if(!state?.session_id||!state.auth?.access_token){diagnostic.status='waiting_for_session';return null;}
  if(state.auth.expires_at*1000>Date.now()+15000)return state;
  // Reuse the creator's own refresh when present. Never create another customer login.
  const creator=document.querySelector('nsl-portrait-creator');
  if(creator?.auth){await creator.auth();return read();}
  if(!state.auth.refresh_token){diagnostic.status='waiting_for_login';return null;}
  const before=state.auth.refresh_token;
  const r=await nativeFetch(base+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:before}),signal:AbortSignal.timeout(10000)});
  if(!r.ok){diagnostic.status='waiting_for_login';diagnostic.lastError='VISITOR_REFRESH_'+r.status;return null;}
  const d=await r.json(),latest=read();if(!d.access_token||!d.refresh_token||latest?.session_id!==state.session_id)return null;
  // Preserve all concurrent creator edits and use a newer login if another tab refreshed first.
  if(latest.auth.refresh_token!==before&&latest.auth.expires_at*1000>Date.now()+15000)return latest;
  latest.auth={access_token:d.access_token,refresh_token:d.refresh_token,expires_at:d.expires_at||Math.floor(Date.now()/1000)+d.expires_in,user_id:d.user?.id||latest.auth.user_id};
  localStorage.setItem(storageKey,JSON.stringify(latest));return latest;
 }
 async function sync(){
  if(running||document.hidden)return;running=true;
  try{
   const state=await visitor();if(!state)return;
   const root=window.Shopify?.routes?.root||'/';const r=await nativeFetch(root+'cart.js',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('CART_READ_'+r.status);
   const cart=await r.json();if(!Array.isArray(cart.items))throw Error('INVALID_CART_RESPONSE');
   const items=cart.items.filter(i=>i.properties?._portrait_session===state.session_id&&i.properties?._portrait_image).map(i=>({image_id:i.properties._portrait_image,variant_id:String(i.variant_id),title:i.product_title||i.title,size:document.querySelector('nsl-portrait-creator [data-size] option[value=\"'+String(i.variant_id)+'\"]')?.dataset?.dimensions||i.options_with_values?.find(o=>/size|velikost|rozm[eě]r/i.test(o.name))?.value||i.variant_title||'',quantity:i.quantity,price:i.final_price??i.price}));
   const signature=JSON.stringify({session_id:state.session_id,items});if(signature===last&&Date.now()-lastSent<60000)return;
   const sent=await nativeFetch(base+'/functions/v1/admin-dashboard',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+state.auth.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'cart_sync',session_id:state.session_id,items}),signal:AbortSignal.timeout(10000)});
   if(!sent.ok){const data=await sent.json().catch(()=>({}));throw Error(data.error||'SNAPSHOT_'+sent.status);}
   last=signature;lastSent=Date.now();diagnostic.status='synced';diagnostic.lastSync=new Date().toISOString();diagnostic.lastError=null;
  }catch(e){diagnostic.status='error';diagnostic.lastError=e.message||'CONNECTION_FAILED';}finally{running=false;}
 }
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(sync,400);};
 try{const obs=new PerformanceObserver(list=>{if(list.getEntries().some(e=>{try{return new URL(e.name).origin===location.origin&&/\/cart\/(add|change|update|clear)(\.js)?$/.test(new URL(e.name).pathname);}catch{return false;}}))schedule();});obs.observe({type:'resource',buffered:true});}catch{}
 addEventListener('pageshow',schedule);addEventListener('storage',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});setInterval(schedule,10000);schedule();
})();
