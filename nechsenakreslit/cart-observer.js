// Operational cart snapshot only. No cart token, contact details or credentials leave the browser.
(()=>{
 if(window.NSLAdminCartObserver)return;window.NSLAdminCartObserver=true;
 const nativeFetch=window.fetch.bind(window),base='https://nfurbsycuufhfgfnaiej.supabase.co',key='sb_publishable_RB9ObHXkF_4p4Kc8VMGhhw_wg-nvzyW';let timer,running=false,last='';
 async function sync(){
  if(running||document.hidden)return;let state;try{state=JSON.parse(localStorage.getItem('nsl-creator-v1-nfurbsycuufhfgfnaiej')||'null');}catch{return;}
  if(!state?.session_id||!state.auth?.access_token||state.auth.expires_at*1000<Date.now()+15000)return;
  running=true;
  try{
   const root=window.Shopify?.routes?.root||'/';const r=await nativeFetch(root+'cart.js',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)return;
   const cart=await r.json();if(!Array.isArray(cart.items))return;
   const items=cart.items.filter(i=>i.properties?._portrait_session===state.session_id&&i.properties?._portrait_image).map(i=>({image_id:i.properties._portrait_image,variant_id:String(i.variant_id),title:i.product_title||i.title,quantity:i.quantity,price:i.final_price}));
   const signature=JSON.stringify({session_id:state.session_id,items});if(signature===last)return;
   const sent=await nativeFetch(base+'/functions/v1/admin-dashboard',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+state.auth.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'cart_sync',session_id:state.session_id,items}),signal:AbortSignal.timeout(8000)});if(sent.ok)last=signature;
  }catch{}finally{running=false;}
 }
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(sync,800);};
 // Observe completed cart writes without replacing fetch, changing requests or blocking checkout.
 try{const obs=new PerformanceObserver(list=>{if(list.getEntries().some(e=>{try{return new URL(e.name).origin===location.origin&&/\/cart\/(add|change|update|clear)(\.js)?$/.test(new URL(e.name).pathname);}catch{return false;}}))schedule();});obs.observe({type:'resource',buffered:true});}catch{}
 addEventListener('pageshow',schedule);addEventListener('storage',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});setInterval(schedule,30000);schedule();
})();
