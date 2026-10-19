// Fixed plan recovered from the final workout conversation, 19 October 2026.
const row=(time,name,sets,rest='',note='',load='')=>({time,name,sets,rest,note,load});
export const PLAN={
 monday:{id:'monday',name:'Full body · gym',duration:60,place:'Gym',rows:[
 row('0–3','Easy bike / brisk walk','3 min'),
 row('3–7','Joint warm-up','4 min','','Shoulder, elbow and wrist circles; ankle rocks, hip hinges, bodyweight squats.'),
 row('7–12','Squat warm-up','Bar × 8 · light × 5 · moderate × 3','','Increase gradually; these are warm-up sets.'),
 row('12–24','Barbell squat','3 × 5','2–3 min'),
 row('24–36','Bench press','3 × 5','2–3 min','First do 2–3 lighter warm-up sets.'),
 row('36–43','Pull-ups / chin-ups','3 × 4–8','90–120 sec','','Bodyweight'),
 row('43–50','Dumbbell Romanian deadlift','2 × 6–8','90–120 sec','One light practice set first.'),
 row('50–57','Lateral raises + ab crunch machine','2 × 12–15 each','45–60 sec after pair'),
 row('57–60','Gentle stretching','3 min')
 ]},
 mobility:{id:'mobility',name:'Mobility',duration:10,place:'Home · optional',rows:[
 row('0–2','Easy marching + shoulder circles','2 min','','Gradually loosen up.'),
 row('2–4','Ankle rocks + gentle hip circles','2 min','','Comfortable range.'),
 row('4–6','Cat–cow + upper-back rotations','2 min','','Slow; don’t force range.'),
 row('6–8','Gentle chest + lat stretches','2 min','','About 30 sec per side.'),
 row('8–10','Hip-flexor stretch + relaxed breathing','2 min','','About 30 sec per side, then breathe.')
 ]},
 wednesday:{id:'wednesday',name:'Shoulders, chest & abs',duration:14,place:'Home',rows:[
 row('0–3','Warm-up','3 min','','March, shoulder/elbow/wrist circles, easy squats and wall push-ups.'),
 row('3–4 / 8–9','Push-ups','2 × 40 sec','20 sec','','Bodyweight'),
 row('4–5 / 9–10','Dead bug','2 × 40 sec','20 sec','','Bodyweight'),
 row('5–6 / 10–11','Lateral raises','2 × 40 sec','20 sec','','2 × 2.5 kg'),
 row('6–7 / 11–12','Reverse crunch','2 × 40 sec','20 sec','','Bodyweight'),
 row('7–8 / 12–13','Bodyweight squat','2 × 40 sec','20 sec','','Bodyweight'),
 row('13–14','Chest + shoulder mobility','1 min')
 ],note:'Two rounds: push-ups → dead bug → raises → reverse crunch → squat. 40 sec work, 20 sec rest.'},
 friday:{id:'friday',name:'Back, arms & abs',duration:15,place:'Home',rows:[
 row('0–3','Warm-up','3 min'),
 row('3–9','Chin-ups','3 × 3–6','Start sets at minutes 3, 5 and 7','','Bodyweight'),
 row('9–10','Lateral raises','40 sec','20 sec','','2 × 2.5 kg'),
 row('10–11','Dead bug','40 sec','20 sec','','Bodyweight'),
 row('11–12','Close-grip push-ups','40 sec','20 sec','','Bodyweight'),
 row('12–13','Prone W raises','40 sec','20 sec','','Bodyweight'),
 row('13–14','Reverse crunch','40 sec','20 sec','','Bodyweight'),
 row('14–15','Lat stretch + breathing','1 min')
 ]},
 fridayGym:{id:'fridayGym',name:'Shoulders & upper body',duration:60,place:'Gym · replaces Friday home',rows:[
 row('0–10','Warm-up','10 min'),
 row('10–20','Dumbbell shoulder press','3 × 6–8','2 min'),
 row('20–29','Chest-supported dumbbell row','3 × 8–10','90 sec'),
 row('29–37','Incline dumbbell bench','2 × 8–10','90 sec'),
 row('37–44','Lateral raises + ab crunch machine','2 × 12–15 each','60 sec after pair'),
 row('44–51','Dumbbell curls + cable triceps pushdowns','2 × 10–12 each','60 sec after pair'),
 row('51–57','Split squat','2 × 8 per leg','60 sec after both legs'),
 row('57–60','Gentle stretching','3 min')
 ]},
 rest:{id:'rest',name:'Rest',duration:0,place:'No scheduled workout',rows:[]}
};
export const WEEK=['rest','monday','mobility','wednesday','mobility','friday','rest'];
