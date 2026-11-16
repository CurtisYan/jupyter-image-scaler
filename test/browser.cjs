const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  for(let n=0;n<100 && !fs.existsSync('test/run/ready.json');n++) await new Promise(r=>setTimeout(r,100));
  const browser = await chromium.connectOverCDP(process.env.JIS_CDP || 'http://127.0.0.1:9338');
  const page = browser.contexts()[0].pages()[0];
  let frame;
  for (let n=0;n<100;n++) {
    frame = page.frames().find(f => f.url().includes('purpose=notebookRenderer') && f.childFrames().length === 0);
    if (frame && await frame.locator('img[src^="data:image/"]').count()) break;
    await page.waitForTimeout(100);
  }
  const images = frame.locator('img[src^="data:image/"]');
  await images.first().waitFor();
  const sizes = () => images.evaluateAll(els => els.map(i => ({natural: i.naturalWidth, width: i.getBoundingClientRect().width, height: i.getBoundingClientRect().height})));
  let actual = await sizes();
  assert.deepEqual(actual.map(i=>i.width), [400,300]);
  assert.deepEqual(actual.map(i=>i.height), [200,150]);
  const checks = ['Actual Notebook webview renders 50% / 75% with preserved aspect ratio'];
  for (const [percent,width] of [[25,200],[50,400],[75,600],[100,800]]) {
    await images.first().dblclick();
    await page.locator(`.cell-status-item[aria-label="${percent}%"]`).click();
    await page.getByRole('option', {name: 'image.png', exact: true}).click();
    await page.waitForTimeout(250);
    await page.locator('[aria-label^="Stop Editing Cell"]').click();
    await page.waitForTimeout(450);
    actual = await sizes();
    assert.equal(actual[0].width, Math.min(width, await images.first().evaluate(i=>i.parentElement.clientWidth)));
    assert.equal(actual[1].width,300);
    checks.push(`Clicked ${percent}% status button, selected attachment; preview refreshed, second image unchanged`);
  }
  // Exercise the public shortcut and ratio picker, including cancellation.
  await page.keyboard.press('Meta+Alt+i');
  await page.getByRole('option', {name: 'image.png', exact: true}).click();
  await page.getByRole('option').filter({hasText:'50%'}).click();
  await page.waitForTimeout(500);
  assert.equal((await sizes())[0].width,400);
  checks.push('macOS shortcut opens image chooser then percentage picker');
  await page.keyboard.press('Meta+Alt+i');
  await page.getByRole('option', {name: 'image.png', exact: true}).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('option', {name: 'image.png', exact: true}).waitFor({state:'hidden'});
  await page.waitForTimeout(100);
  assert.equal((await sizes())[0].width,400);
  checks.push('Cancelling image chooser leaves size unchanged');
  await page.keyboard.press('Meta+s');
  // Keep preview visible in the screenshot.
  await page.screenshot({path:'test/run/preview.png'});
  fs.writeFileSync('test/run/browser-result.json',JSON.stringify({ok:true,checks,actual:await sizes()},null,2));
  fs.writeFileSync('test/run/release','done');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
