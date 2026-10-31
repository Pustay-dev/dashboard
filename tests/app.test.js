import test from 'node:test';import assert from 'node:assert/strict';
const map=new Map(),listeners={},nodes=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){}},setAttribute(){},focus(){},addEventListener(type,fn){listeners[id+':'+type]=fn}});return nodes.get(id)}
globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
globalThis.location={hash:'#today'};
globalThis.window={scrollY:0,scrollTo(){},addEventListener(type,fn){listeners['window:'+type]=fn}};
globalThis.document={querySelector:node,querySelectorAll:()=>[],addEventListener(type,fn){listeners['document:'+type]=fn},createElement(){return {click(){}}}};
let fetchImplementation=globalThis.fetch;globalThis.fetch=(...args)=>fetchImplementation(...args);
const originalInterval=globalThis.setInterval;globalThis.setInterval=()=>0;
await import('../app.js');globalThis.setInterval=originalInterval;
const html=()=>node('#app').innerHTML;
function go(route){location.hash='#'+route;listeners['window:hashchange']()}
function click(dataset={},attrs=[]){return listeners['#app:click']({target:{closest:()=>({dataset,hasAttribute:k=>attrs.includes(k)})}})}
function record(k){return JSON.parse(map.get('jp_'+k)).data}
test('all six pages render without runtime errors',()=>{for(const route of ['today','check-in','roadmap','workout','measurements','settings']){go(route);assert(html().length>400);assert(!html().includes('undefined'));assert(!html().includes('NaN'))}});
test('home check-in controls update shared data and dedicated page',async()=>{go('today');await click({activity:'painting',delta:'30'});assert.equal(record('check').activities[0].progress,30);go('check-in');assert(html().includes('30m / 2h'));go('today');assert(html().includes('30m / 2h'))});
test('roadmap completion on home updates full roadmap',async()=>{go('today');await click({task:'1:0',change:'done'});assert.equal(record('road').phases[1].tasks[0].pct,100);go('roadmap');assert(html().includes('task-done'))});
test('workout picker and date selection render exact retrieved prescriptions',async()=>{go('workout');await click({plan:'monday'});assert(html().includes('Barbell squat'));assert(html().includes('3 × 5'));await click({plan:'wednesday'});assert(html().includes('2 × 2.5 kg'));assert(html().includes('2 × 40 sec'));await click({goDate:'2026-10-24'});assert(html().includes('No workout scheduled.'));await click({goDate:'2026-10-19'});assert(html().includes('Barbell squat'))});
test('historical check-in cannot edit current activities',async()=>{go('check-in');await click({goDate:'2026-10-18'});assert(!html().includes('data-activity='));assert(html().includes('No check-in recorded for this date.'))});
test('measurement form persists a partial entry; home shows it',async()=>{go('measurements');const Original=globalThis.FormData;globalThis.FormData=class{get(k){return {date:'2026-10-19',weight:'80.2',waist:'',chest:'',arm:'',thigh:''}[k]}};try{await listeners['#app:submit']({preventDefault(){},target:{id:'measurement-form'}})}finally{globalThis.FormData=Original}assert.equal(record('body').measurements[0].weight,80.2);go('today');assert(html().includes('80.2'))});
test('workout form saves weights and results once and shows weights on home',async()=>{go('workout');await click({goDate:'2026-10-19'});const Original=globalThis.FormData;globalThis.FormData=class{get(k){return k==='load-3'?'70':k==='reps-3'?'5 / 5 / 5':''}};try{await listeners['#app:submit']({preventDefault(){},target:{id:'workout-form'},submitter:{value:'log'}});await listeners['#app:submit']({preventDefault(){},target:{id:'workout-form'},submitter:{value:'log'}})}finally{globalThis.FormData=Original}assert.equal(record('body').workouts.length,1);assert.equal(record('body').exerciseLoads['Barbell squat'],'70');go('today');assert(html().includes('70'))});

test('workout and measurements use stacked forms with no wide tables',async()=>{go('workout');await click({plan:'monday'});assert(html().includes('class="log-exercise"'));assert(html().includes('class="log-inputs"'));assert(!html().includes('<table'));go('measurements');assert(html().includes('measurement-history'));assert(!html().includes('<table'))});
test('daily check-in sections follow requested order and use a smooth performance graph',()=>{go('check-in');const h=html();assert(h.indexOf('Daily check-in')<h.indexOf('Quick task'));assert(h.indexOf('Quick task')<h.indexOf('Add a task'));assert(h.indexOf('Add a task')<h.indexOf('Performance'));assert(h.includes('performance-chart'));assert(h.includes('type="date" min='))});
test('quick task is added to the main activity list',async()=>{go('check-in');await click({},['data-today']);const Original=globalThis.FormData;globalThis.FormData=class{get(k){return {text:'Call printer',target:'10'}[k]}};try{await listeners['#app:submit']({preventDefault(){},target:{id:'todo-form'}})}finally{globalThis.FormData=Original}assert(record('check').activities.some(a=>a.name==='Call printer'&&a.target===10));go('today');assert(html().includes('Call printer'))});

test('Today header has no affirmation and keeps a separate date control',async()=>{go('today');await click({},['data-today']);assert(!html().includes('<blockquote'));assert(!html().includes('class="affirmation"'));assert(html().includes('class="date-picker"'));assert(html().includes('<h1>Today</h1>'))});

test('completion caps time, hides Today task, and retains it in full Check-in for undo',async()=>{
 go('today');await click({},['data-today']);const activity=record('check').activities.find(a=>a.name==='Call printer');assert(activity);
 await click({activity:activity.id,delta:'30'});assert.equal(record('check').activities.find(a=>a.id===activity.id).progress,10);
 assert(!html().includes('data-activity-row="'+activity.id+'"'));
 go('check-in');assert(html().includes('data-activity-row="'+activity.id+'"'));assert(html().includes('activity-is-done'));
 await click({activity:activity.id,delta:'30'});assert.equal(record('check').activities.find(a=>a.id===activity.id).progress,10);
 await click({activity:activity.id,delta:'-15'});assert.equal(record('check').activities.find(a=>a.id===activity.id).progress,0);
 go('today');assert(html().includes('data-activity-row="'+activity.id+'"'));
 await click({completeActivity:activity.id});assert.equal(record('check').activities.find(a=>a.id===activity.id).progress,10);assert(!html().includes('data-activity-row="'+activity.id+'"'));
});

test('full Check-in plays the completion before redraw and preserves the completed task',async()=>{
 go('check-in');await click({},['data-today']);const before=html();let release;
 const firstFinished=new Promise(resolve=>release=resolve);let animations=0;const classes=[];
 const row={querySelectorAll:()=>[],querySelector:()=>({style:{}}),classList:{add:x=>classes.push(x)},getBoundingClientRect:()=>({height:130}),animate:()=>({finished:++animations===1?firstFinished:Promise.resolve()})};
 const button={dataset:{completeActivity:'reading'},hasAttribute:()=>false,closest:selector=>selector==='.activity'?row:null};
 const pending=listeners['#app:click']({target:{closest:()=>button}});
 assert.equal(record('check').activities.find(a=>a.id==='reading').progress,45);
 assert(classes.includes('activity-finishing'));assert.equal(html(),before,'completion must not redraw before animation finishes');
 // Even a cloud/route redraw cannot cancel the visible row mid-animation.
 listeners['window:hashchange']();assert.equal(html(),before);
 release();await pending;assert.equal(animations,2);assert(html().includes('data-activity-row="reading"'));assert.notEqual(html(),before);
 go('today');assert(!html().includes('data-activity-row="reading"'));
});

test('quick task on a future viewing date stays pending and is absent from Today',async()=>{
 const {dayKey,shiftDay}=await import('../core.js');const today=dayKey(),future=shiftDay(today,3);go('check-in');await click({goDate:future});
 const Original=globalThis.FormData;globalThis.FormData=class{get(k){return {text:'Future quick task regression',target:'15'}[k]}};
 try{await listeners['#app:submit']({preventDefault(){},target:{id:'todo-form'}})}finally{globalThis.FormData=Original}
 const s=record('check'),queued=s.pending.find(a=>a.name==='Future quick task regression');assert(queued);assert.equal(queued.scheduledFor,future);assert(!s.activities.some(a=>a.name==='Future quick task regression'));
 await click({},['data-today']);go('today');assert(!html().includes('Future quick task regression'));
 go('check-in');await click({goDate:future});assert(html().includes('Future quick task regression'));
});
test('explicit future date schedules correctly even when the page is viewing Today',async()=>{
 const {dayKey,shiftDay}=await import('../core.js');const future=shiftDay(dayKey(),5);go('check-in');await click({},['data-today']);
 const Original=globalThis.FormData;globalThis.FormData=class{get(k){return {name:'Explicit future task regression',target:'30',date:future}[k]}};
 try{await listeners['#app:submit']({preventDefault(){},target:{id:'activity-form'}})}finally{globalThis.FormData=Original}
 const s=record('check');assert.equal(s.pending.find(a=>a.name==='Explicit future task regression').scheduledFor,future);assert(!s.activities.some(a=>a.name==='Explicit future task regression'));
});
test('task name, duration and future date survive a background redraw',async()=>{
 const {dayKey,shiftDay}=await import('../core.js');const future=shiftDay(dayKey(),7);go('check-in');
 for(const [name,value] of Object.entries({name:'Keep my draft',target:'25',date:future}))listeners['#app:input']({target:{form:{id:'activity-form'},name,value}});
 listeners['window:hashchange']();assert(html().includes('name="name" value="Keep my draft"'));assert(html().includes('name="target" type="number" value="25"'));assert(html().includes('value="'+future+'"'));
});

test('difficulty is optional, persists per date and workout, and never logs completion',async()=>{
 const {dayKey}=await import('../core.js');go('workout');await click({},['data-today']);await click({plan:'monday'});
 assert(html().includes('Not rated'));const before=record('body').workouts.length;
 const target={id:'workout-difficulty',value:'3',dataset:{feedbackDate:dayKey(),feedbackType:'monday'},setAttribute(){}};
 // Touching the neutral slider value must count as a deliberate rating too.
 listeners['#app:pointerup']({target});
 assert.equal(record('body').workoutFeedback[dayKey()+':monday'].difficulty,3);
 assert.equal(record('body').workouts.length,before);
 target.value='5';await listeners['#app:change']({target});assert.equal(record('body').workoutFeedback[dayKey()+':monday'].difficulty,5);
 go('workout');await click({plan:'monday'});assert(html().includes('5 / 5'));
 await click({},['data-clear-difficulty']);assert(!record('body').workoutFeedback[dayKey()+':monday']);
});
test('editing feedback preserves unsaved workout reps and loads',async()=>{
 const {dayKey}=await import('../core.js');go('workout');await click({},['data-today']);await click({plan:'monday'});
 for(const [name,value] of Object.entries({'load-3':'75','reps-3':'5 / 5 / 4'}))listeners['#app:input']({target:{form:{id:'workout-form'},name,value}});
 const target={id:'workout-difficulty',value:'4',dataset:{feedbackDate:dayKey(),feedbackType:'monday'},setAttribute(){}};
 await listeners['#app:change']({target});await click({},['data-clear-difficulty']);
 assert(html().includes('value="75"'));assert(html().includes('value="5 / 5 / 4"'));
});
test('weekly note persists independently and escapes markup',async()=>{
 go('workout');const date='2026-10-21',target={id:'weekly-feedback',dataset:{week:'2026-10-19'},value:'Less volume <script>alert(1)</script>'};
 listeners['#app:input']({target});await listeners['#app:change']({target});assert.equal(record('body').weeklyFeedback['2026-10-19'].note,target.value);
 await click({goDate:date});assert(html().includes('&lt;script&gt;'));assert(!html().includes('<script>alert'));
 const snapshot=record('body').workouts.find(x=>x.plan);assert(snapshot?.plan.rows.length);
});

test('skipped sessions are saved separately, visible in history and undoable',async()=>{
 go('workout');await click({goDate:'2026-10-21'});const before=record('body').workouts.length;
 assert(html().includes('data-skip-workout'));await click({},['data-skip-workout']);await click({},['data-skip-workout']);
 const b=record('body');assert.equal(b.workouts.length,before);assert.equal(b.skippedWorkouts.filter(x=>x.date==='2026-10-21'&&x.type==='wednesday').length,1);assert(b.skippedWorkouts[0].plan.rows.length);
 assert(html().includes('1 skipped'));assert(html().includes('data-undo-skip'));assert(!html().includes('id="workout-difficulty"'));
 go('today');assert(html().includes('<small>Skipped</small>'));go('workout');await click({},['data-undo-skip']);assert.equal(record('body').skippedWorkouts.length,0);assert.equal(record('body').workouts.length,before);
});
test('saving a workout replaces a skip without duplicate or contradictory records',async()=>{
 go('workout');await click({goDate:'2026-10-21'});await click({},['data-skip-workout']);const Original=globalThis.FormData;globalThis.FormData=class{get(){return ''}};
 try{await listeners['#app:submit']({preventDefault(){},target:{id:'workout-form'},submitter:{value:'log'}})}finally{globalThis.FormData=Original}
 const b=record('body');assert(!b.skippedWorkouts.some(x=>x.date==='2026-10-21'&&x.type==='wednesday'));assert.equal(b.workouts.filter(x=>x.date==='2026-10-21'&&x.type==='wednesday').length,1);await click({},['data-skip-workout']);assert(!record('body').skippedWorkouts.length);
});
test('future sessions and rest days cannot be marked skipped',async()=>{
 const {dayKey,shiftDay}=await import('../core.js');go('workout');await click({goDate:shiftDay(dayKey(),7)});await click({plan:'monday'});const before=JSON.stringify(record('body').skippedWorkouts||[]);assert(!html().includes('data-skip-workout'));await click({},['data-skip-workout']);assert.equal(JSON.stringify(record('body').skippedWorkouts||[]),before);
 await click({goDate:'2026-10-18'});assert(!html().includes('data-skip-workout'));await click({},['data-skip-workout']);assert.equal(JSON.stringify(record('body').skippedWorkouts||[]),before);
});

test('Reports imports a private key, decrypts the feed, and keeps Today to shortcuts',async()=>{
 const {generateKeyPairSync}=await import('node:crypto'),{encryptSnapshot}=await import('../report-wall/publish.mjs');
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048}),privateJwk=privateKey.export({format:'jwk'});
 const key={format:'jakub-report-wall-key-v1',keyId:'integration-test',privateKey:privateJwk},feed={version:1,updatedAt:new Date().toISOString(),tasks:[{id:'report-test',title:'Daily test report',enabled:true,schedule:'BEGIN:VEVENT\nDTSTART;TZID=Europe/Prague:20261001T100000\nRRULE:FREQ=DAILY\nEND:VEVENT',timingMode:'exact_schedule',timezone:'Europe/Prague',conversationId:'6accb471-05c8-83eb-9850-02da915abf49',latestResult:{createdAt:new Date().toISOString(),contentText:'**Decrypted sample content** '+('Useful detail. '.repeat(30))+'REPORT END ONLY IN FULL VIEW'}}]};
 const envelope=encryptSnapshot(feed,{keyId:key.keyId,publicKey:publicKey.export({format:'jwk'})}),originalFetch=fetchImplementation;fetchImplementation=async()=>({ok:true,json:async()=>envelope});go('reports');assert(html().includes('reports-key-file'));
 try{await listeners['#app:change']({target:{id:'reports-key-file',files:[{text:async()=>JSON.stringify(key)}]}});assert(html().includes('Decrypted sample content'));assert(html().includes('Open in ChatGPT'));go('today');await click({},['data-today']);assert(html().includes('Daily test report'));assert(html().includes('Decrypted sample content'));assert(!html().includes('REPORT END ONLY IN FULL VIEW'));assert(!JSON.stringify(record('body')).includes(privateJwk.d))}finally{fetchImplementation=originalFetch}
});

test('Settings displays the real connection failure instead of only saying offline',async()=>{
 const originalFetch=fetchImplementation,OriginalFormData=globalThis.FormData;fetchImplementation=async()=>{throw new TypeError('Load failed')};
 globalThis.FormData=class{get(){return 'test-only'}};go('settings');
 try{await listeners['#app:submit']({preventDefault(){},target:{id:'cloud-form',querySelector:()=>({disabled:false})}});assert(html().includes('Network request failed'));assert(html().includes('Load failed'));assert(html().includes('cloud-error'))}finally{fetchImplementation=originalFetch;globalThis.FormData=OriginalFormData}
});


test('account sign-in migrates this browser’s setup and sign-out hides private views without losing records',async()=>{
 const saved=new Map(map),originalFetch=fetchImplementation,OriginalFormData=globalThis.FormData;let settings={},revision=0;
 map.set('jp_cloud_key','browser-test-key');map.delete('jp_morning_url');const before=JSON.stringify(record('body'));
 fetchImplementation=async(url,options={})=>{
  if(url.includes('/auth/v1/token'))return {ok:true,json:async()=>({access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,user:{id:'owner-fixture',email:'owner@example.com'}})};
  if(url.includes('/auth/v1/logout'))return {ok:true,json:async()=>({})};
  if(url.includes('/rest/v1/jp_dashboard_accounts')){if(options.method==='PATCH'){const update=JSON.parse(options.body);settings=update.settings;revision=update.revision}return {ok:true,json:async()=>[{settings,revision}]}};
  if(url.includes('api.jsonbin.io')){const kind=url.includes('6a9b3c7')?'check':url.includes('6a9a937')?'road':'body';return {ok:true,json:async()=>({record:record(kind)})}};
  throw Error('Unexpected test URL');
 };
 globalThis.FormData=class{get(k){return {email:'owner@example.com',password:'never-stored-password'}[k]}};
 try{go('settings');assert(html().includes('autocomplete="current-password"'));await listeners['#app:submit']({preventDefault(){},target:{id:'account-form',querySelector(){return {value:''}}}});assert(html().includes('Your account'));assert(html().includes('Setup saved to your account'));assert.equal(settings.jsonbinKey,'browser-test-key');assert(settings.reportsKey);assert(!map.get('jp_account_session').includes('never-stored-password'));await click({},['data-account-signout']);assert.equal(map.get('jp_cloud_key'),undefined);assert.equal(map.get('jp_reports_key'),undefined);go('today');assert(html().includes('id="account-form"'));assert(!html().includes('Quick task'));assert(!html().includes('Daily test report'));assert.equal(node('#roadmap-pct').textContent,'—');assert.equal(JSON.stringify(record('body')),before)}finally{fetchImplementation=originalFetch;globalThis.FormData=OriginalFormData;map.clear();for(const [k,v]of saved)map.set(k,v)}
});
