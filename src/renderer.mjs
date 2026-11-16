// Runs before image renderers replace attachment: URLs with data: URLs, so it is
// independent of activation order with VS Code's built-in attachment renderer.
export function extend(md) {
  md.core.ruler.after('inline', 'jupyter_image_scaler', state => {
    const scales = state.env.outputItem?.metadata?.metadata?.jupyterImageScaler;
    if (!scales || typeof scales !== 'object') return;
    const visit = tokens => {
      for (const token of tokens || []) {
        const src = token.type === 'image' ? token.attrGet('src') : undefined;
        if (src?.startsWith('attachment:')) {
          let name = src.slice(11);
          try { name = decodeURIComponent(name); } catch { /* literal malformed escape */ }
          const scale = Object.hasOwn(scales, name) && scales[name];
          if ([25, 50, 75].includes(scale?.percent) && Number.isSafeInteger(scale.width) && scale.width >= 1 && scale.width <= 1000000) {
            token.attrSet('width', String(scale.width));
            token.attrSet('style', `width: min(${scale.width}px, ${scale.percent}%); max-width: 100%; height: auto;`);
          }
        }
        if (token.children) visit(token.children);
      }
    };
    visit(state.tokens);
  });
}
export async function activate(context) {
  const renderer = await context.getRenderer('vscode.markdown-it-renderer');
  if (!renderer) throw new Error('无法加载 VS Code Notebook Markdown 渲染器。');
  renderer.extendMarkdownIt(extend);
}
