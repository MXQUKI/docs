import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Model } from 'survey-core';
import { questions, schema, supportedLocales, validateAnswers, visible, version, copy } from '../src/forms/frc.ts';
import { authentic, configured, isOpen, mapFields, payloadHash, processSubmission, receipt, submit } from '../server/applications.ts';

function valid() {
  const answers = Object.fromEntries(questions.filter(q => q.required).map(q => [q.id, q.type === 'number' ? 2020 : q.type === 'checkbox' || q.type === 'ranking' ? q.choices.map(c => c.value) : q.type === 'radiogroup' ? q.choices[0].value : 'Example answer']));
  answers.q1 = 'FRC'; answers.q4 = '是'; answers.q5 = '否'; answers.q18 = 'test@example.com';
  return validateAnswers(answers).answers;
}
test('40 main questions and four optional details retain unique existing field IDs and complete Taiwan/English translations', () => {
  assert.equal(questions.length, 44); assert.equal(new Set(questions.map(q => q.fieldId)).size, 44);
  for (const q of questions) for (const locale of supportedLocales) {
    assert.ok(q.title[locale]); assert.equal(typeof q.description[locale], 'string');
    for (const c of q.choices ?? []) assert.ok(c.text[locale]);
  }
  for (const text of Object.values(copy)) assert.ok(Object.values(text).every(v => typeof v === 'string' && v));
  assert.match(questions[12].title['zh-Hant'], /志工/);
  assert.match(questions[14].title['zh-Hant'], /社群媒體/);
  assert.match(questions.find(q=>q.id==='q37').title['zh-Hant'], /抵用券/);
  assert.equal(copy['zh-Hant'].submit, '確認送出');
});
test('front-end and server agree on visibility for every language and all eligibility branches', () => {
  for (const locale of supportedLocales) for (const q1 of [undefined, 'FRC', '其他']) for (const q4 of [undefined, '是', '否']) for (const q5 of [undefined, '否', '是', '不确定', '正在申请，但尚未确认']) for (const q25 of [undefined, '经常使用', '使用过少量产品', '了解过，但尚未购买', '第一次了解NICE Robotics']) {
    const a = { q1, q4, q5, q25 }; const model = new Model(schema(locale)); model.clearInvisibleValues = 'none'; model.data = a;
    for (const q of questions) assert.equal(model.getQuestionByName(q.id).isVisible, visible(q.id, a), `${locale} ${q.id} ${JSON.stringify(a)}`);
    model.dispose();
  }
});
test('locale switching preserves answer values, ranking and progress', () => {
  const model = new Model(schema('en')); model.data = valid(); model.currentPageNo = 4;
  const before = JSON.stringify(model.data);
  for (const locale of ['zh-tw','zh-cn','en']) { model.locale = locale; assert.equal(JSON.stringify(model.data), before); assert.equal(model.currentPageNo, 4); }
  model.dispose();
});
test('server follows source branches and rejects missing declarations, duplicate choices and forged choices', () => {
  assert.deepEqual(validateAnswers(valid()).errors, {});
  for (const patch of [{q36:questions.find(q=>q.id==='q36').choices.slice(1).map(c=>c.value)}, {q37:Array(6).fill(questions.find(q=>q.id==='q37').choices[0].value)}, {q27:Array(11).fill('可靠性')}, {q25:'Yes, regularly'}, {q11:2.5}]) {
    assert.ok(Object.keys(validateAnswers({...valid(),...patch}).errors).length);
  }
  assert.equal(validateAnswers({...valid(),q11:0,q13:0}).answers.q13, 0);
  const checked=validateAnswers({...valid(),q5:'否',q6:'old hidden value',q25:'第一次了解NICE Robotics',q26:['齿轮'],unknown:'injected'});
  assert.equal(checked.answers.q6,undefined); assert.equal(checked.answers.q26,undefined); assert.equal(checked.answers.unknown,undefined);
  assert.deepEqual(validateAnswers({...valid(),q1:'其他'}),{answers:{q1:'其他'},errors:{}});
  const denied=validateAnswers({...valid(),q4:'否'});
  assert.deepEqual(denied.errors,{});assert.deepEqual(Object.keys(denied.answers),['q1','q2','q3','q4']);
});
test('Feishu mapping uses existing canonical options and refuses schema drift', () => {
  process.env.FEISHU_SUBMISSION_ID_FIELD='fld_submission';
  const fields=questions.map(q=>({field_id:q.fieldId,field_name:`stored_${q.id}`,type:q.type==='radiogroup'?3:q.type==='checkbox'?4:q.type==='number'?2:1,property:{options:(q.choices??[]).map(c=>({name:c.value}))}}));
  fields.push({field_id:'fld_submission',field_name:'提交唯一标识',type:1});
  const mapped=mapFields(valid(),fields,'id');
  assert.equal(mapped.stored_q4,'是'); assert.equal(mapped['提交唯一标识'],'id'); assert.deepEqual(mapped.stored_q27,valid().q27);
  assert.throws(()=>mapFields(valid(),fields.filter(f=>f.field_id!==questions[0].fieldId),'id'));
  fields.find(f=>f.field_id===questions[3].fieldId).property.options=[];
  assert.throws(()=>mapFields(valid(),fields,'id'));
});

class MemoryStore {
  rows=new Map();
  async allow(){return true;}
  async get(id){return this.rows.get(id);}
  async stage(id,payload){if(!this.rows.has(id))this.rows.set(id,{id,payload,hash:payloadHash(payload),state:'pending',attempts:0,created_at:new Date().toISOString()});return this.rows.get(id);}
  async claim(id){const row=this.rows.get(id);if(row?.state!=='pending')return;row.state='syncing';row.attempts++;return row;}
  async done(id,record_id){Object.assign(this.rows.get(id),{state:'synced',record_id});}
  async fail(id,code,blocked){Object.assign(this.rows.get(id),{state:blocked?'blocked':'pending',last_error:code});}
}
function env(){Object.assign(process.env,{DATABASE_URL:'postgresql://test:test@example.test/test',FEISHU_APP_ID:'test',FEISHU_APP_SECRET:'test',FEISHU_BASE_TOKEN:'test',FEISHU_TABLE_ID:'test',FEISHU_SUBMISSION_ID_FIELD:'fld_submission',RECEIPT_SIGNING_SECRET:'a'.repeat(64),CRON_SECRET:'b'.repeat(64),APPLICATIONS_OPEN:'true',APPLICATION_DEADLINE:''});}
function request(body,origin='https://example.test'){return new Request('https://example.test/api/applications',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});}
test('durable submission, concurrent duplicate, receipt after closing, conflict and origin protection', async()=>{
  env(); const store=new MemoryStore(); let writes=0;
  const write=async()=>{writes++;return 'rec_test';};
  const body={id:randomUUID(),version,locale:'en',answers:valid()};
  const results=await Promise.all([submit(request(body),store,write),submit(request(body),store,write)]);
  assert.ok(results.every(r=>r.ok)); assert.equal(writes,1);
  process.env.APPLICATIONS_OPEN='false';
  assert.equal((await submit(request(body),store,write)).status,200);
  assert.equal((await submit(request({...body,id:randomUUID()}),store,write)).status,403);
  assert.equal((await submit(request({...body,answers:{...body.answers,q7:'changed'}}),store,write)).status,409);
  assert.equal((await submit(request(body,'https://attacker.test'),store,write)).status,403);
  assert.equal(authentic(body.id,receipt(body.id)),true); assert.equal(authentic(randomUUID(),receipt(body.id)),false);
});
test('upstream failure stays durable and recoverable without a false success', async()=>{
  env(); const store=new MemoryStore(); const body={id:randomUUID(),version,locale:'zh-Hant',answers:valid()};
  const res=await submit(request(body),store,async()=>{throw new Error('timeout');});
  assert.equal(res.status,202); assert.equal((await res.json()).state,'pending'); assert.ok(store.rows.get(body.id).payload);
  await processSubmission(store,body.id,async()=> 'rec_recovered'); assert.equal(store.rows.get(body.id).state,'synced');
});
test('server rejects malformed bodies and stays closed with incomplete configuration',async()=>{
  env(); const store=new MemoryStore(); const body={id:randomUUID(),version,locale:'en',answers:valid()};
  assert.equal((await submit(request({...body,answers:{}}),store,async()=> 'never')).status,422);
  assert.equal(store.rows.size,0);
  assert.equal((await submit(request({...body,version:'old'}),store)).status,409);
  assert.equal((await submit(request({...body,answers:{q22:'x'.repeat(100001)}}),store)).status,413);
  process.env.APPLICATION_DEADLINE='invalid'; assert.equal(isOpen(),false);
  process.env.CRON_SECRET=''; assert.equal(configured(),false);
});
