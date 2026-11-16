const MarkdownIt = require('markdown-it');
const { imageSize } = require('image-size');
const parser = new MarkdownIt({ html: true });
const PRESETS = [25, 50, 75, 100];
function decodeName(src) {
  const name = src.slice('attachment:'.length);
  try { return decodeURIComponent(name); } catch { return name; }
}
function walk(tokens, visit) {
  for (const token of tokens || []) {
    if (token.type === 'image') visit(token);
    if (token.children) walk(token.children, visit);
  }
}
function referencedImages(source) {
  const names = new Set();
  walk(parser.parse(source, {}), token => {
    const src = token.attrGet('src');
    if (src?.startsWith('attachment:')) names.add(decodeName(src));
  });
  return [...names];
}
function dimensions(bundle) {
  if (!bundle || typeof bundle !== 'object') throw new Error('找不到该图片的附件数据。');
  // Match VS Code's built-in attachment renderer, which uses the first MIME entry.
  const [mime, raw] = Object.entries(bundle)[0] || [];
  if (!mime?.startsWith('image/')) throw new Error('该附件不是支持的图片。');
  const base64 = Array.isArray(raw) ? raw.join('') : raw;
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/=\s]+$/.test(base64)) throw new Error('图片附件数据无效。');
  const result = imageSize(Buffer.from(base64, 'base64'));
  if (!Number.isFinite(result.width) || result.width < 1) throw new Error('无法读取图片宽度。');
  return result;
}
function withScale(metadata, name, percent) {
  if (!PRESETS.includes(percent)) throw new Error('请选择 25%、50%、75% 或 100%。');
  const size = dimensions(metadata.attachments?.[name]);
  const inner = { ...(metadata.metadata || {}) };
  const entries = { ...(inner.jupyterImageScaler || {}) };
  if (percent === 100) delete entries[name];
  else Object.defineProperty(entries, name, {value: {percent, width: Math.max(1, Math.round(size.width * percent / 100))}, enumerable: true, configurable: true, writable: true});
  if (Object.keys(entries).length) inner.jupyterImageScaler = entries;
  else delete inner.jupyterImageScaler;
  return { ...metadata, metadata: inner };
}
module.exports = { PRESETS, decodeName, walk, referencedImages, dimensions, withScale };
