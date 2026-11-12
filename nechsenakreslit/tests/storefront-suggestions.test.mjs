import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../storefront-suggestions.js',import.meta.url),'utf8');
const a={id:'a-men',family_id:'a'},b={id:'b-men',family_id:'b'},c={id:'c-men',family_id:'c'};const rules={styles:[{id:'source',suggested_style_ids:['c','a','unavailable']} ]};
class Creator{constructor(){this.styles=new Map([['source',{id:'source'}]]);}styleChoices(){return {ranked:[a,b],remaining:[c]};}openStyleMenu(){return this.styleChoices({style_id:'source'});}}
const window={NSLCatalogue:{familyKey:s=>'family:'+s.family_id,refresh:async()=>rules}};
vm.runInNewContext(code,{window,customElements:{whenDefined:async()=>{},get:()=>Creator},fetch:async()=>Response.json(rules),AbortSignal});await new Promise(r=>setTimeout(r,10));
const creator=new Creator();const result=await creator.openStyleMenu();assert.equal(JSON.stringify(result.ranked.map(s=>s.id)),JSON.stringify(['c-men','a-men']));assert.equal(JSON.stringify(result.remaining.map(s=>s.id)),JSON.stringify(['b-men']));assert.equal(result.ranked.some(s=>s.id==='unavailable'),false,'cannot introduce an incompatible or disabled option');creator.styles.set('automatic',{suggested_style_ids:[]});assert.deepEqual(creator.styleChoices({style_id:'automatic'}).ranked,[a,b]);console.log('PASS: explicit family ordering, unavailable targets excluded, empty selections preserve automatic choices.');
