const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const out = process.env.JIS_RUN || 'test/run';
(async () => {
  const browser = await chromium.connectOverCDP(process.env.JIS_CDP || 'http://127.0.0.1:9338');
  try {
    const page = browser.contexts()[0].pages()[0];
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    let frame;
    for (let n = 0; n < 100; n++) {
      for (const candidate of page.frames()) {
        if (candidate !== page.mainFrame() && await candidate.locator('img[src^="data:image/"]').count() === 3) frame = candidate;
      }
      if (frame && fs.existsSync(`${out}/ready.json`)) break;
      await page.waitForTimeout(100);
    }
    assert.ok(frame, 'Notebook test images did not load');
    const images = frame.locator('img[src^="data:image/"]');
    const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1, `${actual} != ${expected}`);
    const width = i => images.nth(i).evaluate(img => img.getBoundingClientRect().width);
    const checks = [];
    const openPicker = async (index, name) => {
      const toolbar = page.locator('.markdown-cell-row [aria-label^="附件图片缩放：选择档位"]');
      if (await toolbar.count()) await toolbar.first().click();
      else {
        // Some VS Code layouts consolidate cell toolbar commands. Exercise the
        // same public command from the command palette in those layouts.
        await page.keyboard.press('Meta+Shift+p');
        await page.locator('.quick-input-box input').fill('>附件图片缩放：选择档位');
        await page.getByRole('option').filter({hasText: '附件图片缩放：选择档位'}).click();
      }
      if (name) await page.getByRole('option', {name, exact: true}).click();
      await page.locator('.quick-input-list .monaco-list-row.focused').waitFor();
    };
    const select = async percent => {
      await page.getByRole('option').filter({hasText: `${percent}%`}).click();
      await page.waitForTimeout(250);
    };
    const current = async percent => assert.match(await page.locator('.quick-input-list .monaco-list-row.focused').innerText(), new RegExp(`^${percent}%`));
    const baseWidth = await images.first().evaluate(i => Math.min(i.naturalWidth, i.parentElement.clientWidth));
    near(await width(0), baseWidth * .5);
    near(await width(1), 300);
    checks.push('Restored independent 50% and 75% metadata renders at actual expected widths');
    let previous = 50;
    for (const percent of [25, 50, 75, 100]) {
      await openPicker(0, 'image.png');
      await current(previous);
      await select(percent);
      near(await width(0), baseWidth * percent / 100);
      near(await width(1), 300);
      previous = percent;
      checks.push(`Preview command ${percent}% refreshes without edit-mode toggling; picker starts at current preset`);
    }
    await openPicker(0, 'image.png');
    await current(100);
    await page.keyboard.press('Escape');
    near(await width(0), baseWidth);
    checks.push('Cancelling the percentage picker preserves width');
    const largeDefaultWidth = await width(2);
    assert.equal(await images.nth(2).evaluate(i => i.naturalWidth), 6400);
    previous = 100;
    const largeActual = [];
    for (const percent of [25, 50, 75, 100]) {
      await openPicker(2, 'large.png');
      await current(previous);
      await select(percent);
      near(await width(2), largeDefaultWidth * percent / 100);
      largeActual.push({percent, width: await width(2)});
      previous = percent;
      checks.push(`6400px image ${percent}% uses default visible width`);
    }
    await openPicker(2, 'large.png');
    await current(100);
    await page.keyboard.press('Escape');
    checks.push('100% reset is highlighted as the current preset');
    await page.keyboard.press('Meta+s');
    const actual = await images.evaluateAll(els => els.map(i => ({natural: i.naturalWidth, width: i.getBoundingClientRect().width, height: i.getBoundingClientRect().height})));
    await page.screenshot({path: `${out}/preview.png`});
    fs.writeFileSync(`${out}/browser-result.json`, JSON.stringify({ok:true, checks, actual, largeActual}, null, 2));
    fs.writeFileSync(`${out}/release`, 'done');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
