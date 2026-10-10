# Jifengjincao Bridge 项目补充规范

开始任务、恢复任务或规范更新后，必须主动读取并遵循 [MN 通用开发规范](D:/WorkSpace/MN/AGENTS.md)。本文仅保存本项目补充。

- 插件名称为 `Jifengjincao Bridge`，插件 ID 为 `cn.marginnote.jifengjincao-bridge`。
- 测试包固定为 `Jifengjincao Bridge Test.mnaddon`；正式包为 `Jifengjincao Bridge-v<版本号>.mnaddon`。
- 新项目初始化的 `0.0.0` 仅为测试元数据，不是正式版本；正式发布前由用户指定版本，禁止发布 `0.0.0`。
- 全局标识符使用 `__JFJC_*__` 前缀或 IIFE；原生 JSB 类名使用 `JifengjincaoBridge` 前缀。
- 本次用户已批准 [首版方案](docs/bbkaoyan-to-mn-plan.md)，可以实现、测试和生成测试包；尚未确认真机成功，不提交 Git 或生成正式包。
- 修改站点适配或导入流程时阅读上述方案及 [API 核验](docs/mn-api-research.md)。保持同源网站会话、Markdown/LaTeX 原文、离线图片和保守去重。
- Web 页面源码在 `web/src/`，构建产物在 `src/web-dist/`。测试运行 `npm test`，语法检查 `npm run check`，测试构建 `npm run build`。
- 通用规则例外：首版注入第三方网站，按已批准方案使用短命令 scheme 与原生分块读取；网页命令在 `BBKaoyanPage.js`，原生命令在 `WebPanelController.js`。加入本地 Web 设置页时遵循通用 `MNBridge` / `WebBridgeCommands` 约定。
