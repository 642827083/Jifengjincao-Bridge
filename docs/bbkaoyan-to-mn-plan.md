# Jifengjincao Bridge：bbkaoyan → MarginNote 插件落地方案

调研日期：2026-10-04（北京时间）。本文记录实施前的调研与开发方案；当前实现和测试结果见 [实施与验证记录](implementation-validation.md)，尚未在 MarginNote 真机运行。

## 结论

首版采用“大观园的内嵌网站窗口与页面导入入口 + 研科岸的保守建卡流程 + bbkaoyan JSON 数据适配器”。用户在插件窗口浏览 bbkaoyan，打开试卷，选择单题、勾选题目或整卷，导入当前 MN 学习集。需要账号的内容，在同一网站窗口登录后读取。

首版默认按试卷组织题卡，答案与解析合并放入题卡下的“答案与解析”子卡。保留 Markdown/LaTeX，图片保存为 MN 媒体。重复导入只跳过已有题卡或补充缺失的答案子卡。

这是具备实际数据依据的方案：网站题目 JSON、两种现有插件的建卡和网页连接代码均已检查。不过登录会员内容、当前 MN 公式渲染以及图片离线显示还需要真机验证。

## 已核实的网站行为

以下结果来自无登录会话的 HTTP 请求与网站公开部署脚本，只代表本次调研时的行为。

| 地址或资源 | 观察结果 | 开发意义 |
| --- | --- | --- |
| [首页](https://bbkaoyan.cn/)及其引用的[部署脚本](https://bbkaoyan.cn/assets/index-BJ-iQlAZ.js) | React 页面，网页内部 API 前缀为 `/api` | 首选 JSON，DOM 只用于入口、勾选与页面定位 |
| [试卷列表样例](https://bbkaoyan.cn/api/papers?subject=math1&page_size=1) | HTTP 200，返回试卷 237；列表为 `items/page/page_size/total` | 网页内部接口采用页码分页 |
| [试卷 237 的题目](https://bbkaoyan.cn/api/papers/237/questions) | HTTP 200，返回 `paper/questions`，共 22 题：10 选择、6 填空、6 解答；22 题都有答案和解析 | 一次整卷请求即可获取该样例的全部数据，不需要逐题读取 DOM |
| [题目 5074 详情](https://bbkaoyan.cn/api/questions/5074) | HTTP 200，有题干、选项、答案、解析、章节信息 | 单题导入也有实际可用的数据来源 |
| [图片资源 369](https://bbkaoyan.cn/api/question-assets/369) | HTTP 200，`image/png` | 可以下载图片并转存为 MN 媒体 |
| [API 文档](https://bbkaoyan.cn/api-docs)对应的部署脚本 | 文档存在，Base URL 仍为 `https://example.com/api/v1`；账号页 API Key 相关请求受 `EA=false` 控制而不启用 | 不能假定普通用户目前能在网站生成 Key |
| [公共 API 身份接口](https://bbkaoyan.cn/api/v1/me) | HTTP 401，`API_KEY_REQUIRED` | 服务端有公共 API 鉴权入口，但没有凭 Key 验证成功，不能据此认定完整公共 API 可直接接入 |
| [数学一模拟卷列表样例](https://bbkaoyan.cn/api/papers?subject=math1&kind=mock&page_size=2) | 本次未登录请求返回空列表 | 不能把公开真题结果推广为所有模拟卷均可访问 |
| [网站登录状态](https://bbkaoyan.cn/api/auth/me) | HTTP 401，`Not authenticated` | 登录与权限链路仍需在用户自己的插件窗口验证 |

部署脚本明确使用 `credentials: include`、401 后刷新登录会话，并处理会员权限、访问验证与限流错误。内部 `/api` 和公共 `/api/v1` 的返回形状、鉴权与限流不能混用。

公共 API 文档写有每 Key 每 60 秒 10 次、题目每页最多 50 条和游标分页；这不等于网页内部 `/api` 具有同样的限额。内部接口首版低并发读取，以实际 429 和 `Retry-After` 为准。

## 用户流程与首版范围

1. 在 MN 当前学习集打开“Jifengjincao Bridge”窗口，显示 bbkaoyan。
2. 在网站按原有方式浏览、登录并打开某份试卷。
3. 插件提供“导入本题”“导入所选”“导入整卷”入口。入口优先放在插件窗口工具栏，页面注入作为便捷入口，避免必须依赖网站样式选择器才能导入。
4. 导入前显示试卷名称、题目数量、目标学习集，以及“仅题目 / 题目与答案解析”。按试卷顺序预览所选题号。
5. 捕获学习集 ID、试卷 ID、所选题目 ID 和任务 ID。逐题或小批量读取、整理和下载图片，准备好该批次后执行建卡；用户切换页面或学习集时不得误导入新位置。避免把整卷的全部 Base64 图片同时保留在内存。
6. 返回新建、跳过、补答案、失败数量。失败题可重试；成功题不重复建卡。

首版覆盖选择、填空、解答三种题型和单份试卷范围。题目章节作为可见来源信息保留。分类批量导入、选题篮、跨试卷任务、按知识点组织和网站题目更新同步安排在后续版本。

## 卡片结构与字段转换

默认结构：

```text
Jifengjincao Bridge
└─ 数学一
   └─ 2026 年考研数学一真题
      ├─ 一、选择题
      │  └─ 第 1 题
      │     └─ 答案与解析
      ├─ 二、填空题
      └─ 三、解答题
```

父节点和题卡用内部标记识别，标题仅负责展示，不能仅凭标题查重。答案子卡默认折叠；这属于普通脑图卡片结构，专门的复习卡/问答卡转换另行设计。

| 网站数据 | MN 结果 |
| --- | --- |
| `paper.id/title/subject/year` | 试卷身份、父节点名称、来源信息 |
| `section_title/question_number/display_order` | 题型分组、题卡名称、原卷顺序；题号保留字符串 |
| `question.id` | 题目资源身份与去重标记 |
| `stem_latex`，缺失时 `stem` | 题卡 Markdown 正文 |
| `options`，缺失时 `option_text` | 按 A、B、C、D 保留选项与公式 |
| `correct_answer_latex`，缺失时 `correct_answer` | 答案子卡的答案区域 |
| `explanation_latex`，缺失时 `answer_explanation` | 答案子卡的解析区域 |
| `assets` | 按 `usage` 放入题干、选项或解析；按 `sort_order` 排序 |
| `chapter_topics/source/updated_at` | 章节、来源、源数据时间；不擅自合并网站给出的多个知识点 |

题卡放置身份采用 `(notebookId, paperId, questionId)`。同一学习集内对同一试卷重试会复用已有题卡；同一题目出现在不同试卷时，允许各试卷保留自己的出现位置。将来增加按章节组织时需要明确新的放置规则，不能静默搬动用户现有题卡。

## 公式和图片

网站已经提供 LaTeX 原文，应优先使用该原文。只转换公式边界 `\\(...\\)` → `$...$`、`\\[...\\]` → 独立的 `$$...$$`，并整理展示公式空行；保护代码、转义与普通文本。不把整个题干包成一个数学公式，不从 KaTeX 排版后的 DOM 反推原文。

参考 [DaguanyuanMathImport.js](D:/WorkSpace/MN/daguanyuan-bridge/src/DaguanyuanMathImport.js) 的公式段落规范化，但必须新增针对 bbkaoyan 原文的用例。保留接口数据中的数学内容，不自动改题或修正推导。预览失败时显示原文和错误，提供可见的处理提示；确认 MN 宏兼容问题后再决定是否为特定公式增加图片降级。

图片 URL 相对于 `https://bbkaoyan.cn` 解析。登录内容的图片由同一 WebView 同源请求下载，避免假定 WebView Cookie 会自动被原生网络栈共享。将 MIME 类型与 Base64 经分块桥接交给插件层，用 Markdown 图片写入，再调用 `processMarkdownBase64Images()`。若正文含图片占位标记，按网站的实际映射保留插入位置；独立附件才按 `usage/sort_order` 排列，不把所有附件都堆在题干末尾。

只有确实含 Base64 图片时才调用转换，并检查转换后正文不再残留目标 `data:image`、媒体确实写入。该方法返回 `true` 仅表示发生改写，不是“所有图片保存成功”的充分条件。图片失败的题目标为未完成，允许重试，不能报成完整导入成功。

原生方法依据：[MbBookNote 文档](https://mn-docs.museday.top/reference/marginnote/mb-book-note/)。图片路径参考 [YankeanImport.js](D:/WorkSpace/MN/yankean-bridge/src/YankeanImport.js)。

## 插件架构与参考代码

```text
bbkaoyan 网站 WebView
  → 用户触发导入
  → 同源 JSON / 图片读取
  → 任务状态与分块传输
  → 字段校验、LaTeX/Markdown 整理
  → MN 卡片及媒体写入
  → 原生导入记录与结果反馈
```

| 参考项目 | 可复用机制 | 需要调整的部分 |
| --- | --- | --- |
| [大观园 WebPanelController](D:/WorkSpace/MN/daguanyuan-bridge/src/WebPanelController.js) | `UIWebView` 窗口、加载回调、`evaluateJavaScript`、自定义 scheme 拦截 | 插件身份、网站域名、入口和页面路由 |
| [大观园 WebsiteBridge](D:/WorkSpace/MN/daguanyuan-bridge/src/DaguanyuanWebsiteBridge.js) | 注入入口、MutationObserver、防止重复注入 | React 路由变化、试卷和题目识别 |
| [大观园 408Import](D:/WorkSpace/MN/daguanyuan-bridge/src/Daguanyuan408Import.js) | 原生轮询页面任务状态、chunk 传输、取消与清理 | 数据来源改为 JSON，分块限制按设备测试 |
| [研科岸 YankeanImport](D:/WorkSpace/MN/yankean-bridge/src/YankeanImport.js) | 新建卡片、父子结构、图片转存、跳过重复、补答案、失败统计、撤销分组 | 字段、试卷身份、文本答案与解析、插件标记 |
| [大观园 MathImport](D:/WorkSpace/MN/daguanyuan-bridge/src/DaguanyuanMathImport.js) | Markdown 规范化、源数据与输出摘要、保留用户笔记的更新思路 | 首版只借格式化；复杂更新与 MN Utils 依赖后续再评估 |

不能假定现有壳使用 `WKWebView` 或已有 `window.webkit.messageHandlers`。本地大观园源码实际创建 `UIWebView`，使用自定义 scheme 和 `evaluateJavaScript`。scheme 中仅携带命令、任务 ID 与短参数；长正文与图片走分块读取，避免 URL 长度问题。不假定 `evaluateJavaScript` 的回调会等待异步 Promise，使用已存在的“启动任务 → 轮询状态 → 分块取结果”模式。

新增模块建议：`WebPanelController.js`、`BBKaoyanPage.js`、`BBKaoyanAdapter.js`、`BBKaoyanFormat.js`、`BBKaoyanImport.js`、`BBKaoyanImportStore.js`。若加入本地设置/导入面板，再沿用 `web/src/lib/mnBridge.js` 与 `src/WebBridgeCommands.js` 的约定。

网站适配器集中维护 `/api/papers`、`/api/papers/{id}/questions`、`/api/questions/{id}`。React 路由变化后重建入口、清理上一个页面任务。Native 执行前校验当前页面 origin、命令白名单、题目/试卷 ID 与任务 ID；不把任意页面传来的 URL 当作可执行网络命令。

## 认证、错误与持久化

首版直接在网站 WebView 登录，同源请求带 `credentials: include`。不要求用户手工复制 Cookie，也不在插件业务存储中保存网站密码。401 终止当前读取并提示重新登录；403 提示权限不足；428 提示在网站完成验证；429 按服务端等待信息重试；网络失败支持有限重试与取消。调用被网站拒绝时不改用其他接口规避拒绝。

API Key 接入保留为后续独立适配器：只有验证普通用户能获取 Key、正确的生产 Base URL、题目正文/答案/图片字段及限流后才启用。不会让当前 MVP 依赖该条件。

配置、导入映射、未完成任务与 schema 版本由 Native 持久化到插件自己的 JSON 目录；小型显示开关使用带插件前缀的 NSUserDefaults。WebView 不作为业务数据真源。保存原始数据和 `noteId` 映射时，要处理用户删卡、撤销、切换学习集及重装后的失效记录，并核对卡片内部标记，不能仅凭映射跳过。

同一试卷重复导入默认跳过题卡；已有题卡缺少答案时，仅补充答案子卡。用户自行添加的评论、手写、标题和子卡不被重建或覆盖。每个写入批次使用撤销分组，网络准备在分组外进行；分多批导入时，对应多次撤销，导入记录必须能识别撤销后的失效卡片。异常补偿只清理本次创建而未完成的节点，不删除既有节点。

## MN 运行时与依赖核验

`src/` 是 JavaScriptCore，WebView 页面才有 `window/document/fetch`。原生延时与轮询使用 NSTimer；模块只由 main.js 用 JSB.require 加载。依据：[运行时](https://mn-docs.museday.top/reference/js-runtime/)、[全局对象](https://mn-docs.museday.top/reference/global/global-variables/)、[网络请求](https://mn-docs.museday.top/guides/network-requests/)。

建卡、添加 Markdown、父子挂接与图片转换均有原生接口及研科岸现有实现依据。首版不应因复制大观园的完整更新模块而意外引入其全部 MN Utils 依赖。实现前仍按 [MN 通用规范](D:/WorkSpace/MN/AGENTS.md) 核验 [MN Utils API](https://mnaddon.craft.me/mnapi) 是否已有适用封装；此次该链接只获取到动态页面外壳，未完成接口清单核验。不能宣称已经证明无适用封装。若最终采用 MN Utils，必须检测接口并明确提示缺失依赖。

## 开发步骤与验收

1. 最小闭环：复用窗口壳，在 MN 真机打开试卷 237，只导入第 1 题和答案解析；验证数学显示、目标学习集与重试。
2. 图片闭环：导入该卷第 4 题/第 19 题的解析图片，退出网站并断网查看卡片；验证无远程依赖及无残留 Base64。
3. 批量闭环：勾选与整卷导入，保持 22 题原始顺序；检查重复导入、补答案、失败重试、取消、切换页面与撤销。
4. 权限闭环：使用用户实际账号验证一份模拟卷及其图片；验证退出登录、会话过期、权限不足和访问验证提示。
5. 包装：插件名称固定为 `Jifengjincao Bridge`。补齐项目规范和插件独立身份，测试包固定为 `Jifengjincao Bridge Test.mnaddon`；按确认的功能构建测试包，检查包内文件和源码一致。测试成功后再按用户指定正式版本发布，正式包使用 `Jifengjincao Bridge-v<版本号>.mnaddon`。

必要测试覆盖：选择/填空/解答字段、空答案、复杂公式、多图及图片失败、字符串题号、乱序数据、重复导入、答案补充、撤销后映射失效、用户改动保留。网络适配测试使用脱敏固定样例，真机验证覆盖 WebView 登录、公式和离线图片；本次未运行插件测试，也没有生成安装包。

建议以“单份试卷的单题、勾选和整卷导入 + 题目/答案解析模式 + 原生图片保存 + 保守去重”作为首版交付标准。单题公式与图片闭环通过后，再扩展选题篮与分类导入。
