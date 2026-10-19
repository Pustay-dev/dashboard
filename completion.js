// Save first, cross out, flick right, then close the gap before the shared view redraws.
export async function flickCompletedActivity(row,reducedMotion=false){
 if(!row)return;
 row.querySelectorAll?.('button').forEach(b=>b.disabled=true);
 const fill=row.querySelector?.('.bar i');if(fill)fill.style.width='100%';
 row.classList?.add('activity-finishing');
 const height=row.getBoundingClientRect().height;
 if(!row.animate){
  row.style?.setProperty('--completion-height',height+'px');
  row.classList?.add(reducedMotion?'activity-fade-fallback':'activity-flick-fallback');
  await new Promise(resolve=>setTimeout(resolve,2180));return;
 }
 try{
  await row.animate([{transform:'translateX(0) rotate(0deg)',opacity:1},{transform:reducedMotion?'translateX(0)':'translateX(115%) rotate(2deg)',opacity:0}],{duration:1000,delay:1000,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'}).finished;
  await row.animate([{height:height+'px',marginTop:'20px',paddingTop:'20px',paddingBottom:'3px',borderTopWidth:'1px'},{height:'0px',marginTop:'0px',paddingTop:'0px',paddingBottom:'0px',borderTopWidth:'0px'}],{duration:180,easing:'cubic-bezier(.2,0,.2,1)',fill:'forwards'}).finished;
 }catch{/* Saved completion stays intact if navigation cancels an animation. */}
}
