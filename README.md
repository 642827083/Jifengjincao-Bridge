# Jifengjincao Bridge 1.0.0

连接 [疾风劲草题库](https://bbkaoyan.cn/) 与 MarginNote 4 的插件。

- 内嵌数学题库、独立导入页与原生设置页。
- 支持真题和模拟卷分类、题型筛选、选题导入。
- 保存 Markdown、LaTeX 与离线图片，建立题卡和答案解析子卡。
- 支持保守去重、补充答案解析、停止与失败重试。
- 提供知识点、原题链接开关，以及 AI 对话的剪贴板图片附件入口。

使用前安装并启用 [MN Utils](https://mnaddon.craft.me/mnapi)，最低 MarginNote 版本为 4.4.5。

## 开发

```sh
npm run check
npm run build
```

默认构建生成测试包；正式构建使用 `npm run build:release`，禁止覆盖已有正式包。源码位于 `src/` 和 `web/src/`，`src/web-dist/` 为构建生成目录。

该历史版本的运行源码从原 1.0.0 正式安装包还原，网页源码由包内字符串资源拆分恢复，并逐项核对 SHA256。Git 仓库建立于该版本发布之后，因此此提交记录还原的版本快照。
