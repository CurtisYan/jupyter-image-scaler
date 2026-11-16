const vscode = require('vscode');
const { PRESETS, referencedImages, withScale, normalizePreset, presetLabel } = require('./core.cjs');
function resolveCell(arg) {
  if (arg?.cell?.document) return arg.cell;
  if (arg?.document && arg?.notebook) return arg;
  const editor = vscode.window.activeNotebookEditor;
  if (!editor) return undefined;
  const textUri = vscode.window.activeTextEditor?.document.uri.toString();
  return editor.notebook.getCells().find(cell => cell.document.uri.toString() === textUri)
    || editor.notebook.cellAt(editor.selection.start);
}
function getPresets() {
  const raw = vscode.workspace.getConfiguration('jupyterImageScaler').get('presets', PRESETS.map(percent => ({percent})));
  const values = [];
  for (const value of Array.isArray(raw) ? raw.slice(0,12) : []) {
    try { const preset = normalizePreset(value); if (!values.some(p => JSON.stringify(p) === JSON.stringify(preset))) values.push(preset); } catch { /* ignore invalid settings */ }
  }
  return values.length ? values : PRESETS.map(percent => ({percent}));
}
function currentPreset(cell, name) {
  const value = cell.metadata.metadata?.jupyterImageScaler?.[name];
  return value?.mode === 'pixels' ? {width:value.width, ...(value.height ? {height:value.height} : {})} : {percent:value?.percent || 100};
}
function choosePercent(name, current) {
  return new Promise(resolve => {
    const picker = vscode.window.createQuickPick();
    let done = false;
    const subscriptions = [];
    const finish = value => { if (done) return; done = true; subscriptions.forEach(s => s.dispose()); picker.dispose(); resolve(value); };
    picker.title = `附件图片缩放 · ${name}`;
    picker.placeholder = '选择快捷档位';
    picker.items = getPresets().map(value => ({label:presetLabel(value), value, detail:JSON.stringify(value) === JSON.stringify(current) ? '当前档位' : undefined}));
    subscriptions.push(picker.onDidAccept(() => finish(picker.selectedItems[0]?.value)), picker.onDidHide(() => finish()));
    picker.show(); picker.activeItems = picker.items.filter(item => item.detail);
  });
}
async function inputPreset(pixels) {
  const text = await vscode.window.showInputBox({title:pixels ? '自定义图片尺寸' : '自定义缩放比例', prompt:pixels ? '输入宽度（如 320），或宽 × 高（如 320x180）。只填宽度保持比例；填写宽高会按指定比例显示。' : '输入 1–100 的整数百分比', placeHolder:pixels ? '320 或 320x180' : '60', validateInput:text => {try { parsePreset(text, pixels); } catch(e) { return e.message; }}});
  return text === undefined ? undefined : parsePreset(text, pixels);
}
function parsePreset(text, pixels) {
  if (!pixels && /^\d+%?$/.test(text.trim())) return normalizePreset({percent:Number(text.trim().replace('%',''))});
  const match = /^(\d+)(?:\s*[x×*]\s*(\d+))?$/.exec(text.trim());
  if (pixels && match) return normalizePreset({width:Number(match[1]), ...(match[2] ? {height:Number(match[2])} : {})});
  throw new Error(pixels ? '请输入整数宽度或 宽x高。' : '请输入 1–100 的整数。');
}
async function savePresets(presets) {
  await vscode.workspace.getConfiguration('jupyterImageScaler').update('presets', presets, vscode.ConfigurationTarget.Global);
}
function getToolbarStyle() {
  return vscode.workspace.getConfiguration('jupyterImageScaler').get('toolbarStyle') === 'outside' ? 'outside' : 'overlay';
}
async function sortPresets() {
  while (true) {
    const presets = getPresets();
    const selected = await vscode.window.showQuickPick([
      ...presets.map((preset,index) => ({label:`${index + 1}. ${presetLabel(preset)}`, index})),
      {label:'完成排序'}
    ], {title:'快捷档位排序', placeHolder:'选择一个档位调整位置；每次调整立即保存'});
    if (selected?.index === undefined) return;
    const index = selected.index;
    const actions = [];
    if (index > 0) actions.push({label:'上移一位', target:index-1}, {label:'移到最前', target:0});
    if (index < presets.length-1) actions.push({label:'下移一位', target:index+1}, {label:'移到最后', target:presets.length-1});
    if (!actions.length) { vscode.window.showInformationMessage('添加更多档位后即可排序。'); return; }
    const action = await vscode.window.showQuickPick(actions, {title:`移动 ${presetLabel(presets[index])}`});
    if (!action) return;
    if (JSON.stringify(getPresets()) !== JSON.stringify(presets)) { vscode.window.showInformationMessage('档位设置已发生变化，请重新选择。'); continue; }
    const [preset] = presets.splice(index,1);
    presets.splice(action.target,0,preset);
    await savePresets(presets);
  }
}
async function chooseToolbarStyle() {
  const current = getToolbarStyle();
  const item = await vscode.window.showQuickPick([
    {label:'左上角悬浮', value:'overlay', description:current === 'overlay' ? '当前样式' : undefined, detail:'紧凑菜单显示在图片左上角'},
    {label:'图片外部（自动避让）', value:'outside', description:current === 'outside' ? '当前样式' : undefined, detail:'自动选择图片左侧、右侧或下方的空位；保持原有图片大小'}
  ], {title:'切换菜单样式'});
  if (item) await vscode.workspace.getConfiguration('jupyterImageScaler').update('toolbarStyle',item.value,vscode.ConfigurationTarget.Global);
}
async function settings(cell, name) {
  const action = await vscode.window.showQuickPick([
    {label:'自定义尺寸：应用到这张图', action:'apply'},
    {label:'添加百分比快捷档位', action:'percent'},
    {label:'添加尺寸快捷档位', action:'pixels'},
    {label:'调整档位顺序', action:'sort'},
    {label:'切换菜单样式', action:'style'},
    {label:'删除快捷档位', action:'remove'},
    {label:'恢复默认四个档位', action:'reset'}
  ], {title:'图片缩放设置', placeHolder:'快捷档位在所有 Notebook 中共用'});
  if (!action) return;
  if (action.action === 'sort') return sortPresets();
  if (action.action === 'style') return chooseToolbarStyle();
  if (action.action === 'reset') return savePresets(PRESETS.map(percent => ({percent})));
  if (action.action === 'remove') {
    const presets = getPresets();
    const item = await vscode.window.showQuickPick(presets.map((p,index) => ({label:presetLabel(p),index})), {title:'删除快捷档位'});
    if (!item) return;
    if (presets.length === 1) return vscode.window.showInformationMessage('至少保留一个快捷档位。');
    return savePresets(presets.filter((_,i) => i !== item.index));
  }
  const preset = await inputPreset(action.action !== 'percent');
  if (!preset) return;
  if (action.action === 'apply') {
    if (!await scale(cell, preset, name)) return;
    const choice = await vscode.window.showQuickPick([{label:'同时保存为快捷档位', save:true}, {label:'仅应用这一次',save:false}], {title:`已应用 ${presetLabel(preset)}`});
    if (!choice?.save) return;
  }
  const presets = getPresets();
  if (presets.some(p => JSON.stringify(p) === JSON.stringify(preset))) return;
  if (presets.length >= 12) return vscode.window.showInformationMessage('最多保留 12 个快捷档位，请先删除一个。');
  await savePresets([...presets, preset]);
}
async function scale(arg, preset, explicitName) {
  const cell = resolveCell(arg);
  if (!cell || cell.notebook.notebookType !== 'jupyter-notebook' || cell.kind !== vscode.NotebookCellKind.Markup) {
    vscode.window.showInformationMessage('请先选中 Jupyter Notebook 中含有附件图片的 Markdown 单元格。');
    return false;
  }
  const source = cell.document.getText();
  const names = referencedImages(source).filter(name => Object.hasOwn(cell.metadata.attachments || {}, name));
  if (!names.length) {
    vscode.window.showInformationMessage('当前单元格没有 Markdown 附件图片。请使用 ![图片](attachment:image.png)，不要改成 HTML <img>。');
    return false;
  }
  let name = explicitName && names.includes(explicitName) ? explicitName : undefined;
  if (!name && names.length === 1) name = names[0];
  if (!name) name = (await vscode.window.showQuickPick(names.map(name => ({label: name})), { title: '选择要缩放的附件图片', placeHolder: '同一单元格中，同名附件的所有引用会一起缩放' }))?.label;
  if (!name) return false;
  let percent = preset;
  if (!percent) {
    const current = currentPreset(cell, name);
    percent = await choosePercent(name, current);
  }
  if (!percent) return false;
  // A picker can stay open while another editor modifies or deletes the cell.
  if (cell.notebook.isClosed || !cell.notebook.getCells().includes(cell) || cell.document.getText() !== source) {
    vscode.window.showWarningMessage('单元格已发生变化，请重新选择图片。');
    return false;
  }
  const metadata = withScale(cell.metadata, name, percent);
  const edit = new vscode.WorkspaceEdit();
  edit.set(cell.notebook.uri, [vscode.NotebookEdit.updateCellMetadata(cell.index, metadata)]);
  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) throw new Error('Notebook 无法应用修改，请检查文件是否可编辑。');
  vscode.window.setStatusBarMessage(`附件图片 ${name}：${presetLabel(normalizePreset(percent))}（原图保持完整，保存 Notebook 后保留比例）`, 4500);
  return true;
}
function activate(context) {
  const run = (arg, preset, name) => scale(arg, preset, name).catch(error => {
    vscode.window.showErrorMessage(`附件图片缩放失败：${error.message}`);
    return false;
  });
  context.subscriptions.push(vscode.commands.registerCommand('jupyterImageScaler.choose', arg => run(arg)));
  for (const preset of PRESETS) context.subscriptions.push(vscode.commands.registerCommand(`jupyterImageScaler.scale${preset}`, (arg, name) => run(arg, preset, name)));
  const changes = new vscode.EventEmitter();
  const messaging = vscode.notebooks.createRendererMessaging('local-notebook-tools.jupyter-image-scaler-renderer');
  const sendPresets = editor => messaging.postMessage({type:'presets', presets:getPresets(), toolbarStyle:getToolbarStyle()}, editor);
  context.subscriptions.push(changes,
    vscode.commands.registerCommand('jupyterImageScaler.applyPreset', (cell, preset, name) => run(cell, preset, name)),
    vscode.commands.registerCommand('jupyterImageScaler.settings', (cell, name) => settings(resolveCell(cell), name).catch(error => vscode.window.showErrorMessage(error.message))),
    vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration('jupyterImageScaler')) { changes.fire(); sendPresets(); } }),
    messaging.onDidReceiveMessage(async ({editor, message}) => {
      try {
        if (message?.type === 'ready') { await sendPresets(editor); return; }
        if (!['apply','settings'].includes(message?.type) || typeof message.source !== 'string' || typeof message.name !== 'string') return;
        const cells = editor.notebook.getCells().filter(cell => cell.kind === vscode.NotebookCellKind.Markup && cell.document.getText() === message.source && referencedImages(message.source).includes(message.name) && Object.hasOwn(cell.metadata.attachments || {}, message.name));
        const exact = typeof message.cellId === 'string' ? cells.filter(cell => cell.metadata.id === message.cellId) : [];
        const cell = exact.length === 1 ? exact[0] : cells.length === 1 ? cells[0] : undefined;
        if (!cell) { vscode.window.showWarningMessage('无法准确定位这张图片，请使用该单元格右上角的缩放菜单。'); return; }
        if (message.type === 'apply') await run(cell, normalizePreset(message.preset), message.name);
        else await settings(cell, message.name);
      } catch(error) { vscode.window.showErrorMessage(`图片缩放失败：${error.message}`); }
    }),
    vscode.notebooks.registerNotebookCellStatusBarItemProvider('jupyter-notebook', {
      onDidChangeCellStatusBarItems: changes.event,
      provideCellStatusBarItems(cell) {
        if (cell.kind !== vscode.NotebookCellKind.Markup || !referencedImages(cell.document.getText()).length) return [];
        return [...getPresets(), null].map((preset, index) => {
          const item = new vscode.NotebookCellStatusBarItem(preset ? presetLabel(preset) : '$(gear)', vscode.NotebookCellStatusBarAlignment.Left);
          item.command = {command:preset ? 'jupyterImageScaler.applyPreset' : 'jupyterImageScaler.settings', title:'附件图片缩放', arguments:[cell, ...(preset ? [preset] : [])]};
          item.tooltip = preset ? `图片缩放 ${presetLabel(preset)}` : '设置快捷档位和自定义尺寸';
          item.priority = 100 - index;
          return item;
        });
      }
    }));
}
module.exports = { activate };
