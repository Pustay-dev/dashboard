// Persist completion first; animate only the Today card, then re-render shared state.
export async function flickCompletedActivity(row,reducedMotion=false){
 if(!row)return;
 row.querySelectorAll?.('button').forEach(b=>b.disabled=true);
 const fill=row.querySelector?.('.bar i');if(fill)fill.style.width='100%';
 row.classList?.add('activity-finishing');
 if(reducedMotion||!row.animate)return;
 const height=row.getBoundingClientRect().height;
 try{
  await row.animate([{transform:'translateX(0) rotate(0deg)',opacity:1},{transform:'translateX(115%) rotate(2deg)',opacity:0}],{duration:240,delay:90,easing:'cubic-bezier(.3,0,.2,1)',fill:'forwards'}).finished;
  await row.animate([{height:height+'px',marginTop:'20px',paddingTop:'20px',paddingBottom:'3px',borderTopWidth:'1px'},{height:'0px',marginTop:'0px',paddingTop:'0px',paddingBottom:'0px',borderTopWidth:'0px'}],{duration:130,easing:'cubic-bezier(.2,0,.2,1)',fill:'forwards'}).finished;
 }catch{/* Navigation can cancel an animation; saved completion stays intact. */}
}
