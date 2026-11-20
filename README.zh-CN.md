# Jupyter Image Scaler · 图片缩放

[English](https://github.com/CurtisYan/jupyter-image-scaler/blob/main/README.md) | 简体中文

通过紧凑悬浮菜单缩放 VS Code Jupyter Notebook Markdown 图片，支持 **本地文件、图床链接和内嵌附件**，不改写 Markdown 或原图。

![图片缩放菜单](docs/images/外部菜单.png)

## 安装

1. 从 [Releases](https://github.com/CurtisYan/jupyter-image-scaler/releases/latest) 下载 `.vsix`。
2. 在 VS Code 选择 **扩展 → … → 从 VSIX 安装…**。
3. 保存 Notebook，执行 **开发人员：重新加载窗口**。

渲染 Markdown 单元格，把鼠标移到图片上即可操作。原有引用无需转换：

```md
![本地图片](image.png)
![图床图片](https://example.com/image.png)
![附件](attachment:image.png)
```

## 功能

- **25% / 50% / 75% / 100%**：以默认显示宽度为基准，100% 恢复默认。
- 自定义百分比和像素尺寸：`320` 等比设置宽度，`320x180` 指定宽高。
- 齿轮菜单可保存、排序和删除快捷档位，最多 12 档。
- 紧凑悬浮菜单或 **图片外部（自动避让）** 样式。
- 尺寸随 Notebook 保存，支持原生撤销、重做。

也可使用编辑状态按钮、单元格工具栏的放大镜，或 **⌘⌥I / Ctrl+Alt+I**。目前界面为中文。

要求 **VS Code 1.100+**。仅处理 `.ipynb` Markdown 图片，不处理代码输出、HTML `<img>` 和独立 `.md` 预览；图床图片需能在 VS Code 中正常加载。其他编辑器可能忽略尺寸设置。当前更新需手动安装新版 VSIX，GitHub Release 不会触发 Marketplace 自动更新。

[详细说明](https://github.com/CurtisYan/jupyter-image-scaler/blob/main/docs/usage.zh-CN.md) · [示例 Notebook](https://github.com/CurtisYan/jupyter-image-scaler/blob/main/examples/附件图片缩放示例.ipynb) · [测试记录](https://github.com/CurtisYan/jupyter-image-scaler/blob/main/docs/v1.3.0-tests.md)

## 源码开发

```sh
npm ci
npm test
npm run package -- --out releases/jupyter-image-scaler-1.3.0.vsix
```

[MIT 许可证](https://github.com/CurtisYan/jupyter-image-scaler/blob/main/LICENSE)。
