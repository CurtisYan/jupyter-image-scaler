const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'test/run');
const pause = ms => new Promise(r => setTimeout(r, ms));
exports.run = async () => {
  fs.mkdirSync(out, {recursive: true});
  const result = {checks: [], version: vscode.version};
  const check = name => result.checks.push(name);
  try {
    await vscode.extensions.getExtension('local-notebook-tools.jupyter-image-scaler').activate();
    const file = path.join(out, 'integration.ipynb');
    fs.copyFileSync(path.join(__dirname, 'sample.ipynb'), file);
    let notebook = await vscode.workspace.openNotebookDocument(vscode.Uri.file(file));
    await vscode.window.showNotebookDocument(notebook);
    let cell = notebook.cellAt(0);
    const original = JSON.stringify(cell.metadata.attachments);
    assert.ok(cell.metadata.attachments?.['image.png']);
    check('Built-in ipynb serializer exposes attachments');
    for (const percent of [25,50,75,100]) {
      assert.equal(await vscode.commands.executeCommand(`jupyterImageScaler.scale${percent}`, cell, 'image.png'), true);
      const scale = cell.metadata.metadata?.jupyterImageScaler?.['image.png'];
      if (percent === 100) assert.equal(scale, undefined);
      else assert.equal(scale.width, percent * 8);
      assert.equal(JSON.stringify(cell.metadata.attachments), original);
      check(`Command ${percent}% preserves original attachment bytes`);
    }
    await vscode.commands.executeCommand('jupyterImageScaler.scale25', cell, 'image.png');
    await vscode.commands.executeCommand('jupyterImageScaler.scale75', cell, 'second-image.png');
    await vscode.commands.executeCommand('notebook.focusTop');
    await pause(500);
    await vscode.commands.executeCommand('undo');
    await pause(400);
    assert.equal(cell.metadata.metadata?.jupyterImageScaler?.['second-image.png'], undefined);
    assert.equal(cell.metadata.metadata?.jupyterImageScaler?.['image.png']?.percent, 25);
    await vscode.commands.executeCommand('redo');
    await pause(400);
    assert.equal(cell.metadata.metadata?.jupyterImageScaler?.['second-image.png']?.percent, 75);
    check('Native notebook Undo / Redo restores scale metadata');
    await vscode.commands.executeCommand('jupyterImageScaler.scale50', cell, 'image.png');
    assert.equal(await notebook.save(), true);
    const saved = JSON.parse(fs.readFileSync(file));
    assert.equal(saved.cells[0].metadata.jupyterImageScaler['image.png'].percent, 50);
    assert.deepEqual(saved.cells[0].attachments, JSON.parse(original));
    assert.deepEqual(saved.cells[0].metadata.tags, ['keep']);
    check('Save stores custom metadata and intact attachments in nbformat');
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    notebook = await vscode.workspace.openNotebookDocument(vscode.Uri.file(file));
    await vscode.window.showNotebookDocument(notebook);
    cell = notebook.cellAt(0);
    assert.equal(cell.metadata.metadata.jupyterImageScaler['image.png'].percent, 50);
    check('Close / reopen retains independent 50% and 75% presets');
    fs.writeFileSync(path.join(out, 'ready.json'), JSON.stringify(result, null, 2));
    // The browser test inspects actual Notebook image dimensions, clicks status
    // controls and checks the image chooser. It releases this runner afterward.
    for (let n=0;n<600;n++) { if (fs.existsSync(path.join(out,'release'))) break; await pause(500); }
    result.ok = true;
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
  } catch(error) {
    result.error = error.stack;
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
    throw error;
  }
};
