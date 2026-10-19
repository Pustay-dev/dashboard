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
 const n=normalizeCheck(s,'2026-10-19');assert.equal(n.activities[0].progress,50);assert.equal(n.activities[1].archived,true);assert.equal(n.activities[2].locked,true);assert.equal(n.pending.length,0);assert.equal(n.history['2026-10-17'],42);assert.equal(n.history['2026-10-18'],58);assert.equal(n.todos.length,1);assert.equal(s.activities.length,2);assert.deepEqual(normalizeCheck(n,'2026-10-19'),n);
});
test('old per-day check-in data migrates without losing progress',()=>{const n=normalizeCheck({activities:[{id:'a',name:'Paint',target:60}],days:{'2026-10-19':{a:30}}},'2026-10-19');assert.equal(checkPct(n),50);assert.equal(n.days,undefined)});
test('top three tasks remain in current unfinished phase and react to completion',()=>{const s=structuredClone(ROADMAP);const t=nextTasks(s,'2026-10-19');assert.equal(t.length,3);assert.equal(t[0].pi,1);s.phases[t[0].pi].tasks[t[0].ti].pct=100;assert.notEqual(nextTasks(s)[0].title,t[0].title);assert(roadPct(s)>0)});
test('measurements find latest non-null field rather than dropping earlier values',()=>assert.deepEqual(latestValues([{date:'2026-10-19',weight:80,waist:null},{date:'2026-10-18',weight:79,waist:85}],['weight','waist']),{weight:80,waist:85}));
test('weekly workout schedule matches retrieved plan',()=>{assert.equal(PLAN[WEEK[1]].duration,60);assert.equal(PLAN[WEEK[3]].duration,14);assert.equal(PLAN[WEEK[5]].duration,15);assert.equal(PLAN.fridayGym.duration,60);assert.equal(WEEK[6],'rest');assert.equal(WEEK[0],'rest');assert.equal(PLAN.monday.rows.find(r=>r.name==='Barbell squat').sets,'3 × 5');assert.equal(PLAN.wednesday.rows.find(r=>r.name==='Lateral raises').load,'2 × 2.5 kg')});
