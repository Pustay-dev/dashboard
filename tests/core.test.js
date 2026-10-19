import test from 'node:test';
import assert from 'node:assert/strict';
import {dayKey,shiftDay,weekday,normalizeCheck,checkPct,nextTasks,roadPct,latestValues} from '../core.js';
import {PLAN,WEEK} from '../workout-data.js';
import {ROADMAP} from '../roadmap-data.js';
test('Prague date uses local midnight, including DST',()=>{
 assert.equal(dayKey(new Date('2026-10-18T22:01:00Z')),'2026-10-19');
 assert.equal(dayKey(new Date('2026-10-25T22:30:00Z')),'2026-10-25');
 assert.equal(shiftDay('2026-10-25',1),'2026-10-26');assert.equal(weekday('2026-10-19'),1);
});
test('check-in migration preserves unfinished work and frozen history',()=>{
 const s={activities:[{id:'a',name:'Paint',target:120,progress:50},{id:'b',name:'Read',target:45,progress:45}],lastDate:'2026-10-17',history:{'2026-10-17':42},pending:[{id:'c',name:'Mobility',target:10,queuedOn:'2026-10-18'}],todos:[{id:'t',text:'Task'}]};
 const n=normalizeCheck(s,'2026-10-19');assert.equal(n.activities[0].progress,50);assert.equal(n.activities[1].archived,true);assert.equal(n.activities[2].locked,true);assert.equal(n.pending.length,0);assert.equal(n.history['2026-10-17'],42);assert.equal(n.history['2026-10-18'],42);assert.equal(n.todos.length,1);assert.equal(s.activities.length,2);assert.deepEqual(normalizeCheck(n,'2026-10-19'),n);
});
test('old per-day check-in data migrates without losing progress',()=>{const n=normalizeCheck({activities:[{id:'a',name:'Paint',target:60}],days:{'2026-10-19':{a:30}}},'2026-10-19');assert.equal(checkPct(n),50);assert.equal(n.days,undefined)});
test('top three tasks remain in current unfinished phase and react to completion',()=>{const s=structuredClone(ROADMAP);const t=nextTasks(s,'2026-10-19');assert.equal(t.length,3);assert.equal(t[0].pi,1);s.phases[t[0].pi].tasks[t[0].ti].pct=100;assert.notEqual(nextTasks(s)[0].title,t[0].title);assert(roadPct(s)>0)});
test('measurements find latest non-null field rather than dropping earlier values',()=>assert.deepEqual(latestValues([{date:'2026-10-19',weight:80,waist:null},{date:'2026-10-18',weight:79,waist:85}],['weight','waist']),{weight:80,waist:85}));
test('weekly workout schedule matches retrieved plan',()=>{assert.equal(PLAN[WEEK[1]].duration,60);assert.equal(PLAN[WEEK[3]].duration,14);assert.equal(PLAN[WEEK[5]].duration,15);assert.equal(PLAN.fridayGym.duration,60);assert.equal(WEEK[6],'rest');assert.equal(WEEK[0],'rest');assert.equal(PLAN.monday.rows.find(r=>r.name==='Barbell squat').sets,'3 × 5');assert.equal(PLAN.wednesday.rows.find(r=>r.name==='Lateral raises').load,'2 × 2.5 kg')});

import {scheduleActivity,canRemoveActivity,removeActivity,roadmapStatus,smoothPath,dailyAffirmation} from '../core.js';
const blank=date=>({activities:[],pending:[],history:{},todos:[],lastDate:date});
test('future task stays pending until its date and activates locked at midnight',()=>{
 let s=blank('2026-10-19');scheduleActivity(s,{id:'future',name:'Paint',target:60},'2026-10-22','2026-10-19');
 s=normalizeCheck(s,'2026-10-21');assert.equal(s.activities.length,0);assert.equal(s.pending.length,1);
 s=normalizeCheck(s,'2026-10-22');assert.equal(s.pending.length,0);assert.equal(s.activities[0].locked,true);assert.equal(canRemoveActivity(s.activities[0],'2026-10-22'),false);assert.equal(removeActivity(s,'future','2026-10-22'),false);assert.equal(s.activities[0].archived,false);
});
test('today task is removable today, but incomplete carryover locks next day',()=>{
 let s=blank('2026-10-19');scheduleActivity(s,{id:'now',name:'Read',target:30},'2026-10-19','2026-10-19');assert.equal(canRemoveActivity(s.activities[0],'2026-10-19'),true);
 s.activities[0].progress=15;s=normalizeCheck(s,'2026-10-20');assert.equal(s.history['2026-10-19'],50);assert.equal(s.activities[0].progress,15);assert.equal(s.activities[0].locked,true);assert.equal(removeActivity(s,'now','2026-10-20'),false);
});
test('scheduled tasks affect history only on the day they become due, including skipped days',()=>{
 let s=blank('2026-10-19');scheduleActivity(s,{id:'a',name:'Paint',target:60},'2026-10-19','2026-10-19');s.activities[0].progress=30;
 scheduleActivity(s,{id:'b',name:'Read',target:60},'2026-10-21','2026-10-19');s=normalizeCheck(s,'2026-10-23');
 assert.equal(s.history['2026-10-19'],50);assert.equal(s.history['2026-10-20'],50);assert.equal(s.history['2026-10-21'],25);assert.equal(s.history['2026-10-22'],25);assert.equal(s.activities.length,2);assert(s.activities.every(a=>a.locked));assert.deepEqual(normalizeCheck(s,'2026-10-23'),s);
});
test('completed task archives at midnight; task scheduling rejects past dates',()=>{
 let s=blank('2026-10-19');scheduleActivity(s,{id:'a',name:'Paint',target:60},'2026-10-19','2026-10-19');s.activities[0].progress=60;s=normalizeCheck(s,'2026-10-20');assert.equal(s.history['2026-10-19'],100);assert.equal(s.activities[0].archived,true);assert.throws(()=>scheduleActivity(s,{id:'b'},'2026-10-18','2026-10-20'));
});
test('legacy quick tasks migrate once into regular activities',()=>{const s=blank('2026-10-19');s.todos=[{id:'x',text:'Call printer',done:false}];const a=normalizeCheck(s,'2026-10-20'),b=normalizeCheck(a,'2026-10-20');assert.equal(a.activities[0].name,'Call printer');assert.equal(a.activities[0].locked,true);assert.equal(b.activities.length,1);assert.equal(b.todos.length,1)});
test('roadmap only falls behind after a due date passes and recovers on completion',()=>{const s={phases:[{tasks:[{due:'2026-10-19',pct:0},{due:'2026-10-18',pct:100}]}]};assert.equal(roadmapStatus(s,'2026-10-19').behind,false);assert.deepEqual(roadmapStatus(s,'2026-10-20'),{behind:true,count:1,days:1});s.phases[0].tasks[0].pct=100;assert.equal(roadmapStatus(s,'2026-10-20').behind,false)});
test('performance curve has smooth cubic segments and handles one day',()=>{assert.equal(smoothPath([[1,2]]),'M1,2');const p=smoothPath([[0,100],[50,50],[100,75],[150,0]]);assert.equal((p.match(/ C/g)||[]).length,3);assert(!p.includes('NaN'));assert(!p.includes('Infinity'))});
test('daily affirmation stays fixed through refresh and changes next day',()=>{const m=new Map(),st={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)},items=['one','two','three'];const a=dailyAffirmation('2026-10-19',items,st,()=>0);assert.equal(dailyAffirmation('2026-10-19',items,st,()=>.99),a);assert.notEqual(dailyAffirmation('2026-10-20',items,st,()=>0),a)});

test('one task cannot inflate daily progress beyond its own target',()=>{const s={activities:[{name:'Short task',target:15,progress:30},{name:'Other task',target:15,progress:0}]};assert.equal(checkPct(s),50);const n=normalizeCheck({...s,lastDate:'2026-10-19'},'2026-10-19');assert.equal(n.activities[0].progress,15);assert.equal(checkPct(n),50)});
