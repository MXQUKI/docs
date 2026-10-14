import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const source=JSON.parse(readFileSync(process.argv[2],'utf8'));
const live=(source.data??source).questions;
const website=JSON.parse(readFileSync('src/content/docs/_data/frc-2027.json','utf8')).questions.filter(q=>!q.otherFor);
assert.equal(website.length,live.length,'Main question count changed');
for(let i=0;i<live.length;i++){
  const a=live[i],b=website[i];
  assert.equal(b.fieldId,a.id,`Order/field at ${i+1}`);
  assert.equal(b.title['zh-CN'],a.title,`Title ${a.id}`);
  assert.equal(b.description['zh-CN'],a.description??'',`Description ${a.id}`);
  assert.equal(b.required,a.required,`Required ${a.id}`);
  assert.deepEqual(b.sourceRule??null,a.visible_rule??null,`Logic ${a.id}`);
  const expected=a.type==='select'?(a.multiple?'checkbox':'radiogroup'):a.type;
  assert.ok(b.type===expected||(expected==='text'&&b.type==='comment'),`Type ${a.id}`);
  if(a.options)assert.deepEqual(b.choices.map(c=>c.value),a.options.map(c=>c.name),`Options/order ${a.id}`);
}
console.log(`${live.length} main questions match the exported Feishu source: order, fields, titles, descriptions, required flags, types, options and display rules.`);
