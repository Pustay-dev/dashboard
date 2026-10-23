import assert from 'node:assert/strict';
let handler,finish=false,releaseStorage;const tasks=[];
globalThis.Deno={env:{get:k=>k==='SUPABASE_URL'?'https://test.supabase.co':'secret'},serve:f=>handler=f};globalThis.EdgeRuntime={waitUntil:p=>tasks.push(p)};
globalThis.fetch=async(url,opts)=>{
 const u=String(url);
 if(String(url).endsWith('/rpc/nsl_admin_deletion_ready'))return Response.json(true);if(u.endsWith('/auth/v1/user'))return Response.json({id:'admin',email:'admin@example.com',email_confirmed_at:'today'});
 if(u.includes('/nsl_admin_members?'))return Response.json([{}]);
 if(u.includes('/nsl_admin_deletions?'))return Response.json([{attempts:0}]);
 if(u.endsWith('/rpc/nsl_admin_delete_session')){const b=JSON.parse(opts.body);if(b.p_phase==='finish'){finish=true;return Response.json({deleted:true});}return Response.json({files:[{bucket:'previews',path:'session/image.webp'}],auth_ids:[]});}
 if(u.endsWith('/storage/v1/object/previews'))return new Promise(r=>releaseStorage=()=>r(Response.json({})));throw Error('Unexpected URL');
};
await import('../supabase/index.ts');
const id='00000000-0000-4000-8000-000000000001';
const response=await handler(new Request('https://test/delete',{method:'POST',headers:{origin:'https://jakub.pustay.cz',authorization:'Bearer test'},body:JSON.stringify({action:'delete_session',session_id:id,confirmation:id})}));
assert.equal(response.status,202);assert.equal(finish,false);assert.equal(tasks.length,1);
for(let i=0;i<20&&!releaseStorage;i++)await new Promise(r=>setTimeout(r,0));assert.equal(typeof releaseStorage,'function');releaseStorage();await Promise.all(tasks);assert.equal(finish,true);console.log('PASS: delete returns 202 before file removal; the registered background task completes cleanup afterward.');
