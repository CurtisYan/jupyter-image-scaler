# 现有扩展核查

核查日期：2026-11-16。

未找到经核实同时提供 ipynb 原生附件和 25% / 50% / 75% 快捷预设的现成扩展；这不代表市场上绝对不存在其他产品。

| 扩展 | 已核实功能 | 与本需求的差异 |
| --- | --- | --- |
| [JupyterNotebook Image Editor](https://marketplace.visualstudio.com/items?itemName=TDR474.drag-and-drop-images) | 插入、裁剪、自定义宽高 | 没有文档证据证明支持既有附件的百分比快捷操作；本机 1.1.0 也未发现这些预设 |
| [MiConvert Image Tools](https://marketplace.visualstudio.com/items?itemName=MiConvert.miconvert-image-tools) | 25%、50%、75% 图片文件缩放 | 文档指向文件/目录处理，没有证据支持 Notebook 内部 attachments |
| [Markdown Image Resize Viewer](https://marketplace.visualstudio.com/items?itemName=MetroSoft-Application.markdown-image-resize-viewer) | `.md` 自定义编辑器拖动缩放 | 不是 ipynb Markdown 单元格的原生附件缩放 |
| [Markdown Imsize Support](https://marketplace.visualstudio.com/items?itemName=amoosbr.markdown-imsize) | 普通 Markdown 预览中的图片尺寸语法 | 需手写语法，未证明支持 Notebook 附件与快捷预设 |

实现参考：[VS Code Notebook API](https://code.visualstudio.com/api/extension-guides/notebook)、[NotebookEdit API](https://code.visualstudio.com/api/references/vscode-api#NotebookEdit)。附件处理与保存限制还核对了本机 VS Code 内置 `ipynb` 扩展的 `cellAttachmentRenderer.js` 与 `ipynbMain.node.js`。

