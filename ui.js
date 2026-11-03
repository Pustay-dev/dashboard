export function icon(name){const paths={spark:'m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2Z',family:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',workout:'m6 4-2 2m0 0 14 14M3 7l4-4M17 21l4-4M1 9l8-8M15 23l8-8',settings:'M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M6 14v6',refresh:'M20 7a8 8 0 1 0 1 8M20 3v5h-5',arrow:'M7 17 17 7M7 7h10v10',check:'m5 12 4 4L19 6',road:'M5 21V5a2 2 0 0 1 2-2h10M9 8h7M9 13h5M9 18h8',lock:'M5 11h14v10H5ZM8 11V7a4 4 0 0 1 8 0v4',plus:'M12 5v14M5 12h14'};return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`}
export const DAYS=['Ne','Po','Út','St','Čt','Pá','So'];
// Backfill only days that pass after the tracking feature is enabled.
export function closeMissedWorkouts(body,today,planFor){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(today))return false;
 if(!body.workoutTrackingSince){body.workoutTrackingSince=today;body.workoutClosedThrough=today;return true}
 let date=body.workoutClosedThrough||body.workoutTrackingSince,changed=false;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today)return false;
 while(date<today){const plan=planFor(date);if(plan?.duration&&plan.id!=='mobility'&&!plan.optional&&!body.workouts.some(x=>x.date===date)&&!(body.skippedWorkouts||[]).some(x=>x.date===date&&x.type===plan.id)){(body.skippedWorkouts??=[]).push({date,type:plan.id,plan:structuredClone(plan),skippedAt:today+'T00:00:00',automatic:true});changed=true}const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);date=d.toISOString().slice(0,10)}
 if(body.workoutClosedThrough!==today){body.workoutClosedThrough=today;changed=true}return changed;
}
