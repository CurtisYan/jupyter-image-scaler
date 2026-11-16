const defaults = [25, 50, 75, 100].map(percent => ({percent}));
const records = new Map();
let schedule = () => {};
function validScale(scale) {
  return Number.isSafeInteger(scale?.width) && scale.width >= 1 && scale.width <= 1000000 &&
    ((Number.isInteger(scale.percent) && scale.percent >= 1 && scale.percent < 100) ||
      (scale.mode === 'pixels' && scale.width <= 10000 && (scale.height === undefined || (Number.isInteger(scale.height) && scale.height >= 1 && scale.height <= 10000))));
}
export function extend(md) {
  md.core.ruler.after('inline', 'jupyter_image_scaler', state => {
    const output = state.env.outputItem;
    const scales = output?.metadata?.metadata?.jupyterImageScaler;
    let index = 0;
    const visit = tokens => {
      for (const token of tokens || []) {
        const src = token.type === 'image' ? token.attrGet('src') : undefined;
        if (src?.startsWith('attachment:')) {
          let name = src.slice(11);
          try { name = decodeURIComponent(name); } catch { /* literal escape */ }
          const scale = scales && Object.hasOwn(scales, name) ? scales[name] : undefined;
          if (validScale(scale)) {
            token.attrSet('width', String(scale.width));
            token.attrSet('style', scale.mode === 'pixels'
              ? `width: ${scale.width}px; max-width: 100%; height: ${scale.height ? `${scale.height}px` : 'auto'};`
              : `width: min(${scale.width}px, ${scale.percent}%); max-width: 100%; height: auto;`);
          }
          if (output) {
            const key = `${output.id}:${index++}`;
            token.attrSet('data-jis-image', key);
            records.set(key, {cellId: output.metadata?.id, source: state.src, name, scale: validScale(scale) ? scale : {percent:100}});
          }
        }
        if (token.children) visit(token.children);
      }
    };
    visit(state.tokens);
    schedule();
  });
}
const label = p => p.percent ? `${p.percent}%` : p.height ? `${p.width} × ${p.height}` : `${p.width}px`;
const matches = (a, b) => a.percent ? a.percent === b.percent : b.mode === 'pixels' && a.width === b.width && a.height === b.height;
export async function activate(context) {
  const renderer = await context.getRenderer('vscode.markdown-it-renderer');
  if (!renderer) throw new Error('无法加载 VS Code Notebook Markdown 渲染器。');
  let presets = defaults;
  let toolbarStyle = 'overlay';
  const bars = new Map();
  const css = `
.jis-wrap{display:block;position:relative;max-width:100%;box-sizing:content-box}
.jis-wrap>img{vertical-align:top}
.jis-tools{position:absolute;top:4px;left:4px;z-index:10;display:flex;align-items:center;flex-wrap:wrap;gap:1px;padding:2px;max-width:calc(100% - 8px);box-sizing:border-box;border:1px solid var(--vscode-widget-border,#8886);border-radius:5px;background:var(--vscode-editorWidget-background,#252526);box-shadow:0 1px 5px #0003;opacity:0;pointer-events:none;transition:opacity .12s}
.jis-wrap:hover>.jis-tools,.jis-wrap:focus-within>.jis-tools{opacity:1;pointer-events:auto}
.jis-tools button{display:flex;align-items:center;justify-content:center;font:11px var(--vscode-font-family,sans-serif);white-space:nowrap;color:var(--vscode-editor-foreground,#ddd);background:transparent;border:1px solid transparent;border-radius:3px;padding:1px 5px;cursor:pointer;line-height:18px;min-height:22px;box-sizing:border-box}
.jis-tools .jis-gear{width:26px;min-width:26px;padding:2px}
.jis-gear svg{width:18px;height:18px;display:block}
.jis-tools button:hover{background:var(--vscode-toolbar-hoverBackground,#8884)}
.jis-tools button[aria-pressed=true]{background:var(--vscode-button-background,#007acc);color:var(--vscode-button-foreground,#fff)}
.jis-tools button:focus-visible{outline:1px solid var(--vscode-focusBorder,#007acc)}
.jis-wrap[data-placement=side]>.jis-tools{flex-direction:column;align-items:stretch;flex-wrap:nowrap;max-width:none}
.jis-wrap[data-placement=side]>.jis-tools .jis-gear{width:100%}
.jis-wrap[data-placement=below]>.jis-tools{max-width:100%}
@media(hover:none){.jis-tools{opacity:1;pointer-events:auto}}
`;
  function position(bar) {
    const wrap = bar.parentElement;
    if (!wrap?.isConnected) return;
    const image = wrap.querySelector('img');
    if (toolbarStyle === 'overlay') {
      wrap.dataset.placement = 'overlay'; bar.setAttribute('aria-orientation','horizontal');
      wrap.style.paddingBottom = ''; wrap.style.minHeight = '';
      bar.style.left = ''; bar.style.top = '';
      return;
    }
    // Prefer existing space on either side; otherwise reserve space below.
    wrap.dataset.placement = 'side'; bar.setAttribute('aria-orientation','vertical');
    const imageRect = image.getBoundingClientRect();
    const imageWidth = imageRect.width;
    const imageHeight = imageRect.height;
    const imageLeft = imageRect.left - wrap.getBoundingClientRect().left;
    const barWidth = bar.offsetWidth;
    const fitsLeft = imageLeft >= barWidth + 6;
    const fitsRight = imageLeft + imageWidth + barWidth + 6 <= wrap.clientWidth;
    if (fitsLeft || fitsRight) {
      wrap.dataset.side = fitsLeft ? 'left' : 'right';
      bar.style.left = `${fitsLeft ? imageLeft - barWidth - 6 : imageLeft + imageWidth + 6}px`; bar.style.top = `${image.offsetTop}px`;
      wrap.style.paddingBottom = ''; wrap.style.minHeight = `${bar.offsetHeight}px`;
    } else {
      delete wrap.dataset.side;
      wrap.dataset.placement = 'below'; bar.setAttribute('aria-orientation','horizontal');
      bar.style.left = '0px'; bar.style.top = `${image.offsetTop + imageHeight + 6}px`;
      wrap.style.minHeight = ''; wrap.style.paddingBottom = `${bar.offsetHeight + 6}px`;
    }
  }
  const sizes = new ResizeObserver(entries => {
    for (const entry of entries) {
      const wrap = entry.target.classList.contains('jis-wrap') ? entry.target : entry.target.parentElement;
      const bar = wrap?.querySelector('.jis-tools');
      if (bar) position(bar);
    }
  });
  function fill(bar, record) {
    bar.replaceChildren();
    for (const preset of [...presets, null]) {
      const button = document.createElement('button');
      button.type = 'button';
      if (preset) button.textContent = label(preset);
      else {
        button.className = 'jis-gear';
        const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
        svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('fill','none');
        svg.setAttribute('stroke','currentColor'); svg.setAttribute('stroke-width','1.8');
        svg.setAttribute('aria-hidden','true');
        const path = document.createElementNS(svg.namespaceURI,'path');
        path.setAttribute('d','m9.5 3-.6 2-1.6.9-2-.5-2.5 4.3 1.5 1.5v1.7l-1.5 1.5 2.5 4.3 2-.5 1.6.9.6 2h5l.6-2 1.6-.9 2 .5 2.5-4.3-1.5-1.5v-1.7l1.5-1.5-2.5-4.3-2 .5-1.6-.9-.6-2Z');
        const circle = document.createElementNS(svg.namespaceURI,'circle');
        circle.setAttribute('cx','12'); circle.setAttribute('cy','12'); circle.setAttribute('r','3');
        svg.append(path,circle); button.append(svg);
      }
      button.title = preset ? `缩放 ${label(preset)} · ${record.name}` : `设置快捷档位或自定义尺寸 · ${record.name}`;
      button.setAttribute('aria-label', button.title);
      if (preset) button.setAttribute('aria-pressed', String(matches(preset, record.scale)));
      // Notebook delegates double clicks to enter Markdown edit mode.
      for (const type of ['pointerdown', 'mousedown', 'dblclick']) button.addEventListener(type, e => e.stopPropagation());
      button.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        context.postMessage({type: preset ? 'apply' : 'settings', cellId: record.cellId, source: record.source, name: record.name, preset});
      });
      bar.append(button);
    }
    position(bar);
  }
  function scan(root) {
    for (const image of root.querySelectorAll('img[data-jis-image]')) {
      const record = records.get(image.getAttribute('data-jis-image'));
      if (!record || image.parentElement?.classList.contains('jis-wrap')) continue;
      const wrap = document.createElement('span'); wrap.className = 'jis-wrap';
      const bar = document.createElement('span'); bar.className = 'jis-tools';
      bar.setAttribute('role','toolbar'); bar.setAttribute('aria-label', `图片缩放 · ${record.name}`);
      image.before(wrap); wrap.append(image, bar); fill(bar, record); bars.set(bar, record); sizes.observe(image); sizes.observe(wrap);
      if (!root.querySelector('style[data-jis-style]')) {
        const style = document.createElement('style'); style.dataset.jisStyle = ''; style.textContent = css; (root.head || root).append(style);
      }
    }
    for (const element of root.querySelectorAll('*')) if (element.shadowRoot) scan(element.shadowRoot);
    for (const [bar] of bars) if (!bar.isConnected) { sizes.unobserve(bar.parentElement?.querySelector('img') || bar); if (bar.parentElement) sizes.unobserve(bar.parentElement); bars.delete(bar); }
  }
  let queued = false;
  schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; scan(document); });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document, {childList:true, subtree:true});
  context.onDidReceiveMessage(message => {
    if (message?.type !== 'presets' || !Array.isArray(message.presets)) return;
    presets = message.presets;
    toolbarStyle = message.toolbarStyle === 'outside' ? 'outside' : 'overlay';
    for (const [bar, record] of bars) if (bar.isConnected) fill(bar, record);
  });
  renderer.extendMarkdownIt(extend);
  context.postMessage({type:'ready'});
}
