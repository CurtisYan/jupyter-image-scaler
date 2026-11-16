const {chromium} = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const out = process.env.JIS_RUN;
(async () => {
  const browser = await chromium.connectOverCDP(process.env.JIS_CDP || 'http://127.0.0.1:9361');
  try {
    const page = browser.contexts()[0].pages()[0];
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    let frame;
    for (let n=0;n<100&&!frame;n++) {
      for (const candidate of page.frames()) if (await candidate.locator('.jis-wrap').count() === 3) frame=candidate;
      if (!frame) await page.waitForTimeout(100);
    }
    assert.ok(frame, 'Rendered attachment toolbar did not load');
    const checks=[];
    const resizeErrors=[];page.on('pageerror',error=>{if(error.message.includes('ResizeObserver'))resizeErrors.push(error.message);});
    const wraps=frame.locator('.jis-wrap');
    const width=i=>wraps.nth(i).locator('img').evaluate(e=>e.getBoundingClientRect().width);
    const near=(a,b)=>assert.ok(Math.abs(a-b)<1,`${a} != ${b}`);
    const reveal=async image=>{
      const h=await page.evaluate(()=>innerHeight);
      for(let n=0;n<15;n++) {
        const box=await image.boundingBox();
        if(box && box.y>=125 && box.y< h-100) break;
        await page.mouse.move(450,350);await page.mouse.wheel(0,box ? box.y-180 : 250);await page.waitForTimeout(120);
      }
      const box=await image.boundingBox(); await page.mouse.move(Math.max(100,box.x+3),box.y+3); await page.waitForTimeout(150);
    };
    const apply=async(i,text)=>{
      await reveal(wraps.nth(i).locator('img'));
      await wraps.nth(i).getByRole('button',{name:`缩放 ${text} · ${i===2?'large.png':i===1?'second-image.png':'image.png'}`,exact:true}).click();
      await page.waitForTimeout(250);
    };
    const gear=async()=>{
      await reveal(wraps.first().locator('img'));
      await wraps.first().getByRole('button',{name:'设置快捷档位或自定义尺寸 · image.png',exact:true}).click();
    };
    const option=async text=>{await page.getByRole('option',{name:text,exact:true}).click();};
    const input=async text=>{await page.locator('.quick-input-box input').fill(text);await page.keyboard.press('Enter');await page.waitForTimeout(150);};
    await gear();await option('恢复默认四个档位');await page.waitForTimeout(150);
    await gear();await option('切换菜单样式');await page.getByRole('option').filter({hasText:'左上角悬浮'}).click();await page.waitForTimeout(150);
    await apply(0,'100%'); const base=await width(0); const other=await width(1);
    for(const percent of [25,50,75,100]) {
      await apply(0,`${percent}%`); near(await width(0),base*percent/100); near(await width(1),other);
      assert.equal(await wraps.first().getByRole('button',{name:`缩放 ${percent}% · image.png`,exact:true}).getAttribute('aria-pressed'),'true');
    }
    console.log('PASS',checks.length+1);checks.push('Hover buttons change only the target image and highlight current preset without entering edit mode');
    await apply(2,'100%'); const large=await width(2); const largeActual=[];
    for(const percent of [25,50,75,100]){await apply(2,`${percent}%`);near(await width(2),large*percent/100);largeActual.push({percent,width:await width(2)});}
    console.log('PASS',checks.length+1);checks.push('Large image 25/50/75/100% have distinct widths relative to default visible width');
    await gear(); await option('添加百分比快捷档位'); await input('60');
    await apply(0,'60%'); near(await width(0),base*.6);
    assert.ok(await wraps.nth(1).getByRole('button',{name:'缩放 60% · second-image.png',exact:true}).count());
    console.log('PASS',checks.length+1);checks.push('Custom 60% shortcut appears on every image and applies correctly');
    await gear(); await option('自定义尺寸：应用到这张图'); await input('320x180');
    await option('同时保存为快捷档位'); await page.waitForTimeout(250);
    near(await width(0),320);near(await wraps.first().locator('img').evaluate(e=>e.getBoundingClientRect().height),180);
    await apply(0,'50%'); await apply(0,'320 × 180');near(await width(0),320);
    console.log('PASS',checks.length+1);checks.push('Custom 320x180 applies from gear, saves as shortcut and can be reapplied');
    await gear();await option('自定义尺寸：应用到这张图');await input('240');await option('仅应用这一次');await page.waitForTimeout(200);
    near(await width(0),240);near(await wraps.first().locator('img').evaluate(e=>e.getBoundingClientRect().height),120);
    console.log('PASS',checks.length+1);checks.push('Width-only custom size keeps original aspect ratio');
    await gear();await option('自定义尺寸：应用到这张图');await page.locator('.quick-input-box input').fill('0x20');await page.waitForTimeout(150);
    await page.keyboard.press('Enter');assert.equal(await page.locator('.quick-input-widget').isVisible(),true);await page.keyboard.press('Escape');near(await width(0),240);
    console.log('PASS',checks.length+1);checks.push('Invalid dimensions are rejected and cancelling preserves current image');
    await gear();await option('删除快捷档位');await option('60%');await page.waitForTimeout(200);
    assert.equal(await wraps.first().getByRole('button',{name:'缩放 60% · image.png',exact:true}).count(),0);
    console.log('PASS',checks.length+1);checks.push('Deleting a preset refreshes visible toolbars');
    await apply(0,'320 × 180');await reveal(wraps.first().locator('img'));
    await page.keyboard.press('Meta+s');await page.waitForTimeout(200);
    const saved=JSON.parse(fs.readFileSync(`${out}/integration.ipynb`));
    assert.deepEqual(saved.cells[0].metadata.jupyterImageScaler['image.png'],{width:320,height:180,mode:'pixels'});
    const original=JSON.parse(fs.readFileSync('test/sample.ipynb'));
    assert.deepEqual(saved.cells[0].attachments['image.png'], original.cells[0].attachments['image.png']);
    console.log('PASS',checks.length+1);checks.push('Saved Notebook retains custom dimensions and exact original attachment bytes');
    await gear();await option('调整档位顺序');await option('5. 320 × 180');await option('移到最前');
    await option('1. 320 × 180');await option('下移一位');
    await option('2. 320 × 180');await option('上移一位');
    await option('1. 320 × 180');await option('移到最后');
    await option('5. 320 × 180');await option('移到最前');await option('完成排序');await page.waitForTimeout(200);
    assert.deepEqual(await wraps.first().locator('.jis-tools button').allTextContents(), ['320 × 180','25%','50%','75%','100%','']);
    assert.deepEqual(await wraps.nth(1).locator('.jis-tools button').allTextContents(), ['320 × 180','25%','50%','75%','100%','']);
    checks.push('Reordering a custom preset updates all image toolbars immediately');
    const compact = await wraps.first().locator('.jis-tools').evaluate(e=>({height:e.getBoundingClientRect().height,gear:e.querySelector('.jis-gear svg').getBoundingClientRect().width}));
    assert.ok(compact.height<=30); assert.equal(compact.gear,18);
    checks.push('Compact toolbar is at most 30px tall with a larger 18px gear icon');
    await gear();await option('切换菜单样式');await page.getByRole('option').filter({hasText:'图片外部（自动避让）'}).click();await page.waitForTimeout(250);
    assert.equal(await wraps.first().getAttribute('data-placement'),'side');
    near(await width(0),320);
    const geometry=await wraps.first().evaluate(e=>({image:e.querySelector('img').getBoundingClientRect().toJSON(),bar:e.querySelector('.jis-tools').getBoundingClientRect().toJSON()}));
    assert.ok(geometry.bar.left>=geometry.image.right+5);
    checks.push('Side style places buttons entirely outside the image without changing image width');
    await reveal(wraps.first().locator('img'));await page.screenshot({path:`${out}/side.png`});
    await apply(0,'100%');near(await width(0),base);assert.equal(await wraps.first().getAttribute('data-placement'),'below');
    const below=await wraps.first().evaluate(e=>({image:e.querySelector('img').getBoundingClientRect().toJSON(),bar:e.querySelector('.jis-tools').getBoundingClientRect().toJSON(),wrap:e.getBoundingClientRect().toJSON()}));
    assert.ok(below.bar.top>=below.image.bottom+5);assert.ok(below.wrap.bottom>=below.bar.bottom);
    checks.push('Full-width images move the menu below with reserved space and no image overlap');
    const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
    await page.setViewportSize({width:760,height:800});await page.waitForTimeout(350);
    const narrow=await wraps.first().evaluate(e=>({placement:e.dataset.placement,image:e.querySelector('img').getBoundingClientRect().toJSON(),bar:e.querySelector('.jis-tools').getBoundingClientRect().toJSON()}));
    assert.ok(narrow.placement==='below' ? narrow.bar.top>=narrow.image.bottom+5 : narrow.bar.left>=narrow.image.right+5);
    await page.setViewportSize(viewport);await page.waitForTimeout(350);
    await apply(0,'50%');
    await wraps.first().evaluate(e=>{e.style.textAlign='right';});
    await page.setViewportSize({width:viewport.width+1,height:viewport.height});await page.waitForTimeout(250);
    assert.equal(await wraps.first().getAttribute('data-side'),'left');
    const left=await wraps.first().evaluate(e=>({image:e.querySelector('img').getBoundingClientRect().toJSON(),bar:e.querySelector('.jis-tools').getBoundingClientRect().toJSON()}));
    assert.ok(left.bar.right<=left.image.left-5);
    await wraps.first().evaluate(e=>{e.style.textAlign='';});
    await page.setViewportSize(viewport);await page.waitForTimeout(250);
    checks.push('Right-aligned images automatically place the external toolbar in the free space on the left');

    assert.deepEqual(resizeErrors,[]);
    checks.push('Window resizing keeps the toolbar outside the image without ResizeObserver errors');
    await apply(0,'50%');assert.equal(await wraps.first().getAttribute('data-placement'),'side');near(await width(0),base*.5);
    await gear();await option('切换菜单样式');await page.getByRole('option').filter({hasText:'左上角悬浮'}).click();await page.waitForTimeout(200);
    assert.equal(await wraps.first().getAttribute('data-placement'),'overlay');
    checks.push('Switching back restores the compact overlay immediately');
    await reveal(wraps.first().locator('img'));
    await page.screenshot({path:`${out}/hover.png`});
    // Two identical Markdown cells, identical attachment names and different IDs.
    const duplicate=JSON.parse(JSON.stringify(original));
    duplicate.cells=[0,1].map(i=>({...JSON.parse(JSON.stringify(original.cells[0])),id:`hover-duplicate-${i}`,source:['![image](attachment:image.png)'],metadata:{jupyterImageScaler:{'image.png':{percent:25,width:200}}}}));
    const duplicateFile=`${out}/duplicates.ipynb`;fs.writeFileSync(duplicateFile,JSON.stringify(duplicate));
    await page.keyboard.press('Meta+p');await page.locator('.quick-input-box input').fill(duplicateFile);await page.waitForTimeout(1000);await page.keyboard.press('Enter');await page.waitForTimeout(700);await page.keyboard.press('Escape');
    let duplicateFrame;
    for(let n=0;n<60&&!duplicateFrame;n++){
      for(const candidate of page.frames())if(await candidate.locator('.jis-wrap').count()===2)duplicateFrame=candidate;
      if(!duplicateFrame)await page.waitForTimeout(100);
    }
    assert.ok(duplicateFrame,'Duplicate-cell notebook did not render');
    const duplicateWraps=duplicateFrame.locator('.jis-wrap');
    await duplicateWraps.nth(1).locator('img').hover();await duplicateWraps.nth(1).getByRole('button',{name:'缩放 50% · image.png',exact:true}).click();await page.waitForTimeout(250);
    await page.keyboard.press('Meta+s');await page.waitForTimeout(250);
    const duplicateSaved=JSON.parse(fs.readFileSync(duplicateFile));
    assert.equal(duplicateSaved.cells[0].metadata.jupyterImageScaler['image.png'].percent,25);
    assert.equal(duplicateSaved.cells[1].metadata.jupyterImageScaler['image.png'].percent,50);
    console.log('PASS',checks.length+1);checks.push('Identical Markdown and attachment names in two cells route to the hovered cell');
    fs.writeFileSync(`${out}/hover-result.json`,JSON.stringify({ok:true,checks,largeActual},null,2));
    fs.writeFileSync(`${out}/release`,'done');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
