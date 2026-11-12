import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../storefront-suggestions.js',import.meta.url),'utf8');
const make=(id,family_id,extra={})=>({id,family_id,max_subjects:3,subject_type:'human',example_image_url:'https://example.com/'+id+'.webp',placements:[{category_id:'men'}],...extra});
const a=make('a-men','a'),b=make('b-men','b'),c=make('c-men','c'),sibling=make('c-women','c',{placements:[{category_id:'women'}]}),pet=make('pet','p',{subject_type:'pet'}),couple=make('couple','a',{placements:[{category_id:'couples'}]});
const source=make('source','source',{suggested_style_ids:['c-women','a-men','c-men','pet','couple','unavailable']});const rules={styles:[source,a,b,c,sibling,pet,couple]};
class Creator{constructor(){this.styles=new Map(rules.styles.map(s=>[s.id,s]));}styleChoices(){return {ranked:[a,b],remaining:[c]};}openStyleMenu(){return this.styleChoices({style_id:'source',subject_count:1,subject_kinds:['person']});}}
const window={NSLCatalogue:{refresh:async()=>rules}};
vm.runInNewContext(code,{window,customElements:{whenDefined:async()=>{},get:()=>Creator}});await new Promise(r=>setTimeout(r,10));
const creator=new Creator(),result=await creator.openStyleMenu();
assert.equal(JSON.stringify(result.ranked.map(s=>s.id)),JSON.stringify(['c-women','a-men','c-men']),'exact sibling variants survive original family deduplication');assert.equal(JSON.stringify(result.remaining.map(s=>s.id)),JSON.stringify(['b-men']));assert.ok(!result.ranked.some(s=>['pet','couple','unavailable'].includes(s.id)),'cast compatibility must still be enforced');creator.styles.set('automatic',{suggested_style_ids:[]});assert.deepEqual(creator.styleChoices({style_id:'automatic'}).ranked,[a,b]);console.log('PASS: exact variants in the same family, configured ordering, incompatible/absent variants excluded, automatic fallback.');
