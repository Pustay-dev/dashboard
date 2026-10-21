const today=dateKey(),state=$getWorkflowStaticData('global'),plan=availablePlan(state,week(today));
const query=$input.first().json.query||{};
if(query.format==='plan'){
 const data=await this.helpers.prepareBinaryData(Buffer.from(JSON.stringify(plan),'utf8'),'This Morning.json','application/json');
 return [{json:{contentType:'application/json',disposition:'inline'},binary:{data}}];
}
const day=plan.days.find(d=>d.date===today),w=day.workout;
const ascii=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[–—→]/g,'-').replace(/×/g,'x').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[^\x20-\x7e]/g,' ');
const widths=[[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584],[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584]];
const wrap=(value,size=10,bold=false)=>{const lines=[];let line='';const length=s=>[...s].reduce((n,c)=>n+(widths[bold?1:0][c.charCodeAt(0)-32]||500),0)*size/1000;for(const word of ascii(value).split(/\s+/)){if(length((line+' '+word).trim())>505){if(line)lines.push(line);line='';for(const char of word){if(length(line+char)>505){lines.push(line);line=''}line+=char}}else line=(line+' '+word).trim()}if(line)lines.push(line);return lines};
const items=[];
const add=(text,size=10,bold=false,gap=0)=>{for(const line of wrap(text,size,bold))items.push({text:line,size,bold,height:size*1.25});if(gap)items.push({height:gap})};
add('THIS MORNING',26,true,3);
add(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date()),10,false,19);
add('01  MEDITATION  /  5 min',13,true,5);add(day.meditation,10,false,17);
add('02  WORKOUT  /  '+(w.duration?w.duration+' min':'Rest'),13,true,4);add(w.name,12,true,6);
if(w.rows.length){for(const r of w.rows){add(r.time+' min  |  '+r.name,10,true);add(r.sets+(r.rest?'  /  Rest: '+r.rest:'')+(r.load?'  /  '+r.load:''),9,false,5)}}else add('No scheduled workout. Take an easy walk if you feel like it.',10,false,6);
if(w.note)add(w.note,9,false,9);else items.push({height:12});
add('03  MINDSET  /  2 min',13,true,5);add(day.mindset,10,false,12);
add('________________________________________________________________________________',9,false,10);
add(plan.summary,9,false,0);
const height=items.reduce((n,x)=>n+x.height,0),scale=Math.min(1,694/height);
const esc=s=>s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
let y=790;const commands=[];
for(const item of items){if(item.text)commands.push(`BT /${item.bold?'F2':'F1'} ${(item.size*scale).toFixed(2)} Tf 1 0 0 1 42 ${y.toFixed(2)} Tm (${esc(item.text)}) Tj ET`);y-=item.height*scale;}
commands.push('0.8 G 0.5 w 42 77 m 553 77 l S 0 G');
commands.push('BT /F2 10 Tf 1 0 0 1 42 59 Tm ([ ] Meditation     [ ] Workout     [ ] Mindset) Tj ET');
commands.push(`BT /F1 8 Tf 1 0 0 1 42 40 Tm (${esc(ascii(plan.source+' | Feedback: jakub.pustay.cz - Workout'))}) Tj ET`);
const stream=commands.join('\n');
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',`<< /Length ${Buffer.byteLength(stream,'ascii')} >>\nstream\n${stream}\nendstream`];
let pdf='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf,'ascii'));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`});const xref=Buffer.byteLength(pdf,'ascii');pdf+=`xref\n0 7\n0000000000 65535 f \n`;for(const off of offsets.slice(1))pdf+=`${String(off).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
const data=await this.helpers.prepareBinaryData(Buffer.from(pdf,'ascii'),'This Morning.pdf','application/pdf');
return [{json:{contentType:'application/pdf',disposition:'attachment; filename="This Morning.pdf"'},binary:{data}}];
