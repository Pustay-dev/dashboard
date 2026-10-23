const BASE=Deno.env.get('SUPABASE_URL')!;
const SECRET=Deno.env.get('APP_SECRET_KEY')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const origins=new Set(['https://jakub.pustay.cz','https://pustay-dev.github.io','https://nechsenakreslit.cz','https://www.nechsenakreslit.cz','http://localhost:4173']);
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
async function rest(path:string,method='GET',body?:unknown){
 const r=await fetch(BASE+'/rest/v1/'+path,{method,headers:{apikey:SECRET,'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
 if(!r.ok){const d=await r.json().catch(()=>({}));console.error('admin-database',path.split('?')[0],d.code||'',String(d.message||'').slice(0,180));const known=['SESSION_NOT_FOUND','SESSION_HAS_ORDERS','SESSION_HAS_ACTIVE_JOBS','SESSION_HAS_ACTIVE_UPLOAD','STORAGE_FILES_REMAIN','DELETION_NOT_STARTED'];throw Error(known.find(x=>String(d.message||'').includes(x))||'DATABASE_REQUEST_FAILED');}return r.status===204?null:r.json();
}

async function validCartReference(ref:unknown,sessionId:string,item:any){
 if(typeof ref!=='string'||ref.length>4096)return false;
 const secret=Deno.env.get('PORTRAIT_CHECKOUT_SECRET');if(!secret||secret.length<32)return false;
 try{
  const parts=ref.split('.');if(parts.length!==3||parts[0]!=='v1')return false;
  const decode=(v:string)=>Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const signature=decode(parts[2]);if(signature.length!==32)return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('HMAC',key,signature,new TextEncoder().encode('nsl-checkout.v1.'+parts[1])))return false;
  const p=JSON.parse(new TextDecoder().decode(decode(parts[1]))),now=Date.now()/1000;
  return p.v===1&&p.shop==='e1b5tx-eu'&&p.product_id==='16101561106776'&&p.session_id===sessionId&&p.image_id===item.image_id&&p.variant_id===String(item.variant_id)&&Number.isSafeInteger(p.issued_at)&&p.issued_at<=now+300&&p.issued_at>=now-7*86400;
 }catch{return false;}
}
async function recordCart(user:any,group:any){
 if(!uuid(group.session_id)||!Array.isArray(group.items)||group.items.length>100)throw Error('INVALID_CART');
 const items=group.items.map((i:any)=>({image_id:i.image_id,variant_id:String(i.variant_id).slice(0,30),title:String(i.title||'Portrait').slice(0,160),size:String(i.size||'').slice(0,80),quantity:Number(i.quantity),price:Number(i.price)}));
 if(items.some((i:any)=>!uuid(i.image_id)||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>100||!Number.isFinite(i.price)||i.price<0))throw Error('INVALID_CART');
 const access=await rest('session_access?select=session_id&session_id=eq.'+group.session_id+'&auth_user_id=eq.'+encodeURIComponent(user.id));
 if(!access.length){
  // The same checkout capability already permits the storefront's cart preview.
  // Here it only permits writing observations of those exact selected portraits.
  if(!items.length||!(await Promise.all(group.items.map((i:any)=>validCartReference(i.portrait_ref,group.session_id,i)))).every(Boolean))throw Error('SESSION_ACCESS_DENIED');
 }
 if(items.length){const ids=items.map((i:any)=>i.image_id).join(',');const owned=await rest('images?select=id&session_id=eq.'+group.session_id+'&id=in.('+ids+')');if(items.some((i:any)=>!owned.some((x:any)=>x.id===i.image_id)))throw Error('IMAGE_ACCESS_DENIED');}
 const exists=await rest('sessions?select=id,expires_at&admin_archived_at=is.null&id=eq.'+group.session_id);if(!exists.length)throw Error('SESSION_ACCESS_DENIED');
 const existing=await rest('nsl_admin_carts?select=session_id&session_id=eq.'+group.session_id);
 await rest('nsl_admin_carts'+(existing.length?'?session_id=eq.'+group.session_id:''),existing.length?'PATCH':'POST',{session_id:group.session_id,items,updated_at:new Date().toISOString()});
}

declare const EdgeRuntime:{waitUntil:(task:Promise<unknown>)=>void};
async function cleanupSession(sessionId:string,adminEmail:string,adminId:string){
 let claimed=false;
 try{
  if(!await rest('rpc/nsl_admin_deletion_ready','POST',{}))return;
  const at=new Date(),lease=new Date(at.getTime()+180000).toISOString();
  const rows=await rest('nsl_admin_deletions?session_id=eq.'+sessionId+'&or=(lease_until.is.null,lease_until.lt.'+at.toISOString()+')','PATCH',{lease_until:lease,last_error:null});
  if(!rows.length)return;claimed=true;
  const attempt=Number(rows[0].attempts||0)+1;
  await rest('nsl_admin_deletions?session_id=eq.'+sessionId,'PATCH',{attempts:attempt});
  const plan=await rest('rpc/nsl_admin_delete_session','POST',{p_session_id:sessionId,p_phase:'begin',p_actor:adminEmail});
   const buckets=new Map<string,string[]>();
   for(const f of plan.files){if(!buckets.has(f.bucket))buckets.set(f.bucket,[]);buckets.get(f.bucket)!.push(f.path);}
   for(const [bucket,paths] of buckets){
    for(let i=0;i<paths.length;i+=100){
     const r=await fetch(BASE+'/storage/v1/object/'+encodeURIComponent(bucket),{method:'DELETE',headers:{apikey:SECRET,'Content-Type':'application/json'},body:JSON.stringify({prefixes:paths.slice(i,i+100)}),signal:AbortSignal.timeout(15000)});
     if(!r.ok)throw Error('FILE_DELETE_FAILED_RETRY');
    }
   }
   for(const id of plan.auth_ids){
    if(!uuid(id)||id===adminId)continue;
    if((await rest('session_access?select=session_id&auth_user_id=eq.'+id+'&limit=1')).length)continue;
    const lookup=await fetch(BASE+'/auth/v1/admin/users/'+id,{headers:{apikey:SECRET},signal:AbortSignal.timeout(10000)});
    if(lookup.status===404)continue;if(!lookup.ok)throw Error('LOGIN_LOOKUP_FAILED_RETRY');
    const candidate=await lookup.json();if(!candidate.is_anonymous)continue;
    const r=await fetch(BASE+'/auth/v1/admin/users/'+id,{method:'DELETE',headers:{apikey:SECRET,'Content-Type':'application/json'},signal:AbortSignal.timeout(10000)});
    if(!r.ok&&r.status!==404)throw Error('LOGIN_DELETE_FAILED_RETRY');
   }

  await rest('rpc/nsl_admin_delete_session','POST',{p_session_id:sessionId,p_phase:'finish',p_actor:adminEmail});
 }catch(e){
  const error=e instanceof Error?e.message:'CLEANUP_FAILED';console.error('session-cleanup',error);
  if(claimed)await rest('nsl_admin_deletions?session_id=eq.'+sessionId,'PATCH',{lease_until:null,last_error:error}).catch(()=>{});
 }
}

Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',h={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://jakub.pustay.cz','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:h});
 if(origin&&!origins.has(origin))return reply(403,{error:'ORIGIN_NOT_ALLOWED'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:h});
 if(req.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
 try{
  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return reply(401,{error:'SIGN_IN_REQUIRED'});
  const userRes=await fetch(BASE+'/auth/v1/user',{headers:{apikey:SECRET,Authorization:auth},signal:AbortSignal.timeout(10000)});
  if(!userRes.ok)return reply(401,{error:'SIGN_IN_REQUIRED'});
  const user=await userRes.json();
  const raw=await req.text();if(raw.length>40000)return reply(413,{error:'REQUEST_TOO_LARGE'});
  const b=JSON.parse(raw||'{}');
  if(b.action==='cart_sync'||b.action==='cart_sync_batch'){
   const groups=b.action==='cart_sync'?[b]:b.groups;
   if(!Array.isArray(groups)||!groups.length||groups.length>30)return reply(400,{error:'INVALID_CART'});
   const saved=[],unavailable=[];
   for(const group of groups){try{await recordCart(user,group);saved.push(group.session_id);}catch(e){const code=e instanceof Error?e.message:'CART_SYNC_FAILED';if(['SESSION_ACCESS_DENIED','IMAGE_ACCESS_DENIED','INVALID_CART'].includes(code))unavailable.push({session_id:group?.session_id,error:code});else throw e;}}
   if(b.action==='cart_sync'&&unavailable.length)return reply(403,{error:unavailable[0].error});
   return reply(200,{ok:true,saved,unavailable});
  }
  if(user.is_anonymous||!user.email||!user.email_confirmed_at)return reply(403,{error:'ADMIN_ACCESS_REQUIRED'});
  const members=await rest('nsl_admin_members?select=email&email=eq.'+encodeURIComponent(user.email.toLowerCase()));
  if(!members.length)return reply(403,{error:'ADMIN_ACCESS_REQUIRED'});
  if(b.action==='clear_errors')return reply(200,{handled:await rest('rpc/nsl_admin_clear_errors','POST',{})});
  if(b.action==='delete_preview'){
   if(!uuid(b.session_id))return reply(400,{error:'INVALID_SESSION'});
   return reply(200,await rest('rpc/nsl_admin_delete_session','POST',{p_session_id:b.session_id,p_phase:'preview',p_actor:user.email}));
  }
  if(b.action==='delete_session'){
   if(!uuid(b.session_id)||b.confirmation!==b.session_id)return reply(400,{error:'DELETE_CONFIRMATION_REQUIRED'});
   if(!await rest('rpc/nsl_admin_deletion_ready','POST',{}))return reply(503,{error:'DELETE_SETUP_REQUIRED'});
   const plan=await rest('rpc/nsl_admin_delete_session','POST',{p_session_id:b.session_id,p_phase:'begin',p_actor:user.email});
   await rest('nsl_admin_deletions?session_id=eq.'+b.session_id,'PATCH',{attempts:0,last_error:null});
   EdgeRuntime.waitUntil(cleanupSession(b.session_id,user.email,user.id));
   return reply(202,{accepted:true,session_id:b.session_id});
  }
  if(b.action==='snapshot'){
   const data=await rest('rpc/nsl_admin_snapshot','POST',{});
   data.deletion_ready=await rest('rpc/nsl_admin_deletion_ready','POST',{});
   const jobs=await rest('nsl_admin_deletions?select=session_id,confirmed_by,attempts,last_error');
   data.deleting_sessions=jobs.map((j:any)=>j.session_id);data.deletion_issues=jobs.filter((j:any)=>j.last_error).map((j:any)=>({session_id:j.session_id}));
   for(const job of jobs)if(job.attempts<3)EdgeRuntime.waitUntil(cleanupSession(job.session_id,job.confirmed_by,user.id));
   return reply(200,data);
  }
  if(b.action==='label'){
   if(!uuid(b.session_id)||typeof b.label!=='string'||b.label.trim().length>80)return reply(400,{error:'INVALID_LABEL'});
   await rest('sessions?id=eq.'+b.session_id,'PATCH',{admin_label:b.label.trim()||null});return reply(200,{ok:true});
  }
  if(b.action==='gallery'){
   if(!uuid(b.session_id))return reply(400,{error:'INVALID_SESSION'});
   const offset=Math.max(0,Math.min(100000,Number(b.offset)||0));
   return reply(200,await rest('images?select=id,internal_reference,created_at&session_id=eq.'+b.session_id+'&order=created_at.desc&limit=30&offset='+offset));
  }
  if(b.action==='image'){
   if(!uuid(b.image_id))return reply(400,{error:'INVALID_IMAGE'});
   const rows=await rest('images?select=preview_path,original_path&id=eq.'+b.image_id);if(!rows.length)return reply(404,{error:'IMAGE_NOT_FOUND'});
   const bucket=b.original===true?'originals':'previews',path=rows[0][b.original===true?'original_path':'preview_path'];
   const encoded=path.split('/').map(encodeURIComponent).join('/');
   const r=await fetch(BASE+'/storage/v1/object/sign/'+bucket+'/'+encoded,{method:'POST',headers:{apikey:SECRET,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:900}),signal:AbortSignal.timeout(10000)});
   if(!r.ok)return reply(502,{error:'IMAGE_UNAVAILABLE'});const data=await r.json();const signed=data.signedURL||data.signedUrl;
   if(typeof signed!=='string'||!signed.startsWith('/object/sign/'))throw Error('INVALID_SIGNED_URL');
   return reply(200,{url:BASE+'/storage/v1'+signed,expires:Date.now()+840000});
  }
  if(b.action==='cart'){
   if(!uuid(b.session_id))return reply(400,{error:'INVALID_SESSION'});
   return reply(200,(await rest('nsl_admin_carts?select=items,updated_at&session_id=eq.'+b.session_id))[0]||null);
  }
  if(b.action==='retry_safe')return reply(200,{retried:await rest('rpc/nsl_admin_retry_safe','POST',{})});
  if(b.action==='finance'){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(b.day)||['revenue','ads','generation','printing','other'].some(k=>typeof b[k]!=='number'||!Number.isFinite(b[k])||b[k]<(k==='revenue'?-10000000:0)||b[k]>10000000))return reply(400,{error:'INVALID_COSTS'});
   const data={day:b.day,revenue:b.revenue,ads:b.ads,generation:b.generation,printing:b.printing,other:b.other,updated_at:new Date().toISOString()};
   const exists=await rest('nsl_admin_finance?select=day&day=eq.'+b.day);await rest('nsl_admin_finance'+(exists.length?'?day=eq.'+b.day:''),exists.length?'PATCH':'POST',data);return reply(200,{ok:true});
  }
  if(b.action==='complaint_add'){
   if(typeof b.subject!=='string'||!b.subject.trim()||b.subject.length>200||typeof b.email!=='string'||b.email.length>200)return reply(400,{error:'INVALID_COMPLAINT'});
   await rest('nsl_admin_complaints','POST',{subject:b.subject.trim(),email:b.email.trim()||null});return reply(200,{ok:true});
  }
  if(b.action==='complaint_resolve'&&uuid(b.id)){await rest('nsl_admin_complaints?id=eq.'+b.id,'PATCH',{resolved:true});return reply(200,{ok:true});}
  return reply(400,{error:'UNKNOWN_ACTION'});
 }catch(e){const code=e instanceof Error?e.message:'REQUEST_FAILED';console.error('admin-dashboard',code);if(['SESSION_NOT_FOUND','SESSION_HAS_ORDERS','SESSION_HAS_ACTIVE_JOBS','SESSION_HAS_ACTIVE_UPLOAD','STORAGE_FILES_REMAIN'].includes(code))return reply(409,{error:code});return reply(500,{error:'REQUEST_FAILED'});}
});
