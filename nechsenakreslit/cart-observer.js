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
   const groups=new Map([[state.session_id,[]]]);
   let previous=[];try{previous=JSON.parse(localStorage.getItem('nsl-admin-cart-groups-v1')||'[]');}catch{}
   if(Array.isArray(previous))for(const id of previous.slice(0,30))if(typeof id==='string'&&!groups.has(id))groups.set(id,[]);
   for(const i of cart.items){
    const id=i.properties?._portrait_session,image=i.properties?._portrait_image;if(!id||!image)continue;
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push({image_id:image,variant_id:String(i.variant_id),title:i.product_title||i.title,size:document.querySelector('nsl-portrait-creator [data-size] option[value="'+String(i.variant_id)+'"]')?.dataset?.dimensions||i.options_with_values?.find(o=>/size|velikost|rozm[eě]r/i.test(o.name))?.value||i.variant_title||'',quantity:i.quantity,price:i.final_price??i.price,portrait_ref:i.properties._portrait_ref});
   }
   const payload={action:'cart_sync_batch',groups:[...groups].slice(0,30).map(([session_id,items])=>({session_id,items}))};
   const signature=JSON.stringify(payload);if(signature===last&&Date.now()-lastSent<60000)return;
   const sent=await nativeFetch(base+'/functions/v1/admin-dashboard',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+state.auth.access_token,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
   const result=await sent.json().catch(()=>({}));if(!sent.ok)throw Error(result.error||'SNAPSHOT_'+sent.status);
   const unavailable=result.unavailable||[];diagnostic.unavailableSessions=unavailable.length;
   const remembered=[...groups].filter(([,items])=>items.length).map(([id])=>id);localStorage.setItem('nsl-admin-cart-groups-v1',JSON.stringify(remembered));
   last=signature;lastSent=Date.now();diagnostic.status='synced';diagnostic.lastSync=new Date().toISOString();diagnostic.lastError=null;
  }catch(e){diagnostic.status='error';diagnostic.lastError=e.message||'CONNECTION_FAILED';}finally{running=false;}
 }
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(sync,400);};
 try{const obs=new PerformanceObserver(list=>{if(list.getEntries().some(e=>{try{return new URL(e.name).origin===location.origin&&/\/cart\/(add|change|update|clear)(\.js)?$/.test(new URL(e.name).pathname);}catch{return false;}}))schedule();});obs.observe({type:'resource',buffered:true});}catch{}
 addEventListener('pageshow',schedule);addEventListener('storage',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});setInterval(schedule,10000);schedule();
})();
