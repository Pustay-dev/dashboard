import assert from 'node:assert/strict';
let handler;const tasks=[],patches=[];
const id='00000000-0000-4000-8000-000000000001';
let job={session_id:id,confirmed_by:'admin@example.com',attempts:3,last_error:'LOGIN_DELETE_FAILED_RETRY',dismissed_at:null,sessions:{internal_number:34,admin_label:null}};
globalThis.Deno={env:{get:k=>k==='SUPABASE_URL'?'https://test.supabase.co':'secret'},serve:f=>handler=f};
globalThis.EdgeRuntime={waitUntil:p=>tasks.push(p)};
globalThis.fetch=async(url,opts)=>{
 const u=String(url);
 if(u.endsWith('/auth/v1/user'))return Response.json({id:'admin',email:'admin@example.com',email_confirmed_at:'today'});
 if(u.includes('/nsl_admin_members?'))return Response.json([{}]);
 if(u.endsWith('/rpc/nsl_admin_deletion_ready'))return Response.json(true);
 if(u.endsWith('/rpc/nsl_admin_snapshot'))return Response.json({sessions:[],metrics:{}});
 if(u.includes('/nsl_admin_deletions?')){if(opts.method==='PATCH'){const b=JSON.parse(opts.body);patches.push(b);job={...job,...b};return Response.json([job]);}return Response.json([job]);}
 if(u.endsWith('/rpc/nsl_admin_delete_session'))return Response.json({files:[],auth_ids:[]});
 throw Error('Unexpected '+u);
};
await import('../supabase/index.ts');
const request=body=>handler(new Request('https://test/admin',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify(body)}));
let data=await (await request({action:'snapshot'})).json();assert.equal(data.deletion_issues[0].label,'USER-0034');assert.equal(data.deletion_issues[0].error,job.last_error);
assert.equal((await request({action:'deletion_dismiss',session_id:id})).status,200);assert.ok(job.dismissed_at);assert.equal(job.last_error,'LOGIN_DELETE_FAILED_RETRY');assert.equal(tasks.length,0);
data=await (await request({action:'snapshot'})).json();assert.deepEqual(data.deletion_issues,[]);assert.deepEqual(data.deleting_sessions,[id]);
assert.equal((await request({action:'deletion_dismiss',session_id:'invalid'})).status,400);
assert.equal((await request({action:'delete_session',session_id:id,confirmation:id})).status,202);assert.ok(patches.some(p=>p.attempts===0&&p.last_error===null&&p.dismissed_at===null));await Promise.all(tasks);
console.log('PASS: dismissal persists without losing cleanup state; retry resets failure and dismissal.');
