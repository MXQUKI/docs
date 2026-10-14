import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const base=process.env.NICE_TEST_URL??'http://127.0.0.1:4321';
const screenshot=process.env.NICE_SCREENSHOT_PATH??join(tmpdir(),'nice-home-application-button.png');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for (const [prefix,label] of [['','申请赞助'],['/zh-hant','申請贊助'],['/en','Apply for support']]) {
    for (const width of [320,390,1440]) for (const theme of ['light','dark']) {
      const context=await browser.newContext({viewport:{width,height:900}});
      await context.addInitScript(({theme,locale})=>{try{localStorage.setItem('starlight-theme',theme);localStorage.setItem('nice-language',JSON.stringify({locale,expiresAt:Date.now()+86400000}));}catch{}},{theme,locale:prefix==='/en'?'en':prefix? 'zh-Hant':'zh-CN'});
      const page=await context.newPage();await page.goto(base+prefix+'/');
      const action=page.getByRole('link',{name:label,exact:true});await action.waitFor();
      const title=await page.locator('h1').boundingBox();const button=await action.boundingBox();
      assert.ok(button.x>=title.x+title.width-1,'Button is not to the right of title');
      assert.ok(Math.abs((button.y+button.height/2)-(title.y+title.height/2))<2,'Button and title do not share a row');
      assert.equal(await action.getAttribute('href'),prefix+'/team-nice/frc-2027/');
      assert.equal(await action.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(217, 71, 0)');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
      if(width===1440&&theme==='light'&&!prefix)await page.screenshot({path:screenshot});
      await context.close();
    }
  }
  console.log('Homepage button: 3 languages × 3 widths × 2 themes; right alignment, same row, orange background and target links passed.');
} finally {await browser.close();}
