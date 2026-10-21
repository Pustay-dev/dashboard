import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const baseline=JSON.parse(fs.readFileSync(path.join(dir,'baseline.json'),'utf8'));
const common='const BASELINE='+JSON.stringify(baseline)+';\n'+fs.readFileSync(path.join(dir,'common.js'),'utf8');
const code=file=>common+'\n'+fs.readFileSync(path.join(dir,file),'utf8');
// Paths are generated only into the private deliverable, never committed in source.
const privatePath='this-morning-'+crypto.randomUUID().replaceAll('-','');
const nodes=[];
function node(name,type,version,parameters,position){const n={id:crypto.randomUUID(),name,type:'n8n-nodes-base.'+type,typeVersion:version,parameters,position};nodes.push(n);return n}
node('Check weekly plan at 05:00','scheduleTrigger',1.2,{rule:{interval:[{field:'cronExpression',expression:'0 5 * * *'}]}},[200,120]);
node('Generate missing week only','code',2,{jsCode:common+`\nconst start=week(dateKey());return $getWorkflowStaticData('global').weeks?.[start]?[]:[{json:{weekStart:start}}];`},[440,120]);
node('Read synced workout feedback','httpRequest',4.2,{url:'https://api.jsonbin.io/v3/b/6a9c92e0da38895dfe3df482/latest',authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',options:{timeout:20000}},[680,120]);
node('Prepare weekly AI request','code',2,{jsCode:code('prepare.js')},[920,120]);
node('Generate weekly MWM with OpenAI','httpRequest',4.2,{method:'POST',url:'https://api.openai.com/v1/chat/completions',authentication:'predefinedCredentialType',nodeCredentialType:'openAiApi',sendBody:true,specifyBody:'json',jsonBody:'={{ JSON.stringify($json.request) }}',options:{timeout:90000}},[1160,120]);
node('Validate and save weekly plan','code',2,{jsCode:code('save.js')},[1400,120]);
const hook=node('Get This Morning','webhook',2,{httpMethod:'GET',path:privatePath,responseMode:'responseNode',options:{}},[440,460]);hook.webhookId=crypto.randomUUID();
node('Build PDF or website plan','code',2,{jsCode:code('serve.js')},[680,460]);
node('Return to iPad or website','respondToWebhook',1.4,{respondWith:'binary',responseDataSource:'set',inputFieldName:'data',options:{responseHeaders:{entries:[{name:'Content-Type',value:'={{ $json.contentType }}'},{name:'Content-Disposition',value:'={{ $json.disposition }}'},{name:'Cache-Control',value:'no-store'},{name:'Access-Control-Allow-Origin',value:'https://jakub.pustay.cz'},{name:'Vary',value:'Origin'}]}}},[920,460]);
node('Setup - read first','stickyNote',1,{content:'## This Morning - weekly AI + daily PDF\n1. In Read synced workout feedback, select/create Header Auth: Name X-Master-Key; Value your JSONBin master key. You may use a read-only JSONBin access key instead: header X-Access-Key.\n2. In Generate weekly MWM with OpenAI, select your OpenAI API credential. API billing is separate from ChatGPT. No keys belong in this JSON or GitHub.\n3. Publish/activate this workflow. Disable the old morning PDF workflow if you no longer use it.\n4. Copy Get This Morning > Production URL to BOTH your iPad shortcut and website Settings > Workout plan. The URL is private access to the generated plan, so keep it private.\n5. Test that URL with the iPad shortcut: one A4 PDF should be saved. Move the difficulty slider on the website; add an optional note under Workout > This week > Next week. Confirm cloud sync.\nThe trigger checks daily at 05:00 Europe/Prague, generating only when this week has no valid plan (normally Monday; first setup on any day). Failed weeks retry the next day, retaining the previous plan. Until first production generation, the fixed plan is used. Manual editor tests do not persist n8n static data: use the active scheduled run. Configure the iPad download after 05:00. No measurements or check-in/roadmap data are sent to AI. No writes are made to JSONBin.\nFeedback fields: workoutFeedback[date:type]={date,type,difficulty,updatedAt}; weeklyFeedback[Monday]={weekStart,note,updatedAt}. Exercise results and prescription snapshots are included in the AI review. Last 4 generated weeks are retained. Endpoint format=plan is read-only and used by the website. Weekend rest and Friday gym override remain available.\nSource: https://github.com/Pustay-dev/dashboard/tree/main/automation-src',width:930,height:560},[190,-500]);
const connections={};
const connect=(a,b)=>connections[a]={main:[[{node:b,type:'main',index:0}]]};
const chain=['Check weekly plan at 05:00','Generate missing week only','Read synced workout feedback','Prepare weekly AI request','Generate weekly MWM with OpenAI','Validate and save weekly plan'];
chain.slice(0,-1).forEach((n,i)=>connect(n,chain[i+1]));connect('Get This Morning','Build PDF or website plan');connect('Build PDF or website plan','Return to iPad or website');
const workflow={name:'This Morning - Weekly AI and Daily PDF',nodes,connections,settings:{executionOrder:'v1',timezone:'Europe/Prague',executionTimeout:180,saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveManualExecutions:false},active:false,pinData:{},tags:[]};
const out=process.argv[2];if(!out)throw Error('Usage: node automation-src/build-workflow.mjs /absolute/private/output.json');
fs.writeFileSync(out,JSON.stringify(workflow,null,2));console.log('Created '+out);
