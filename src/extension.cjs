const vscode = require('vscode');
const { PRESETS, referencedImages, withScale } = require('./core.cjs');
function resolveCell(arg) {
  if (arg?.cell?.document) return arg.cell;
  if (arg?.document && arg?.notebook) return arg;
  const editor = vscode.window.activeNotebookEditor;
  if (!editor) return undefined;
  const textUri = vscode.window.activeTextEditor?.document.uri.toString();
  return editor.notebook.getCells().find(cell => cell.document.uri.toString() === textUri)
    || editor.notebook.cellAt(editor.selection.start);
}
function choosePercent(name, current) {
  return new Promise(resolve => {
    const picker = vscode.window.createQuickPick();
    const subscriptions = [];
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      for (const subscription of subscriptions) subscription.dispose();
      picker.dispose();
      resolve(value);
    };
    picker.title = `附件图片缩放 · ${name}`;
    picker.placeholder = '选择比例；若图片未变化，请先运行「开发人员：重新加载窗口」';
    picker.items = PRESETS.map(value => ({
      label: `${value}%`,
      description: value === 100 ? '恢复默认大小' : '相对于默认显示宽度',
      detail: value === current ? '当前比例' : undefined,
      value
    }));
    subscriptions.push(picker.onDidAccept(() => finish(picker.selectedItems[0]?.value)));
    subscriptions.push(picker.onDidHide(() => finish(undefined)));
    picker.show();
    picker.activeItems = picker.items.filter(item => item.value === current);
  });
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
    const current = cell.metadata.metadata?.jupyterImageScaler?.[name]?.percent || 100;
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
  vscode.window.setStatusBarMessage(`附件图片 ${name}：${percent}%（原图保持完整，保存 Notebook 后保留比例）`, 4500);
  return true;
}
function activate(context) {
  const run = (arg, preset, name) => scale(arg, preset, name).catch(error => {
    vscode.window.showErrorMessage(`附件图片缩放失败：${error.message}`);
    return false;
  });
  context.subscriptions.push(vscode.commands.registerCommand('jupyterImageScaler.choose', arg => run(arg)));
  for (const preset of PRESETS) context.subscriptions.push(vscode.commands.registerCommand(`jupyterImageScaler.scale${preset}`, (arg, name) => run(arg, preset, name)));
  context.subscriptions.push(vscode.notebooks.registerNotebookCellStatusBarItemProvider('jupyter-notebook', {
    provideCellStatusBarItems(cell) {
      if (cell.kind !== vscode.NotebookCellKind.Markup || !referencedImages(cell.document.getText()).length) return [];
      return PRESETS.map(percent => {
        const item = new vscode.NotebookCellStatusBarItem(`${percent}%`, vscode.NotebookCellStatusBarAlignment.Left);
        item.command = {command: `jupyterImageScaler.scale${percent}`, title: '附件图片缩放', arguments: [cell]};
        item.tooltip = percent === 100 ? '恢复原图默认显示大小' : `显示为默认显示宽度的 ${percent}%，保留原始图片`;
        item.priority = 100 - percent;
        return item;
      });
    }
  }));
}
module.exports = { activate };
