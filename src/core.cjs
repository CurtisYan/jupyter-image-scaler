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
// Keep source URLs as identities; never resolve, fetch, or rewrite them here.
function imageReferences(source) {
  const refs = new Map();
  walk(parser.parse(source, {}), token => {
    const src = token.attrGet('src');
    if (!src) return;
    const attachment = src.startsWith('attachment:');
    const name = attachment ? decodeName(src) : src;
    const id = attachment ? `attachment:${name}` : src;
    refs.set(id, {id, name, kind: attachment ? 'attachment' : 'source'});
  });
  return [...refs.values()];
}
function withImageScale(metadata, ref, preset) {
  if (ref.kind === 'attachment') return withScale(metadata, ref.name, preset);
  const value = normalizePreset(preset);
  const inner = {...(metadata.metadata || {})};
  const entries = {...(inner.jupyterImageScalerSources || {})};
  if (value.percent === 100) delete entries[ref.id];
  else Object.defineProperty(entries, ref.id, {value: value.percent ? value : {...value, mode:'pixels'}, enumerable:true, configurable:true, writable:true});
  if (Object.keys(entries).length) inner.jupyterImageScalerSources = entries;
  else delete inner.jupyterImageScalerSources;
  return {...metadata, metadata:inner};
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
function normalizePreset(value) {
  if (typeof value === 'number') value = {percent: value};
  if (!value || typeof value !== 'object') throw new Error('缩放档位无效。');
  if (Number.isInteger(value.percent) && value.percent >= 1 && value.percent <= 100 && value.width === undefined && value.height === undefined) return {percent: value.percent};
  if (value.percent === undefined && Number.isInteger(value.width) && value.width >= 1 && value.width <= 10000 && (value.height === undefined || (Number.isInteger(value.height) && value.height >= 1 && value.height <= 10000))) return value.height === undefined ? {width: value.width} : {width: value.width, height: value.height};
  throw new Error('比例应为 1–100 的整数，尺寸应为 1–10000 的整数像素。');
}
function presetLabel(value) { return value.percent ? `${value.percent}%` : value.height ? `${value.width} × ${value.height}` : `${value.width}px`; }
function withScale(metadata, name, preset) {
  const value = normalizePreset(preset);
  const percent = value.percent;
  const size = dimensions(metadata.attachments?.[name]);
  const inner = { ...(metadata.metadata || {}) };
  const entries = { ...(inner.jupyterImageScaler || {}) };
  if (percent === 100) delete entries[name];
  else Object.defineProperty(entries, name, {value: percent ? {percent, width: Math.max(1, Math.round(size.width * percent / 100))} : {...value, mode: 'pixels'}, enumerable: true, configurable: true, writable: true});
  if (Object.keys(entries).length) inner.jupyterImageScaler = entries;
  else delete inner.jupyterImageScaler;
  return { ...metadata, metadata: inner };
}
module.exports = { PRESETS, imageReferences, withImageScale, decodeName, walk, referencedImages, dimensions, withScale, normalizePreset, presetLabel };
