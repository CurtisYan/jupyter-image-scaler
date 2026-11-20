const vscode=require('vscode');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
exports.run=async()=>{
  const out=process.env.JIS_RUN;fs.mkdirSync(out,{recursive:true});
  const checks=[];const result={checks,version:vscode.version};
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800"><rect width="1600" height="800" fill="seagreen"/></svg>');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    await vscode.extensions.getExtension('local-notebook-tools.jupyter-image-scaler').activate();
    const remote=`http://127.0.0.1:${server.address().port}/hosted.svg`;
    const source=`![local](image.svg)\n\n![hosted](${remote})`;
    const local=path.join(out,'image.svg');const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800"><rect width="1600" height="800" fill="steelblue"/></svg>';
    fs.writeFileSync(local,svg);
    const file=path.join(out,'sources.ipynb');
    fs.writeFileSync(file,JSON.stringify({nbformat:4,nbformat_minor:5,metadata:{},cells:[{id:'local-hosted-cell',cell_type:'markdown',metadata:{tags:['keep']},source:[source]}]}));
    let nb=await vscode.workspace.openNotebookDocument(vscode.Uri.file(file));await vscode.window.showNotebookDocument(nb);let cell=nb.cellAt(0);
    for(const ref of ['image.svg',remote]){
      for(const percent of [25,50,75,100]){
        assert.equal(await vscode.commands.executeCommand('jupyterImageScaler.applyPreset',cell,{percent},ref),true);
        assert.deepEqual(cell.metadata.metadata?.jupyterImageScalerSources?.[ref],percent===100?undefined:{percent});
        assert.equal(cell.document.getText(),source);
      }
      checks.push(`All four presets apply through VS Code commands: ${ref==='image.svg'?'local file':'hosted URL'}`);
    }
    await vscode.commands.executeCommand('jupyterImageScaler.applyPreset',cell,{width:320,height:180},'image.svg');
    await vscode.commands.executeCommand('jupyterImageScaler.applyPreset',cell,{percent:75},remote);
    await vscode.commands.executeCommand('undo');await pause(150);
    assert.equal(cell.metadata.metadata.jupyterImageScalerSources[remote],undefined);
    await vscode.commands.executeCommand('redo');await pause(150);
    assert.deepEqual(cell.metadata.metadata.jupyterImageScalerSources[remote],{percent:75});
    checks.push('Native Undo / Redo independently restores source-image scale');
    await nb.save();const saved=JSON.parse(fs.readFileSync(file));
    assert.deepEqual(saved.cells[0].metadata.jupyterImageScalerSources['image.svg'],{width:320,height:180,mode:'pixels'});
    assert.deepEqual(saved.cells[0].metadata.tags,['keep']);assert.equal(saved.cells[0].attachments,undefined);assert.equal(fs.readFileSync(local,'utf8'),svg);
    checks.push('Save retains pixel sizes, unrelated metadata, original image file, and source references');
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');nb=await vscode.workspace.openNotebookDocument(vscode.Uri.file(file));await vscode.window.showNotebookDocument(nb);cell=nb.cellAt(0);
    assert.equal(cell.metadata.metadata.jupyterImageScalerSources[remote].percent,75);await vscode.commands.executeCommand('notebook.cell.quitEdit');
    checks.push('Close / reopen retains local and hosted image sizes');
    fs.writeFileSync(path.join(out,'ready.json'),JSON.stringify({...result,remote},null,2));
    for(let i=0;i<240&&!fs.existsSync(path.join(out,'release'));i++)await pause(500);
    assert.ok(fs.existsSync(path.join(out,'release')),'Notebook UI checks did not complete');result.ok=true;
  }catch(e){result.error=e.stack;throw e;}finally{server.close();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));}
};
