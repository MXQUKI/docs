import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const base=process.env.NICE_TEST_URL??'http://127.0.0.1:4321';
const out=process.env.NICE_SCREENSHOTS??join(tmpdir(),'nice-application-screenshots');
mkdirSync(out,{recursive:true});
const {questions,version}=JSON.parse(readFileSync('src/content/docs/_data/frc-2027.json','utf8'));
const fixture=Object.fromEntries(questions.filter(q=>q.required).map(q=>[q.id,q.type==='number'?2020:q.type==='checkbox'||q.type==='ranking'?q.choices.map(c=>c.value):q.type==='radiogroup'?q.choices[0].value:'Example answer']));
fixture.q1='FRC';fixture.q4='是';fixture.q5='否';fixture.q18='test@example.com';
const browser=await chromium.launch({channel:process.env.NICE_BROWSER_CHANNEL??'chrome',headless:true});
const errors=[];
async function setup({draft,viewport={width:1440,height:1000},theme='light',open=true}={}){
  const context=await browser.newContext({viewport});
  context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
  await context.addInitScript(({draft,theme})=>{
    try {
      localStorage.setItem('starlight-theme',theme);
      if(draft&&!sessionStorage.getItem('nice-frc-2027-draft'))sessionStorage.setItem('nice-frc-2027-draft',JSON.stringify(draft));
    } catch { /* The init script also runs on about:blank. */ }
  },{draft,theme});
  await context.route('**/api/applications',route=>route.fulfill({json:{open}}));
  return {context,page:await context.newPage()};
}
try{
  for(const [locale,prefix]of [['zh-CN',''],['zh-Hant','/zh-hant'],['en','/en']])for(const [device,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]])for(const theme of ['light','dark']){
    const {context,page}=await setup({viewport,theme});
    await page.goto(`${base}${prefix}/team-nice/frc-2027/`);
    await page.waitForSelector('.sd-question');
    assert.ok(await page.getByRole('radio',{name:'FRC',exact:true}).count());
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${locale} ${device} overflow`);
    await page.getByRole('radio',{name:'FRC',exact:true}).locator('..').click();
    await page.locator('[data-application] input[type="text"]').first().waitFor();
    await page.waitForTimeout(500);
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:join(out,`${locale}-${device}-${theme}.png`),fullPage:true});
    if(locale==='zh-Hant'){
      const text=await page.locator('[data-application]').innerText();
      assert.match(text,/隊伍是否授權您代表團隊送出本次申請/);
      assert.doesNotMatch(text,/提交|联系人|信息|加载/);
    }
    if(theme==='dark') {
      const color=await page.locator('.sd-root-modern').evaluate(e=>getComputedStyle(e).getPropertyValue('--sjs2-color-utility-body'));
      assert.ok(color && !color.includes('255, 255, 255'),`dark theme missing: ${color}`);
    }
    await context.close();
  }
  console.log('Three languages × desktop/mobile × light/dark: render and overflow passed.');
  {
    const {context,page}=await setup();
    await page.goto(`${base}/en/team-nice/frc-2027/`);
    await page.getByRole('radio',{name:'Other',exact:true}).locator('..').click();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('[data-application] input[type="text"]').count(),0);
    await page.getByRole('radio',{name:'FRC',exact:true}).locator('..').click();
    await page.getByRole('radio',{name:'No',exact:true}).first().locator('..').click();
    // Match the source: registration No does not introduce an extra rejection rule.
    assert.equal(await page.locator('[data-application-survey]').isVisible(),true);
    await page.getByRole('radio',{name:'No',exact:true}).last().locator('..').click();
    await page.waitForTimeout(350);
    assert.equal(await page.getByText('Is your team receiving product or voucher sponsorship from another FRC component supplier?',{exact:true}).isVisible(),false);
    await context.close();
  }
  {
    const draft={version,answers:fixture,page:4,savedAt:Date.now()};
    const {context,page}=await setup({draft});
    await page.goto(`${base}/en/team-nice/frc-2027/`); await page.waitForSelector('.sd-question');
    assert.match(await page.locator('[data-application]').innerText(),/Product needs/);
    await page.locator('[data-language-select]').selectOption('zh-Hant');
    await page.waitForURL('**/zh-hant/team-nice/frc-2027/'); await page.waitForSelector('.sd-question');
    assert.match(await page.locator('[data-application]').innerText(),/產品需求/);
    const restored=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('nice-frc-2027-draft')));
    assert.deepEqual(restored.answers.q27,fixture.q27);assert.equal(restored.answers.q18,fixture.q18);assert.equal(restored.page,4);
    await page.reload(); await page.waitForSelector('.sd-question');
    assert.match(await page.locator('[data-application]').innerText(),/產品需求/);
    await context.close();
  }
  {
    const {context,page}=await setup({draft:{version,answers:fixture,page:7,savedAt:Date.now()}});
    let received;
    await context.route('**/api/applications',async route=>{
      if(route.request().method()==='GET')return route.fulfill({json:{open:true}});
      received=route.request().postDataJSON();
      return route.fulfill({status:202,json:{id:received.id,receipt:'a'.repeat(64),state:'pending'}});
    });
    await page.goto(`${base}/en/team-nice/frc-2027/`);await page.waitForSelector('.sd-question');
    await page.getByRole('button',{name:'Review answers',exact:true}).click();
    await page.getByRole('button',{name:'Confirm submission',exact:true}).click();
    await page.getByText(/Your application has been received/).waitFor();
    assert.equal(received.answers.q4,'是');assert.deepEqual(received.answers.q27,fixture.q27);assert.equal(received.locale,'en');
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('nice-frc-2027-draft')),null);
    await context.route('**/api/application-status?*',route=>route.fulfill({json:{id:received.id,state:'synced'}}));
    await page.getByRole('button',{name:'Check submission status',exact:true}).click();
    await page.getByText(/Your application has been submitted/).waitFor();
    await context.close();
  }
  {
    const {context,page}=await setup({open:false});
    await page.goto(`${base}/zh-hant/team-nice/frc-2027/`);
    await page.getByText(/申請暫未開放/).waitFor();assert.equal(await page.locator('.sd-question').count(),0);
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log('Source visibility branches, language draft recovery, full submit, pending receipt, status recovery and closed state passed.');
}finally{await browser.close();}
