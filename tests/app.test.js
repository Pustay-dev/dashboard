import test from 'node:test';import assert from 'node:assert/strict';
const map=new Map(),listeners={},nodes=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){}},setAttribute(){},focus(){},addEventListener(type,fn){listeners[id+':'+type]=fn}});return nodes.get(id)}
globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
globalThis.location={hash:'#today'};
globalThis.window={scrollY:0,scrollTo(){},addEventListener(type,fn){listeners['window:'+type]=fn}};
globalThis.document={querySelector:node,querySelectorAll:()=>[],addEventListener(type,fn){listeners['document:'+type]=fn},createElement(){return {click(){}}}};
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
test('quick task is added to the main activity list',async()=>{go('check-in');const Original=globalThis.FormData;globalThis.FormData=class{get(k){return {text:'Call printer',target:'10'}[k]}};try{await listeners['#app:submit']({preventDefault(){},target:{id:'todo-form'}})}finally{globalThis.FormData=Original}assert(record('check').activities.some(a=>a.name==='Call printer'&&a.target===10));go('today');assert(html().includes('Call printer'))});

test('Today header has no affirmation and keeps a separate date control',()=>{go('today');assert(!html().includes('<blockquote'));assert(!html().includes('class="affirmation"'));assert(html().includes('class="date-picker"'));assert(html().includes('<h1>Today</h1>'))});

test('completion caps time, hides Today task, and retains it in full Check-in for undo',async()=>{
 go('today');const activity=record('check').activities.find(a=>a.name==='Call printer');assert(activity);
 await click({activity:activity.id,delta:'30'});assert.equal(record('check').activities.find(a=>a.id===activity.id).progress,10);
 assert(!html().includes('data-activity-row="'+activity.id+'"'));
 go('check-in');assert(html().includes('data-activity-row="'+activity.id+'"'));assert(html().includes('activity-is-done'));
 await click({activity:activity.id,delta:'30'});assert.equal(record('check').activities.find(a=>a.id===activity.id).progress,10);
 await click({activity:activity.id,delta:'-15'});assert.equal(record('check').activities.find(a=>a.id===activity.id).progress,0);
 go('today');assert(html().includes('data-activity-row="'+activity.id+'"'));
 await click({completeActivity:activity.id});assert.equal(record('check').activities.find(a=>a.id===activity.id).progress,10);assert(!html().includes('data-activity-row="'+activity.id+'"'));
});
