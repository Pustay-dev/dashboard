import test from 'node:test';
import assert from 'node:assert/strict';
import {setDifficulty,setWeeklyNote,weekStart,validMorningPlan} from '../feedback.js';
import {Records} from '../storage.js';
test('ratings are bounded integers and clearing does not remove workout results',()=>{
 const body={workouts:[{date:'2026-10-21',type:'wednesday',results:{0:{reps:'5'}}}]};
 for(const value of [0,6,2.5,'no'])assert.equal(setDifficulty(body,'2026-10-21','wednesday',value),false);
 setDifficulty(body,'2026-10-21','wednesday',4,'now');assert.equal(body.workoutFeedback['2026-10-21:wednesday'].difficulty,4);
 setDifficulty(body,'2026-10-21','friday',2,'now');assert.equal(Object.keys(body.workoutFeedback).length,2);
 setDifficulty(body,'2026-10-21','wednesday','');assert.equal(body.workouts[0].results[0].reps,'5');assert.equal(Object.keys(body.workoutFeedback).length,1);
});
test('weekly notes use Monday across year boundaries and support removal',()=>{
 const body={};assert.equal(weekStart('2027-01-03'),'2026-12-28');
 setWeeklyNote(body,'2027-01-03','  More recovery  ','now');assert.equal(body.weeklyFeedback['2026-12-28'].note,'More recovery');
 setWeeklyNote(body,'2027-01-03',' ');assert.equal(Object.keys(body.weeklyFeedback).length,0);
});
test('feedback survives backup, import and remote sync with unrelated records intact',async()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 const defaults={body:{measurements:[{date:'2026-10-20',weight:80}],performance:[],workouts:[]}};
 let remote=structuredClone(defaults.body),put;
 const fetcher=async(_url,opts)=>{if(opts.method==='PUT'){put=JSON.parse(opts.body);remote=put}return {ok:true,json:async()=>({record:structuredClone(remote)})}};
 const store=new Records(defaults,storage,fetcher);await store.connect('test-only');
 store.edit('body',s=>{setDifficulty(s,'2026-10-21','wednesday',4);setWeeklyNote(s,'2026-10-21','Less volume')});await store.chain;
 assert.equal(put.workoutFeedback['2026-10-21:wednesday'].difficulty,4);assert.equal(put.measurements[0].weight,80);
 const reloaded=new Records(defaults,storage,fetcher);assert.equal(reloaded.get('body').weeklyFeedback['2026-10-19'].note,'Less volume');
});
test('malformed or unordered AI plans are rejected',()=>{
 assert.equal(validMorningPlan({}),false);
 assert.equal(validMorningPlan({weekStart:'2026-10-20',summary:'Bad',days:[]}),false);
});
