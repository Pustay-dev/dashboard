const response=$input.first().json;
const choice=response.choices?.[0];
if(choice?.finish_reason!=='stop'||choice.message?.refusal)throw Error('AI response incomplete; previous plan retained');
const start=$('Prepare weekly AI request').first().json.weekStart;
const plan=validate(JSON.parse(choice.message.content),start);
const state=$getWorkflowStaticData('global');
// Mutate persistent state only after every day and exercise passes validation.
state.weeks={...(state.weeks||{}),[start]:{...plan,generatedAt:new Date().toISOString()}};
for(const old of Object.keys(state.weeks).sort().slice(0,-4))delete state.weeks[old];
return [{json:{saved:true,weekStart:start,summary:plan.summary}}];
