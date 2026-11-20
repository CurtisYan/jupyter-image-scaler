const {chromium}=require('playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const out=process.env.JIS_RUN;const browser=await chromium.connectOverCDP(process.env.JIS_CDP||'http://127.0.0.1:9368');
 try{
  const page=browser.contexts()[0].pages()[0];const checks=[];let frame;
  for(let n=0;n<100&&!frame;n++) {for(const f of page.frames())if(await f.locator('.jis-wrap').count()===2)frame=f;if(!frame)await page.waitForTimeout(100);}
  assert.ok(frame,'Source-image toolbar was not rendered by VS Code');
  const wraps=frame.locator('.jis-wrap');
  const width=i=>wraps.nth(i).locator('img').evaluate(e=>e.getBoundingClientRect().width);
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1,`${a} != ${b}`);
  const reveal=async i=>{
   const image=wraps.nth(i).locator('img');
   for(let n=0;n<15;n++) {const box=await image.boundingBox();if(box&&box.y>=125&&box.y<800)break;await page.mouse.move(450,350);await page.mouse.wheel(0,box?box.y-180:250);await page.waitForTimeout(100);}
   const box=await image.boundingBox();await page.mouse.move(box.x+3,box.y+3);await page.waitForTimeout(120);
  };
  const apply=async(i,p)=>{await reveal(i);await wraps.nth(i).getByRole('button',{name:`缩放 ${p}% ·`,exact:false}).click();await page.waitForTimeout(180);};
  for(let i=0;i<2;i++) {
   await apply(i,100);const base=await width(i);assert.ok(base>300,'image did not load');
   for(const p of [25,50,75,100]){await apply(i,p);near(await width(i),base*p/100);assert.equal(await wraps.nth(i).getByRole('button',{name:`缩放 ${p}% ·`,exact:false}).getAttribute('aria-pressed'),'true');}
   checks.push(`${i?'Hosted':'Local'} image changes visibly at all four percentages with current preset highlighted`);
  }
  await reveal(0);await wraps.first().getByRole('button',{name:'设置快捷档位或自定义尺寸 · image.svg',exact:true}).click();
  await page.getByRole('option',{name:'自定义尺寸：应用到这张图',exact:true}).click();await page.locator('.quick-input-box input').fill('320x180');await page.keyboard.press('Enter');await page.getByRole('option',{name:'仅应用这一次',exact:true}).click();await page.waitForTimeout(200);
  near(await width(0),320);near(await wraps.first().locator('img').evaluate(e=>e.getBoundingClientRect().height),180);checks.push('Gear menu applies custom dimensions to a local file image');
  await page.keyboard.press('Meta+s');await page.waitForTimeout(200);
  const saved=JSON.parse(fs.readFileSync(`${out}/sources.ipynb`));
  assert.deepEqual(saved.cells[0].metadata.jupyterImageScalerSources['image.svg'],{width:320,height:180,mode:'pixels'});assert.equal(saved.cells[0].attachments,undefined);
  assert.ok(saved.cells[0].source.join('').includes('![local](image.svg)'));checks.push('UI changes save without rewriting Markdown or embedding image data');
  await reveal(0);await page.screenshot({path:`${out}/sources.png`});
  fs.writeFileSync(`${out}/browser.json`,JSON.stringify({ok:true,checks},null,2));fs.writeFileSync(`${out}/release`,'done');console.log(JSON.stringify({ok:true,checks},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
