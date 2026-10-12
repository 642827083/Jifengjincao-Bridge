# Jifengjincao Bridge 1.0.1

连接 [疾风劲草题库](https://bbkaoyan.cn/) 与 MarginNote 4 的插件。

- 内嵌数学题库、独立导入页与原生设置页。
- 支持真题和模拟卷分类、题型筛选、选题及整卷导入。
- 保存 Markdown、LaTeX 与离线图片，建立题卡和答案解析子卡。
- 支持保守去重、补充答案解析、停止与失败重试。
- 支持从网站定位 MN 题卡，可选择仅定位或定位并聚焦。
- 提供知识点、原题链接开关，以及 AI 对话的剪贴板图片附件入口。

使用前安装并启用 [MN Utils](https://mnaddon.craft.me/mnapi)，最低 MarginNote 版本为 4.4.5。

正式安装包与本版更新说明见 [1.0.1 Release](https://github.com/642827083/Jifengjincao-Bridge/releases/tag/v1.0.1)。

## 开发

源码位于 src/ 和 web/src/；src/web-dist/ 为构建生成目录。

运行 npm run check 检查语法，npm run build 生成测试包。正式构建使用 npm run build:release，禁止覆盖已有正式包。

这是已有 1.0.1 正式包的历史源码快照。原生运行源码从原安装包恢复，网页源码与包内合并资源逐项核对；未混入之后的测试改动。原发布时尚未建立 Git 仓库，因此补建此快照，以便版本标签与原安装包对应。
