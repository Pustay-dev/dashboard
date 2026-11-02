// Pure JavaScript: runs in functions.exec without Node, packages, files or encryption keys.
export function buildAccountSnapshot(records,previous=null,currentReport=null,updatedAt=new Date().toISOString()){
 if(!Array.isArray(records)||!Number.isFinite(Date.parse(updatedAt)))throw Error('Detailed automation records are required');
 const excluded=new Set(['6accb490ecb881919047bb6a5505a745']);
 const tasks=records.filter(t=>t.is_enabled&&!excluded.has(t.id)).map(t=>{
  if(!t.id||!t.title||!t.schedule||t.last_run_time&&!t.run_details)throw Error('Fetch detailed run records before publishing');
  const run=t.run_details?.last_run,r=t.run_details?.latest_result,old=previous?.tasks?.find(x=>x.id===t.id);
  const generated=currentReport?.automationId===t.id?currentReport:null;
  if(generated&&(typeof generated.contentText!=='string'||!Number.isFinite(Date.parse(generated.createdAt))))throw Error('Invalid current report');
  return {id:t.id,title:t.title,schedule:t.schedule,timingMode:t.timing_mode||'flexible_schedule',timezone:t.default_timezone||'Europe/Prague',enabled:true,conversationId:t.conversation_id||null,lastRun:run?{id:run.id,status:run.recorded_status,scheduledFor:run.scheduled_for,startedAt:run.started_at,completedAt:run.completed_at}:null,latestResult:r?{runId:r.run_id,createdAt:r.created_at,scheduledFor:r.scheduled_for,completedAt:r.completed_at,contentText:r.content_text,contentTruncated:!!r.content_truncated,isFailureMessage:!!r.is_failure_message,requiresUserAction:!!r.requires_user_action,conversationId:r.chat_ref?.type==='chatgpt'?r.chat_ref.id:t.conversation_id}:null,generatedReport:generated?{contentText:generated.contentText,createdAt:generated.createdAt}:old?.generatedReport||null};
 });
 return {version:1,updatedAt,timezone:'Europe/Prague',tasks};
}
export function accountPublicationSql(snapshot,revision=0){
 if(!snapshot||snapshot.version!==1||!Array.isArray(snapshot.tasks)||!Number.isInteger(revision)||revision<0)throw Error('Invalid publication');
 const json="'"+JSON.stringify(snapshot).replace(/'/g,"''")+"'";
 return `insert into public.jp_dashboard_report_feed(user_id,snapshot,revision,updated_at) select a.user_id,${json}::jsonb,1,now() from public.jp_dashboard_accounts a join auth.users u on u.id=a.user_id where lower(u.email)='pustay.jakub@gmail.com' on conflict(user_id) do update set snapshot=excluded.snapshot,revision=jp_dashboard_report_feed.revision+1,updated_at=now() where jp_dashboard_report_feed.revision=${revision} returning revision,updated_at;`;
}
export const accountFeedReadSql="select f.snapshot,f.revision from public.jp_dashboard_report_feed f join auth.users u on u.id=f.user_id where lower(u.email)='pustay.jakub@gmail.com';";
export function sqlRows(result){
 let value=result.structuredContent;
 if(!value){const text=result.content?.find(x=>x.type==='text')?.text;if(!text)throw Error('Missing SQL response');value=JSON.parse(text)}
 if(Array.isArray(value))return value;
 if(Array.isArray(value?.result))return value.result;
 if(typeof value?.result==='string'){const match=value.result.match(/<untrusted-data-[^>]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-[^>]+>/);if(match)return JSON.parse(match[1])}
 throw Error('Unrecognized SQL response; leave existing reports intact');
}
