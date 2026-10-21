import {shiftDay,weekday} from './core.js';

export const weekStart=date=>shiftDay(date,-((weekday(date)+6)%7));
export const feedbackKey=(date,type)=>`${date}:${type}`;
export function setDifficulty(body,date,type,value,updatedAt=new Date().toISOString()){
 const difficulty=value===''?null:Number(value);
 if(difficulty!==null&&(!Number.isInteger(difficulty)||difficulty<1||difficulty>5))return false;
 body.workoutFeedback??={};
 const key=feedbackKey(date,type);
 if(difficulty===null)delete body.workoutFeedback[key];
 else body.workoutFeedback[key]={date,type,difficulty,updatedAt};
 return true;
}
export function setWeeklyNote(body,date,note,updatedAt=new Date().toISOString()){
 const key=weekStart(date),text=String(note).trim().slice(0,1000);
 body.weeklyFeedback??={};
 if(text)body.weeklyFeedback[key]={weekStart:key,note:text,updatedAt};
 else delete body.weeklyFeedback[key];
}
export function validWorkout(w){
 return !!w&&typeof w.id==='string'&&typeof w.name==='string'&&w.name.length<=100&&
 Number.isFinite(w.duration)&&w.duration>=0&&w.duration<=65&&typeof w.place==='string'&&
 Array.isArray(w.rows)&&w.rows.length<=12&&w.rows.every(r=>r&&['time','name','sets'].every(k=>typeof r[k]==='string'&&r[k].length<=160)&&['rest','note','load'].every(k=>r[k]==null||typeof r[k]==='string'&&r[k].length<=500));
}
export function validMorningPlan(p){
 return !!p&&/^\d{4}-\d{2}-\d{2}$/.test(p.weekStart)&&weekStart(p.weekStart)===p.weekStart&&
 typeof p.summary==='string'&&p.summary.length<=600&&Array.isArray(p.days)&&p.days.length===7&&
 p.days.every((d,i)=>d.date===shiftDay(p.weekStart,i)&&typeof d.meditation==='string'&&d.meditation.length<=400&&typeof d.mindset==='string'&&d.mindset.length<=400&&validWorkout(d.workout));
}
