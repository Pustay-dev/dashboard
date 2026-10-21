import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=new URL('../automation-src/',import.meta.url);
const baseline=JSON.parse(fs.readFileSync(new URL('baseline.json',source),'utf8'));
const common='const BASELINE='+JSON.stringify(baseline)+';\n'+fs.readFileSync(new URL('common.js',source),'utf8');
const read=file=>fs.readFileSync(new URL(file,source),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const clock=date=>class extends Date{constructor(...args){super(...(args.length?args:[date+'T08:00Z']))}};
async function run(file,{date='2026-10-21',state={},input={},lookup=()=>{},helpers={prepareBinaryData:async(buffer,fileName,mimeType)=>({data:buffer.toString('base64'),fileName,mimeType})}}={}){
 return new AsyncFunction('$input','$getWorkflowStaticData','$','Buffer','Date',common+'\n'+read(file)).call({helpers},{first:()=>({json:input})},()=>state,lookup,Buffer,clock(date));
}
const getStarter=date=>new Function('Date',common+'\nreturn starter(week(dateKey()));')(clock(date));
test('only relevant feedback/results reach the model; measurements and keys do not',async()=>{
 const [out]=await run('prepare.js',{input:{record:{measurements:[{secret:'PRIVATE_MEASUREMENT'}],workouts:[{date:'2026-10-20',type:'monday',results:{3:{load:'60',reps:'5/5/5'}}},{date:'2026-08-01',type:'monday'}],workoutFeedback:{a:{date:'2026-10-20',type:'monday',difficulty:4},b:{date:'2026-10-20',difficulty:9}},weeklyFeedback:{x:{weekStart:'2026-10-19',note:'More recovery'}}}}});
 const context=JSON.parse(out.json.request.messages[1].content);
 assert.equal(context.ratings.length,1);assert.equal(context.results.length,1);assert.equal(context.results[0].results[0].exercise,'Barbell squat');assert.equal(context.weeklyFeedback[0].note,'More recovery');assert(!JSON.stringify(out).includes('PRIVATE_MEASUREMENT'));
 assert.equal(out.json.weekStart,'2026-10-19');assert.equal(out.json.request.response_format.json_schema.strict,true);
});
test('invalid, refused and incomplete AI generations never replace the last valid plan',async()=>{
 const prior=getStarter('2026-10-14'),state={weeks:{'2026-10-12':prior}},before=JSON.stringify(state);
 for(const result of [{finish_reason:'length',message:{content:'{}'}},{finish_reason:'stop',message:{refusal:'No'}},{finish_reason:'stop',message:{content:'{}'}}])await assert.rejects(run('save.js',{state,input:{choices:[result]},lookup:()=>({first:()=>({json:{weekStart:'2026-10-19'}})})}));
 assert.equal(JSON.stringify(state),before);
});
test('a fully validated week is saved; wrong dates, excessive duration and missing warm-up are rejected',async()=>{
 const plan=getStarter('2026-10-21'),state={};
 const save=p=>run('save.js',{state,input:{choices:[{finish_reason:'stop',message:{content:JSON.stringify(p)}}]},lookup:()=>({first:()=>({json:{weekStart:'2026-10-19'}})})});
 await save(plan);assert.equal(state.weeks['2026-10-19'].days.length,7);
 for(const mutate of [p=>p.days[0].date='2026-10-20',p=>p.days[2].workout.duration=90,p=>p.days[0].workout.rows[0].name='Heavy squat']){const bad=structuredClone(plan);mutate(bad);await assert.rejects(save(bad))}
 assert.equal(state.weeks['2026-10-19'].days[2].workout.duration,14);
});
test('website and PDF use the same plan, and a missed AI run reuses the last valid week',async()=>{
 const old=getStarter('2026-10-14'),state={weeks:{'2026-10-12':old}};
 const [json]=await run('serve.js',{state,input:{query:{format:'plan'}}});const plan=JSON.parse(Buffer.from(json.binary.data.data,'base64'));
 assert.equal(plan.weekStart,'2026-10-19');assert.equal(plan.days[2].date,'2026-10-21');assert.equal(plan.source,'Previous valid AI plan');
 const [pdf]=await run('serve.js',{state});assert.equal(pdf.binary.data.mimeType,'application/pdf');assert(Buffer.from(pdf.binary.data.data,'base64').toString().startsWith('%PDF-1.4'));
 assert(Buffer.from(pdf.binary.data.data,'base64').toString().includes('Shoulders, chest & abs'));
});
test('all seven starter days produce a PDF with content above the footer',async()=>{
 for(let n=19;n<=25;n++){
  const [out]=await run('serve.js',{date:'2026-10-'+n});const pdf=Buffer.from(out.binary.data.data,'base64').toString();
  const ys=[...pdf.matchAll(/1 0 0 1 42 ([\d.]+) Tm/g)].map(m=>Number(m[1]));assert(ys.slice(0,-2).every(y=>y>90));
  assert(pdf.includes('/MediaBox [0 0 595.28 841.89]'));
 }
});
