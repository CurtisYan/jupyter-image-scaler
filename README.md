# Jupyter Image Scaler

English | [简体中文](README.zh-CN.md)

Resize images in VS Code Jupyter Notebook Markdown cells using a compact hover toolbar. Supports **local files, hosted URLs, and embedded attachments**, keeping your Markdown and original images unchanged.

通过紧凑悬浮菜单缩放 VS Code Jupyter Notebook Markdown 图片，支持 本地文件、图床链接和内嵌附件，不改写 Markdown 或原图。


![Image scaling toolbar](docs/images/外部菜单.png)

## Install

1. Download the `.vsix` from [Releases](https://github.com/CurtisYan/jupyter-image-scaler/releases/latest).
2. In VS Code: **Extensions → … → Install from VSIX…**.
3. Save your Notebook, then run **Developer: Reload Window**.

Render a Markdown cell and hover over its image to show the toolbar. Existing references work as-is:

```md
![local](image.png)
![hosted](https://example.com/image.png)
![attachment](attachment:image.png)
```

## Features

- **25% / 50% / 75% / 100%** presets, relative to the default visible width; 100% resets.
- Custom percentages and pixel sizes: `320` preserves aspect ratio; `320x180` sets both dimensions.
- Save, reorder, and remove up to 12 shortcuts through the gear menu.
- Compact overlay or **outside the image (automatic placement)** toolbar.
- Sizes saved with the Notebook; native undo/redo supported.

Also available through edit-mode buttons, the cell-toolbar magnifier, or **Cmd+Alt+I / Ctrl+Alt+I**. UI currently in Chinese.

Requires **VS Code 1.100+**. Covers `.ipynb` Markdown images, excluding code outputs, HTML `<img>`, and standalone `.md` previews. Hosted images must load normally in VS Code. Other editors may ignore saved sizes. Updates currently require installing a newer VSIX; GitHub Releases do not enable Marketplace auto-updates.

[Usage details](https://github.com/CurtisYan/jupyter-image-scaler/blob/main/docs/usage.md) · [Example Notebook](https://github.com/CurtisYan/jupyter-image-scaler/blob/main/examples/附件图片缩放示例.ipynb) · [Validation](https://github.com/CurtisYan/jupyter-image-scaler/blob/main/docs/v1.3.0-tests.md)

## Development

```sh
npm ci
npm test
npm run package -- --out releases/jupyter-image-scaler-1.3.0.vsix
```

[MIT License](https://github.com/CurtisYan/jupyter-image-scaler/blob/main/LICENSE).
