// Real-browser renderer test. Image bytes are served only by the local fixture server.
const {chromium} = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {imageReferences, withImageScale} = require('../src/core.cjs');
(async () => {
  const root = path.resolve(__dirname,'..');
  const errors=[]; const requests=[]; const checks=[];
  const server = http.createServer((req,res) => {
    requests.push(req.url);
    if (req.url === '/renderer.mjs') {res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(root,'src/renderer.mjs')));}
    if (req.url === '/markdown.js') {res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(root,'node_modules/markdown-it/dist/browser/markdown-it.umd.min.js')));}
    if (req.url.endsWith('.svg') || req.url.startsWith('/image.png')) {
      const small=req.url.includes('small');
      const body=`<svg xmlns="http://www.w3.org/2000/svg" width="${small?100:1600}" height="${small?50:800}"><rect width="100%" height="100%" fill="steelblue"/></svg>`;
      const send=()=>{res.setHeader('Content-Type','image/svg+xml');res.end(body);};
      return req.url.includes('delayed') ? setTimeout(send,400) : send();
    }
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><style>body{margin:20px}#content{width:600px;max-width:100%}img{max-width:100%}</style><script src="/markdown.js"></script><div id="content"></div>');
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const port=server.address().port;
  let browser;
  try {
    browser=await chromium.launch({headless:true, ...(process.env.JIS_BROWSER ? {executablePath:process.env.JIS_BROWSER} : {})});
    const page=await browser.newPage({viewport:{width:900,height:1000}});
    page.on('pageerror',e=>errors.push(e.message));
    const remote=`http://127.0.0.1:${port}/delayed.svg`;
    const source=`![local](image.png) ![small](small.svg) ![remote](${remote}) ![again](image.png)`;
    let metadata={id:'source-test',metadata:{jupyterImageScalerSources:{[remote]:{percent:75}}}};
    const originalSource=source;
    await page.exposeFunction('hostMessage',msg=>{
      assert.equal(msg.source,originalSource);
      const ref=imageReferences(source).find(r=>r.id===msg.imageId);
      assert.ok(ref,'message must identify an existing source image');
      if(msg.type==='apply') metadata=withImageScale(metadata,ref,msg.preset);
      return metadata;
    });
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.evaluate(async ({source,metadata})=>{
      const {activate}=await import('/renderer.mjs');
      const md=window.markdownit();
      const render=value=>{document.querySelector('#content').innerHTML=md.render(source,{outputItem:{id:'rendered-cell',metadata:value}});};
      window.renderTest=render;
      await activate({getRenderer:async()=>({extendMarkdownIt:extend=>extend(md)}),onDidReceiveMessage:cb=>{window.config=cb;},postMessage:async msg=>{if(msg.type==='ready')return;render(await window.hostMessage(msg));}});
      render(metadata);
    },{source,metadata});
    const wraps=page.locator('.jis-wrap');await wraps.nth(3).waitFor();
    const width=i=>wraps.nth(i).locator('img').evaluate(e=>e.getBoundingClientRect().width);
    const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1,`${actual} != ${expected}`);
    await page.waitForFunction(()=>[...document.querySelectorAll('#content img')].every(i=>i.complete&&i.naturalWidth));
    await page.waitForTimeout(100);near(await width(2),450);
    checks.push('Saved hosted-image percentage applies after delayed image load');
    const apply=async(i,percent)=>{const image=wraps.nth(i).locator('img');await image.scrollIntoViewIfNeeded();const box=await image.boundingBox();await page.mouse.move(box.x+1,box.y+1);await wraps.nth(i).getByRole('button',{name:`缩放 ${percent}% ·`,exact:false}).click();await page.waitForTimeout(80);};
    for(const percent of [25,50,75,100]){await apply(0,percent);near(await width(0),600*percent/100);near(await width(3),600*percent/100);}
    checks.push('Local image hover presets have four distinct sizes and repeated references share the size');
    for(const percent of [25,50,75,100]){await apply(1,percent);near(await width(1),100*percent/100);}
    checks.push('Small local image uses its natural width rather than the container width');
    for(const percent of [25,50,75,100]){await apply(2,percent);near(await width(2),600*percent/100);}
    checks.push('Hosted image hover presets work without modifying the URL or using a CORS fetch');
    const local=imageReferences(source)[0];metadata=withImageScale(metadata,local,{width:320,height:180});
    await page.evaluate(m=>window.renderTest(m),metadata);await page.waitForTimeout(80);
    near(await width(0),320);near(await wraps.first().locator('img').evaluate(e=>e.height),180);
    checks.push('Custom pixel dimensions render on ordinary images');
    metadata=withImageScale(metadata,local,50);
    await page.evaluate(m=>window.renderTest(m),JSON.parse(JSON.stringify(metadata)));await page.waitForTimeout(80);
    near(await width(0),300);
    await page.locator('#content').evaluate(e=>e.style.width='400px');await page.waitForTimeout(100);near(await width(0),200);
    await page.evaluate(()=>window.config({type:'presets',presets:[{percent:25},{percent:50},{percent:75},{percent:100}],toolbarStyle:'outside'}));await page.waitForTimeout(100);
    const geometry=await wraps.first().evaluate(w=>({p:w.dataset.placement,image:w.querySelector('img').getBoundingClientRect().toJSON(),bar:w.querySelector('.jis-tools').getBoundingClientRect().toJSON()}));
    assert.ok(geometry.p==='side'?geometry.bar.left>=geometry.image.right:geometry.bar.top>=geometry.image.bottom);
    checks.push('Saved percentage survives serialization, responds to resizing, and works with external toolbar');
    assert.deepEqual(errors,[]);assert.equal(metadata.attachments,undefined);assert.equal(source,originalSource);
    assert.equal(await wraps.first().locator('img').getAttribute('src'),'image.png');
    assert.equal(await wraps.nth(2).locator('img').getAttribute('src'),remote);
    checks.push('Source references stay unchanged; no attachment conversion or browser errors');
    const result={ok:true,checks,requests};console.log(JSON.stringify(result,null,2));
    if(process.env.JIS_RESULT)fs.writeFileSync(process.env.JIS_RESULT,JSON.stringify(result,null,2));
  } finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
