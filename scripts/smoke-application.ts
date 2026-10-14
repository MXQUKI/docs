// Explicit opt-in: writes one clearly labelled integration-test record to the configured Feishu table.
import { randomUUID, randomBytes } from 'node:crypto';
import { questions, validateAnswers, version } from '../src/forms/frc.js';
import { Store, submit, authentic } from '../server/applications.js';
if (process.env.NICE_RUN_LIVE_SMOKE !== 'true') throw new Error('Set NICE_RUN_LIVE_SMOKE=true only for an authorized integration test.');
process.env.APPLICATIONS_OPEN = 'true'; // Local process only; does not change deployed collection.
process.env.APPLICATION_DEADLINE = '';
process.env.RECEIPT_SIGNING_SECRET ||= randomBytes(48).toString('hex');
process.env.CRON_SECRET ||= randomBytes(48).toString('hex');
const answers = Object.fromEntries(questions.filter(q=>q.required).map(q=>[q.id,q.type==='number'?0:q.type==='checkbox'?q.choices!.map(c=>c.value):q.type==='radiogroup'?q.choices![0]!.value:'AUTOMATED INTEGRATION TEST — NOT AN APPLICATION']));
Object.assign(answers,{q1:'FRC',q4:'是',q5:'否',q7:'【网站联调测试，请忽略】三语申请接口验证',q18:'integration-test@example.com',q3:'Pending',q25:'第一次了解NICE Robotics',q11:2026});
const checked = validateAnswers(answers);
if(Object.keys(checked.errors).length)throw new Error(JSON.stringify(checked.errors));
const body = {id:randomUUID(),version,locale:'zh-Hant',answers:checked.answers};
const req = ()=>new Request('https://integration-test.invalid/api/applications',{method:'POST',headers:{Origin:'https://integration-test.invalid','Content-Type':'application/json'},body:JSON.stringify(body)});
const store = new Store();
const first = await submit(req(),store); const result=await first.json();
const repeat=await submit(req(),store); const row=await store.get(body.id);
console.log(JSON.stringify({submissionId:body.id,http:first.status,repeatHttp:repeat.status,state:row?.state,recordId:row?.record_id,lastError:(row as any)?.last_error,receiptVerified:result.receipt?authentic(body.id,result.receipt):false}));
if(row?.state!=='synced'||repeat.status!==200)process.exitCode=1;
