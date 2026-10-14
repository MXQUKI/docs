// Writes isolated synthetic rows only; requires explicit invocation with a test database.
import { randomUUID, randomBytes } from 'node:crypto';
import { Store, submit } from '../server/applications.js';
import { questions, validateAnswers, version } from '../src/forms/frc.js';
import assert from 'node:assert/strict';
if(process.env.NICE_RUN_DATABASE_SMOKE!=='true')throw new Error('Explicit test database opt-in required');
Object.assign(process.env,{APPLICATIONS_OPEN:'true',APPLICATION_DEADLINE:'',FEISHU_APP_ID:'database-smoke-only',FEISHU_APP_SECRET:'not-used',FEISHU_BASE_TOKEN:'not-used',FEISHU_TABLE_ID:'not-used',FEISHU_SUBMISSION_ID_FIELD:'not-used',RECEIPT_SIGNING_SECRET:randomBytes(48).toString('hex'),CRON_SECRET:randomBytes(48).toString('hex')});
const answers=Object.fromEntries(questions.filter(q=>q.required).map(q=>[q.id,q.type==='number'?0:q.type==='checkbox'?q.choices!.map(c=>c.value):q.type==='radiogroup'?q.choices![0]!.value:'DATABASE-SMOKE-NOT-AN-APPLICATION']));
Object.assign(answers,{q1:'FRC',q4:'是',q5:'否',q18:'test@example.com'});
const checked=validateAnswers(answers);assert.deepEqual(checked.errors,{});
const body={id:randomUUID(),version,locale:'zh-Hant',answers:checked.answers};
const store=new Store();let writes=0;
const write=async()=>{writes++;return 'synthetic-database-smoke';};
const request=()=>new Request('https://test.invalid/api/applications',{method:'POST',headers:{Origin:'https://test.invalid'},body:JSON.stringify(body)});
const responses=await Promise.all([submit(request(),store,write),submit(request(),store,write)]);
assert.ok(responses.every(r=>r.ok));assert.equal(writes,1);assert.equal((await store.get(body.id))?.state,'synced');
await store.cleanup();
console.log(JSON.stringify({id:body.id,concurrentWrites:writes,state:'synced',database:'real preview database',feishu:'mocked; no Feishu record created'}));
