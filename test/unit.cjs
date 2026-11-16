const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MarkdownIt = require('markdown-it');
const { referencedImages, withScale } = require('../src/core.cjs');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'sample.ipynb')));
const attachments = fixture.cells[0].attachments;
const base = { attachments, metadata: { tags: ['keep'], unrelated: {value: 7} }, id: 'keep-id' };
test('Markdown attachment detection respects fences, inline code, references, escapes and encoded names', () => {
  const source = '![a](attachment:image.png) ![again](attachment:image.png)\n![b][ref]\n\n[ref]: attachment:second%20image.png\n\n`![fake](attachment:no.png)`\n\n```md\n![fake](attachment:no2.png)\n```\n\\![escaped](attachment:no3.png)';
  assert.deepEqual(referencedImages(source), ['image.png', 'second image.png']);
  assert.deepEqual(referencedImages('<img src="attachment:image.png">'), []);
});
test('all presets are relative to original; metadata and attachment bytes preserved', () => {
  const before = JSON.stringify(base);
  let updated = base;
  for (const percent of [25, 50, 75, 25, 100]) {
    updated = withScale(updated, 'image.png', percent);
    assert.equal(updated.attachments, attachments);
    assert.deepEqual(updated.metadata.tags, ['keep']);
    assert.deepEqual(updated.metadata.unrelated, {value: 7});
    assert.equal(updated.id, 'keep-id');
    if (percent !== 100) assert.deepEqual(updated.metadata.jupyterImageScaler['image.png'], {percent, width: 800 * percent / 100});
    else assert.equal(updated.metadata.jupyterImageScaler, undefined);
  }
  assert.equal(JSON.stringify(base), before);
});
test('scales are independent per attachment and reset only selected image', () => {
  const one = withScale(base, 'image.png', 25);
  const two = withScale(one, 'second-image.png', 75);
  const reset = withScale(two, 'image.png', 100);
  assert.deepEqual(reset.metadata.jupyterImageScaler, {'second-image.png': {percent: 75, width: 300}});
});
test('rejects invalid presets and missing or corrupt attachment data', () => {
  assert.throws(() => withScale(base, 'image.png', 13));
  assert.throws(() => withScale(base, 'missing.png', 50));
  assert.throws(() => withScale({attachments: {bad: {'image/png': '!!!!'}}}, 'bad', 25));
});
async function renderer() { return import('../src/renderer.mjs'); }
function attachmentHook(md) {
  const original = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet('src');
    if (src?.startsWith('attachment:')) {
      const bundle = env.outputItem.metadata.attachments[decodeURIComponent(src.slice(11))];
      if (bundle) {const [mime, value] = Object.entries(bundle)[0]; token.attrSet('src', `data:${mime};base64,${value}`);}
    }
    return original(tokens, idx, options, env, self);
  };
}
for (const order of ['before', 'after']) test(`renderer survives attachment hook registration ${order}`, async () => {
  const md = new MarkdownIt();
  const {extend} = await renderer();
  if (order === 'before') attachmentHook(md);
  extend(md);
  if (order === 'after') attachmentHook(md);
  for (const percent of [25, 50, 75, 100]) {
    const metadata = withScale(base, 'image.png', percent);
    const html = md.render('![a](attachment:image.png) ![b](attachment:second-image.png)', {outputItem: {metadata}});
    assert.ok(html.includes('src="data:image/png;base64,'));
    assert.ok(!html.includes('src="attachment:'));
    if (percent === 100) assert.ok(!html.includes('width='));
    else {
      assert.ok(html.includes(`width="${percent * 8}"`));
      assert.ok(html.includes(`width: min(${percent * 8}px, ${percent}%)`));
    }
  }
});
test('renderer ignores malformed scale metadata and preserves default rendering', async () => {
  const {extend} = await renderer();
  const md = new MarkdownIt(); extend(md);
  for (const scale of [{width: '1; color:red', percent: 50}, {width: -1, percent: 25}, {width: 5, percent: 200}]) {
    assert.ok(!md.render('![a](attachment:image.png)', {outputItem:{metadata:{metadata:{jupyterImageScaler:{'image.png':scale}}}}}).includes('width='));
  }
  assert.ok(!md.render('![a](attachment:image.png)').includes('width='));
});
