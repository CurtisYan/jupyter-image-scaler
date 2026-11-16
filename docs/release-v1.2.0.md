## English

Jupyter Image Scaler brings quick display-size controls to Markdown attachment images in VS Code Jupyter Notebooks. The extension UI is currently in Chinese.

### Highlights

- Hover over a rendered image to switch between 25%, 50%, 75%, and 100%; the current preset is highlighted.
- Percentages use the default visible width, so large images have distinct sizes at all four presets.
- Add custom percentages or pixel dimensions, save them as shortcuts, and reorder them up, down, first, or last.
- Choose a compact overlay or an external toolbar that automatically uses free space beside the image or reserves space below it.
- Smaller toolbar controls and a larger, clearer gear icon.
- Preserve original attachment bytes; save display settings in Notebook metadata with undo and redo support.
- English default README with a complete Simplified Chinese README and language links.

### Install or update

1. Download **jupyter-image-scaler-1.2.0.vsix** from Assets below.
2. In VS Code, open Extensions → **…** → **Install from VSIX…**.
3. Save your Notebook and run **Developer: Reload Window** in its VS Code window.
4. Render a Markdown cell containing `![image.png](attachment:image.png)`, then hover over the image.

Requires VS Code 1.100.0+. Tested on macOS with VS Code 1.145.2: 8 unit tests, 9 extension-host checks, and 16 installed-VSIX interface checks passed. Other platforms have not had real-window testing.

This is a GitHub VSIX release. The extension is not published to Visual Studio Marketplace, and VS Code Auto Update does not fetch GitHub Releases. Install a newer VSIX manually when updating. Custom sizes may be ignored by other editors or export tools; original images remain embedded.

---

## 简体中文

Jupyter Image Scaler 为 VS Code Jupyter Notebook 的 Markdown 附件图片提供快捷显示尺寸控制，扩展界面目前为中文。

### 主要功能

- 鼠标移到渲染后的图片上，即可切换 25%、50%、75%、100%，当前档位高亮。
- 百分比以默认显示宽度计算，大图在四档之间也有明显区别。
- 支持自定义百分比、像素尺寸和保存快捷档位，可上移、下移、移到最前或最后。
- 紧凑悬浮菜单与图片外部自动避让样式可切换，外部菜单自动选择两侧空位，空间不足时在下方预留位置。
- 缩小菜单栏，增大齿轮图标。
- 原始附件字节不变，显示尺寸保存于 Notebook 元数据，支持撤销和重做。
- 默认英文 README，补充完整中文版及双向语言入口。

### 安装或更新

1. 下载下方 Assets 中的 **jupyter-image-scaler-1.2.0.vsix**。
2. 在 VS Code 扩展面板 **…** 菜单选择 **从 VSIX 安装…**。
3. 保存 Notebook，在使用它的窗口执行 **开发人员：重新加载窗口 / Developer: Reload Window**。
4. 渲染包含 `![image.png](attachment:image.png)` 的 Markdown 单元格，将鼠标移到图片上操作。

要求 VS Code 1.100.0 或以上。已在 macOS / VS Code 1.145.2 验证：8 项单元测试、9 项扩展宿主检查及 16 项安装包界面检查通过；其他系统尚未做真实窗口测试。

本次发布为 GitHub VSIX Release，尚未上架 Visual Studio Marketplace。VS Code 自动更新不会读取 GitHub Release，更新时请手动安装新版 VSIX。其他编辑器和导出工具可能忽略自定义尺寸，原图仍嵌入文件。
