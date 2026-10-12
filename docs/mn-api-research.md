# MarginNote / MN Utils 接口核验

### 2026-10-13：导航入口与题篮工具

本轮同时移除网页诊断的原生界面、探针、轮询及安装包资源，保留加载就绪检查与普通错误处理；批量建卡路径取消题型层，复用原有 addChild / insertChildBefore 和全学习集身份扫描。没有新增 MN 接口，不迁移已有题型分组或用户批注。

最新官方站本次仍不可读取，重新阅读运行时、全局对象及 UIWebView 文档。沿用同源脚本注入、短 scheme 与分块传输，不新增 MN API 或网站写接口。本站当前公开部署包 `/assets/index-DNVX-les.js` 确认 `.topbar .primary-nav` 的第一个导航组为 AI 组件；入口放在导航组件之前的兄弟节点，React 替换导航后由观察器恢复。部署源码的题篮详情使用 `.basket-detail-page`（公开题篮为 `.shared-basket-page`）、`article.basket-detail-question-card`、`basket-question-<id>` 和 `.question-global-id`，私人与公开题篮分别使用 `/baskets/:id`、`/public-baskets/:id`。只通过已加载的 DOM 读取题目身份，完整内容与原卷信息仍读取同源 `/api/questions/:id`；页面节点或题目序列变化会拒绝旧预览。定位和单题导入复用现有检查 MN Utils 可用性的实现。未测试真实登录题篮和 iPad WebView，自动化验证不替代真机验收。

### 2026-10-12：AI 找题与导入本题

重新核验 JavaScriptCore 运行时、全局对象及 mndocs 的 [NotebookController](https://mn-docs.museday.top/reference/marginnote/notebook-controller/) 与 [MbBookNote](https://mn-docs.museday.top/reference/marginnote/mb-book-note/)：当前窗口的 `focusNote`、`notebookId` 用于同步捕获落点；`parentNote`、`childNotes` 及 `insertChildBefore` 用于同级插入。复用已有检查接口可用性的 MN Utils 包装创建卡片、追加 Markdown、图片转存和撤销分组。新文档站本次不可读取，MN Utils 在线 Craft 正文仍不可读取，未据此引入未经核验的封装。参考本地大观园 `DaguanyuanSingleImport.js` / `DaguanyuanMathImport.js` 的预捕获、子节点／同级节点与同父身份去重行为。

网站公开部署包 `/assets/index-DNVX-les.js` 确认 AI 找题地址及快照 DOM；公开 `/api/questions/5395` 返回 `papers` 中的原卷 ID、标题及原题号。DOM 只读取题号和最新结果边界并插入入口，题干、LaTeX、选项、答案、图片和来源读取同源 API。`single-import` / `cancel-single` 仍走短 scheme，长数据经原生分块传输；不读取 React 私有状态，不新增网站写接口或站外会话。公开题目验证不能代替登录账号的找题功能和真实 MN 验收。

2026-10-12 补充（cn 站点与设置诊断）：先尝试最新官方文档 `https://mnext.museday.top/`，本次网页工具无法读取；按通用规范改用 mn-docs-mcp 阅读 UIWebView、UIButton 与 UIScrollView 全文，并重新读取运行时及全局对象文档。继续使用既有原生 `loading`、`evaluateJavaScript`、`NSTimer`、`addTargetActionForControlEvents` 和设置页滚动布局，没有新增 MN 数据库接口。诊断入口与报告只在设置显示，保留 cn 同源业务校验、加载等待、敏感信息遮蔽及旧回调取消。自动化验证通过，真实 MN 外观仍需设备确认。

2026-10-08 补充（注释集中到第二条）：用户确认移除原题链接开关，题目卡第一条保存完整图文，第二条先放“查看原题”再放 QUESTION / ORDER / SOURCE。重新查阅运行时、全局对象和 MbBookNote 文档及 MN Utils 官方公开 JSON，继续使用现有 `appendMarkdownComment`、`removeCommentByIndex`、评论排序及 `undoGrouping`，没有新增 MN API。去重、原卷排序和定位本来扫描卡片所有评论，不要求身份在题干。旧卡迁移先保存正文与完整身份，再清理旧位置；保留用户笔记、手写、媒体、子卡及标题，处理失败可重试及撤销。答案子卡仍按原结构保存自己的 PART / ANSWER 注释。本轮为模拟宿主验证，真实评论显示需真机确认。

2026-10-07 补充（定位校验返回值）：重新查阅运行时、全局对象及 [UIWebView](https://mn-docs.museday.top/reference/uikit/uiwebview/) 文档，`evaluateJavaScript` 回调结果标为 `any`，不能依赖始终返回 JS 布尔值。本次不增加 MN API，沿用 `BBKaoyanClipboard.accepted` 的文字确认模式，在网页内将校验结果变成 `accepted`／`rejected`，原生侧按 String 读取；测试覆盖 BOOL 被转换为字符串 1 和 NSString／NSNumber 包装的情况，同时校验无效题目仍不能通过。

2026-10-07 补充（定位卡片）：查阅 MN Utils 官方公开 JSON 中 `MNUtil.focusNoteInMindMapById(noteId, delay=0)` 与 `MNNote.focusInMindMap(delay=0)` 的实现，二者均绑定 `MNUtil` 当前窗口／学习集。定位当前窗口时优先调用 `MNUtil.focusNoteInMindMapById`；多窗口且插件窗口不是 `MNUtil.currentWindow` 时，使用已经查阅的 [StudyController](https://mn-docs.museday.top/reference/marginnote/study-controller/) 显式窗口定位接口，避免定位到其他窗口。定位前检查 MN Utils 方法存在。原生 [NotebookController](https://mn-docs.museday.top/reference/marginnote/notebook-controller/) 的 `changeFocusToNote(note)` 用于“定位并聚焦”，官方 MN Utils 文档没有对应的适用封装。跨学习集沿用大观园的 `Database.allNotebooks()` 实际题卡扫描及官方 `marginnote4app://note/<noteId>` 链接切换，等待目标学习集后再定位；引用运行时、全局对象及数据库文档，所有关键接口检查存在或在失败时提示。模拟测试不等于 MN 真机确认。

2026-10-07 补充：用户确认将内部注释固定在题干评论末尾，原题链接单独成为第二条评论；关闭链接时不创建第二条。再次阅读运行时、全局对象和 MbBookNote 文档，并读取 MN Utils 官方公开 JSON，确认继续使用现有 `appendMarkdownComment`、`removeCommentByIndex` 和 `undoGrouping` 封装。评论替换和排序沿用已有 Native 模块，未增加原生 API。QUESTION / ORDER 的内容和去重排序语义保留，有链接时 SOURCE 也放在题干。旧卡先保存正文与身份，再清理旧链接或纯注释评论，模拟测试验证失败重试、撤销及用户改动保护；注释在 MN 卡片外观中的实际显示仍需真机确认。

核验日期：2026-10-04。用于 Jifengjincao Bridge 首版；此处记录文档和参考源码证据，不代表已完成 MarginNote 真机测试。

## 来源与读取方法

- [MN Utils 官方 API](https://mnaddon.craft.me/mnapi)。页面为动态 Craft，普通正文抓取不可用；Browser runtime 已连接但没有可用浏览器。公开页面 HTML 暴露 share ID `Yu9p399L0u85oP`，其公开脚本使用 `/api/share/<shareId>?enablePagination=true` 读取正文。此次通过 [同一文档的公开只读 JSON](https://mnaddon.craft.me/api/share/Yu9p399L0u85oP?enablePagination=true) 读取完整 blocks，未绕过认证或读取浏览器会话。
- [MarginNote 插件运行时](https://mn-docs.museday.top/reference/js-runtime/) 与 [全局对象](https://mn-docs.museday.top/reference/global/global-variables/) 已阅读。原生 `src/` 是 JavaScriptCore，没有浏览器 `fetch` 和 `setTimeout`；网页注入脚本与原生层必须分开。
- 下文的 Craft block ID 可在公开 JSON 中直接定位；网页子页面链接可能由 Craft 动态生成，所以统一链接到文档入口。
- 本地参考实现：[Daguanyuan](D:/WorkSpace/MN/daguanyuan-bridge/src/DaguanyuanMathImport.js) 与 [Yankean](D:/WorkSpace/MN/yankean-bridge/src/YankeanImport.js)。它们是调用示例，不替代接口文档。

## 应优先使用的 MN Utils 封装

| 接口 | 已核实参数 / 行为 | Craft 证据 |
| --- | --- | --- |
| `MNUtil.getNoteById(noteId)` | 返回原始 `MbBookNote`，不是 `MNNote`；实现调用 `this.db.getNoteById(noteId)`。 | `DB0CD405-3120-4739-AB23-7C46416CFE83` |
| `MNNote.new(param)` | 文档推荐替代直接 `new MNNote`；不存在的笔记返回 `undefined`。参数可为原始笔记、ID、笔记 URL 或新建配置。 | `7BBC0E70-CF23-46DC-805A-81393570A22A`、`CB4F53D1-21B8-4022-A558-A38CCD36A379` |
| `MNNote` 实例的 `.note` | 原始笔记对象。官方 `addChild` 实现操作 `this.note`，传入包装对象时使用 `note.note`。 | `37CC1D15-F736-481E-A8F3-1CE11C995CB2` |
| `MNNote.appendMarkdownComment(text)` | MNNote 实例方法清单列出，与原始 Markdown 评论接口对应；本地大观园使用 `MNNote.new(id).appendMarkdownComment(markdown)`。 | `61C0D27E-92AE-4FD9-A780-F420ABEA2A95`；本地 `DaguanyuanMathImport.js` 的 `commentEditor` / `initializeQuestion` |
| `MNNote.addChild(note)` | 支持原始笔记、MNNote、ID 或笔记 URL。它不自动包撤销；无有效笔记可能仅提示 HUD，因此写后应校验父节点。 | `37CC1D15-F736-481E-A8F3-1CE11C995CB2` |
| `MNNote.processMarkdownBase64Images()` | 列在实例方法清单；原生方法行为见下文。运行时应检查方法存在并验证处理结果。 | `0595CCBE-CF99-4DFE-928B-49D9F2D49821` |
| `MNUtil.undoGrouping(callback, notebookId)` | 第二参数默认当前学习集；实现调用 UndoManager，再刷新该学习集。没有 `return`，不透传 callback 的结果。必须传任务捕获的学习集 ID，并通过外部变量接收写入结果。 | `1D618117-C609-4242-AAD9-B89B8B66E878` |
| `MNUtil.setLocalDataByKey(value, key)` / `getLocalDataByKey(key)` | 少量配置存储，封装 NSUserDefaults。使用带插件前缀的 key，结构化配置先 JSON.stringify，排除 undefined / null / 函数。 | `D332992D-C85B-4EDA-973F-AFF5ADF1E0EC`、`56BE0EDA-231C-405D-92A6-029ED87AEF14` |
| `MNUtil.readJSON(path)` | NSData 读取后 JSON 解析；调用者仍需检查不存在、空内容、非法 JSON、schema。 | `9406BCF6-6F66-49B8-8024-2E66BC76FBE4` |

上述接口使用前必须检查 `MNUtil`、`MNNote` 及具体方法，缺失时提示安装并启用 MN Utils，不能静默继续进行数据库写入。

## 无法确认或不适合直接使用的封装

### 固定学习集的新建卡片

MNNote 新建配置的官方例子只有 `title`、`content`；`createChildNote(config)` 的 JSDoc 另列 `excerptText`、`excerptTextMarkdown`、`markdown`、`color`，没有证明 `notebookId` / `doc` 可用。其实现 `new MNNote(config)` 并使用默认当前学习集的撤销分组。因此不能假设 `MNNote.new({title, notebookId})` 能固定异步任务落点，也不能保证无当前文档时的构造行为。证据：Craft blocks `7C90CF0E-C1C0-4F14-BE64-F05A66FCE49A`、`7EF56F1E-F377-4578-AEB4-3DC72E5A3D19`。

实现选择：用原生 `Database.sharedInstance().createNoteWithTitleTopicid(title, capturedTopicId)` 创建指定学习集的裸卡，再用 `MNNote.new(rawNote)` 或 `MNNote.new(rawNote.noteId)` 包装，后续写入和层级尽量使用 MN Utils。这是对明确需要的落点参数使用原生 API，不复制已有包装器。

### 排序与 children 类型

MNNote 文档列出 `childNotes`，没有给出其返回原始数组还是包装对象数组的明确保证；直接读取 `.note.childNotes` 可使用原生 `NSArray` / `MbBookNote` 契约。未找到 MNNote `insertChildBefore` 的可核验签名；按题号插入使用原始 `parent.note.insertChildBefore(child.note, before.note)`，检查方法存在。若已有包装对象，可以先 `MNUtil.getNoteById(id)` 重新获取最新原始对象。出处：[MbBookNote](https://mn-docs.museday.top/reference/marginnote/mb-book-note/)。

### 原子 JSON 写入

MNUtil `writeJSON(path, data)` 官方实现调用 `writeToFileAtomically(path, false)` 且没有返回保存状态；它不足以满足本项目持久化报告的原子写入及成功校验。证据：Craft block `EF8CC380-D930-4D3C-9051-FCB486870031`。

实现选择：持久报告用 `NSJSONSerialization.dataWithJSONObjectOptions(data, 0)` → `NSData.writeToFileAtomically(path, true)`，检查返回结果。读入仍可用 `MNUtil.readJSON(path)` 加结构校验。

## 必要原生接口

### 建卡与媒体

`Database.sharedInstance().createNoteWithTitleTopicid(title: string, topicId: string)` 返回 `MbBookNote`；`getNoteById(id)` 查询；`deleteBookNoteTree(id)` 可清理本次新建失败的题卡和子卡。不需要 PDF 文档参数。出处：[Database](https://mn-docs.museday.top/reference/global/database/)。

原始笔记支持 `appendMarkdownComment(text)`、`addChild(note)`、`insertChildBefore(note, beforeNote)`。`processMarkdownBase64Images()` 命中 Markdown 中的 Base64 图片后转存 MN 媒体并替换引用；`true` 仅表示发生改写。因此有图片时同时检查返回值、正文无 `data:image` 残留；需要时观察 `mediaList`。出处：[MbBookNote](https://mn-docs.museday.top/reference/marginnote/mb-book-note/)。

底层撤销为 `UndoManager.sharedInstance().undoGrouping(actionName, topicId, callback)`；优先使用上文 MNUtil 封装。出处：[UndoManager](https://mn-docs.museday.top/reference/utility/undo-manager/)。

### WebView 与传输

本项目使用 MN 导出的 `UIWebView`，沿用两参考仓库。文档支持 `loadRequest(NSURLRequest)`、`evaluateJavaScript(script, callback)`、`delegate`；delegate 实现 `webViewDidFinishLoad(webView)` 及 `webViewShouldStartLoadWithRequestNavigationType(webView, request, type)`，后者返回 false 拦截自定义协议。出处：[UIWebView](https://mn-docs.museday.top/reference/uikit/uiwebview/)。

不得假设原生 WKWebView、`window.webkit.messageHandlers` 已注入。传输采用现有项目路径：网页发自定义 URL 传命令/小参数，原生注入任务脚本，网页异步取同源 API 后存字符串，原生用 evaluateJavaScript 轮询状态并分块拉取。该回调不应被假设会等待页面 Promise。源头：[Daguanyuan408Import.js](D:/WorkSpace/MN/daguanyuan-bridge/src/Daguanyuan408Import.js:91) 的 `readPayload`、每块 65536 字符、长度/超时校验。网页 fetch 仅在 WebView 页面上下文执行。

### 定时器、配置、文件

- `NSTimer.scheduledTimerWithTimeInterval(seconds, repeats, callback)` 返回 timer，callback 接收 timer；`timer.invalidate()` 停止。原生延时和轮询使用它。出处：[NSTimer](https://mn-docs.museday.top/reference/foundation/ns-timer/)。
- `NSUserDefaults.standardUserDefaults().setObjectForKey(value, key)` / `objectForKey(key)` 用于少量设置；本项目优先 MNUtil 的对应封装。出处：[NSUserDefaults](https://mn-docs.museday.top/reference/foundation/ns-user-defaults/)。
- `NSData.dataWithContentsOfFile(path)` 读取文件；`dataWithStringEncoding(text, 4)` 为 UTF-8；`data.writeToFileAtomically(path, true)` 返回是否成功。出处：[NSData](https://mn-docs.museday.top/reference/foundation/ns-data/)。
- `NSJSONSerialization.dataWithJSONObjectOptions(object, 0)` / `JSONObjectWithDataOptions(data, 0)`，不添加臆造 error 参数；非法 JSON 可能返回 undefined。不能单靠 `isValidJSONObject` 排除函数。出处：[NSJSONSerialization](https://mn-docs.museday.top/reference/foundation/ns-json-serialization/)。
- `NSFileManager.defaultManager().fileExistsAtPath(path)`；`createDirectoryAtPathWithIntermediateDirectoriesAttributes(path, true, null)` 创建目录；检查返回。出处：[NSFileManager](https://mn-docs.museday.top/reference/foundation/ns-file-manager/)。
- 持久目录在 `Application.sharedInstance().documentPath + '/cn.marginnote.jifengjincao-bridge/'`；中间资源在对应 tempPath 子目录。出处：[Application](https://mn-docs.museday.top/reference/global/application/) 与 [共同规范](D:/WorkSpace/MN/AGENTS.md)。

## 真机验收边界

### 2026-10-06：独立导入页

目录显示调整不新增原生 API 或 bridge 命令，只修改 Web 源码。网站公开部署脚本使用 `paper.provider.name` 与 `paper.series.name` 组合模拟卷名称，并用 `set_number` 格式化卷号；目录读取现兼容对象提供方、字符串及 `provider_name`，继续使用同一网站会话和原传输校验。未登录模拟卷请求返回空目录，不能用公开真题验证账号的模拟卷权限。展示用的年份和卷号不会替代试卷 ID 或改变导入标题。

重新查阅 [JavaScriptCore 运行时](https://mn-docs.museday.top/reference/js-runtime/)、[全局对象](https://mn-docs.museday.top/reference/global/global-variables/)及 [UIWebView](https://mn-docs.museday.top/reference/uikit/uiwebview/)。独立页面使用已记录的 `loadHTMLStringBaseURL(html, null)` 和 `evaluateJavaScript`，由同一面板 delegate 按 WebView 实例区分网站与本地页面。本地页面只接受 `mnaddon://bridge` 命令和初始 `about:blank` 加载；网站沿用原有短命令与分块传输。

MN Utils 在线入口与公开 JSON 本次网页工具抓取失败，建卡、状态检查及配置存储复用本文已核验的封装，不引入新的 MN 数据库 API。Web 页面通过 `web/src/lib/mnBridge.js` 的 `MNBridge.send` 发命令，Native 在 `src/WebBridgeCommands.js` 处理；不使用网页业务存储。数学页面实例保留，用它的同源 `fetch(credentials: include)` 读取试卷目录、题目和图片，原文留在网站任务中，经现有分块通道交给建卡流程。

公开样例 `/api/papers?subject=math1&page_size=2` 返回 `items/page/page_size/total`，科目为 `math1`，真题 `kind` 为 `official`，年份为整数，题数为 `question_count`。目录按页读取，并验证身份、科目、类型及重复项。新增页面仍以单份试卷为导入范围，未实现跨试卷任务或按知识点建卡。真机仍需验证隐藏网站 WebView 的登录会话、脚本执行、原生回调、本地页面初次加载、公式及离线图片。

### 2026-10-06：数学与原生设置页

重新阅读 [JavaScriptCore 运行时](https://mn-docs.museday.top/reference/js-runtime/) 与 [全局对象](https://mn-docs.museday.top/reference/global/global-variables/)。参考大观园现有原生导航和分组卡片，使用 [UIScrollView](https://mn-docs.museday.top/reference/uikit/uiscrollview/) 的 frame / contentSize、[UILabel](https://mn-docs.museday.top/reference/uikit/uilabel/) 的 numberOfLines 和 [UISwitch](https://mn-docs.museday.top/reference/uikit/uiswitch/) 的 on 属性；开关监听 ValueChanged（1 << 12），页签使用 [UIButton](https://mn-docs.museday.top/reference/uikit/uibutton/) 的 TouchUpInside（1 << 6）。字体沿用 [UIFont.boldSystemFontOfSize](https://mn-docs.museday.top/reference/uikit/uifont/)。新模块检查 UIScrollView 与 UISwitch 是否存在。

MN Utils 在线 Craft 页面本次正文抓取失败，重新查阅此前读取的官方公开 JSON：setLocalDataByKey(data, key) 与 getLocalDataByKey(key) 分别封装 NSUserDefaults 写入与读取，沿用已存在的原生配置封装；缺失时走已核验的 NSUserDefaults。配置 key 为 cn.marginnote.jifengjincao-bridge.import.include-topics，默认开启，只保存布尔值。本次设置页完全使用原生 UIKit，不新增本地 Web 设置页或网页业务存储。导入框打开时捕获配置，标题使用原来源字符串，正文只按设置添加知识点，不迁移已有题卡的标题或来源行。

本次新增“导入原题链接”开关，配置 key 为 `cn.marginnote.jifengjincao-bridge.import.include-source-link`，默认开启。与知识点选项独立保存，复用同一 UISwitch、事件与配置封装，不新增原生 API。导入框打开时捕获配置；关闭仅省略新题卡的可见链接，保留题卡身份与顺序标记，不修改已有题卡。

### 2026-10-05：原题面板跳转与旧链接迁移

2026-10-06 评论布局调整：重新阅读原生运行时、全局对象和 MbBookNote 文档，复查已下载的 MN Utils 官方公开 JSON 中 `appendMarkdownComment` / `removeCommentByIndex`；在线 Craft 正文仍抓取失败。继续使用 MNNote 封装追加和删除，必要排序沿用已核验的 `sortCommentsByNewIndices`，未引入新原生 API。新答案的身份标记与答案正文写入同一评论，只有解析时与解析同行保存；旧纯标记评论先合并正文、再删除。原题链接单独追加 Markdown 评论，带 `JFJC_SOURCE` 标记；题卡身份与排序仍留在题干。旧题干只拆分带明确身份且 URL 匹配的独立原题段落，不重取正文。变更由撤销分组保护，模拟测试验证保存或静默删除失败时原文保留，真实 MN 的注释隐藏显示仍须验收。

- [MN Utils 文档](https://mnaddon.craft.me/mnapi) 的公开 JSON 核实了 `MNUtil.addObserver(observer, selector, name)`、`removeObserver(observer, name)`；优先使用这两个封装，接口缺失时使用文档明确的 [NSNotificationCenter](https://mn-docs.museday.top/reference/foundation/ns-notification-center/) 接口。
- 插件 URL 使用 `marginnote4app://addon/jifengjincao-bridge?action=open&paper=<id>&question=<id>`。[OhMyMN 作者维护的事件文档](https://github.com/ourongxing/ohmymn/blob/main/packages/docs/dev/events.md) 明确 URL 的 `/addon/` 路径触发 `AddonBroadcast`，消息在 `sender.userInfo.message` 中，内容为插件名与 query；[作者的实际事件处理源码](https://github.com/ourongxing/ohmymn/blob/main/packages/ohmymn/src/jsExtension/handleReceivedEvent.ts) 按当前窗口过滤广播。MN4 的 scheme 前缀也见[开发者发布的 URL API 示例](https://bbs.marginnote.com.cn/t/topic/67874)。这属于有源码和文档依据的适配，仍需在用户的实际 MN4 中验收通知触发。
- MN Utils 文档建议在 MN4 使用 `self.window === MNUtil.currentWindow`，不依赖 `checkSender`；封装缺失时读 [Application](https://mn-docs.museday.top/reference/global/application/) 的 `focusWindow`。严格检查插件 key、动作与安全整数 ID，只生成本站题目 URL。
- 没有发现可核实的全局 HTTPS 链接点击拦截 API。因此旧卡片在打开面板时改为插件 URL，不尝试接管所有网站链接。仅处理带 `JFJC_QUESTION` 标记且原链接编号一致的正文。通过 MN Utils 追加 Markdown、删除指定评论，按 [MbBookNote.sortCommentsByNewIndices](https://mn-docs.museday.top/reference/marginnote/mb-book-note/) 恢复原顺序，每张卡片一个撤销分组；不重建用户评论、手写、媒体或子卡。
- 网站当前部署脚本的题目 `anchorId` 为 `question-<question.id>`。网页模块在 React 插入目标元素后滚动一次，偏移避开网站顶部导航；后续普通 DOM 变化不会反复拉回目标题目。

测试必须覆盖 MN Utils 的实际版本与上述实例方法可用性、指定学习集无文档建卡、LaTeX 渲染、题图本地化后离线查看、完整撤销、页面切换取消、原父卡删除/移动、重复导入、部分答案缺失和保存失败。文档不能替代这些验证。

### 2026-10-05：复盘页剪贴板图片

MN Utils 的公开 API 文档确认复制图片的封装，但未发现适用的读取剪贴板图片封装；公开文档附带的 `JSBUIPasteboard.h` / `UIPasteboard.ts` 明确 `generalPasteboard().image` 为 UIImage。因此复用大观园现有原生读取方式，逐项检查接口与数据。导出使用 [UIImage.pngData / jpegData](https://mn-docs.museday.top/reference/uikit/uiimage/)，Base64 使用已核验的 NSData 接口，传输沿用 UIWebView evaluateJavaScript 分块流程。只在点击按钮时读取，图片不进入插件持久存储。

网站公开部署源码证明复盘输入框接受 `clipboardData.items` 中的 file，并交给原有图片校验和附件上传回调。插件不自行拼接未公开的上传接口，只构造 File 并派发 paste 事件；观察附件 `is-uploaded` 后提示用户发送，`is-failed`、超时和切题则报告未完成。原生与网页模拟测试不代替真实 MN 中的系统权限及 React 事件兼容性验证。

### 2026-10-05：导入预览与标题字体

标题使用 [UIFont](https://mn-docs.museday.top/reference/uikit/uifont/) 文档明确的 `boldSystemFontOfSize(14)`，与本地 Yankean Bridge 标题一致；网页预览不新增原生桥接命令或建卡 API。再次阅读原生运行时与全局对象文档。

历史公式预览依据 KaTeX 官方 [renderToString API](https://katex.org/docs/api.html) 和 [配置选项](https://katex.org/docs/options.html)，曾固定 npm 版本 0.19.0。用户随后要求删除预览，当前代码、依赖及安装包均已移除该实现；列表仅显示转义后的文字摘要，完整原文仍由 API 数据提供。该移除不新增原生接口。

### 2026-10-05：共用 AI 附件输入框与回调类型

再次读取公开部署包 `/assets/index-DC-ecNON.js`，确认 `_4` 输入框组件共用于复盘、解题及找题；附件操作栏为 `.assistant-composer-actions`，解题 quiet 模式使用 `.assistant-upload-trigger`，普通模式为 `.assistant-upload-button`，Pro 可选。所有这些输入框使用相同的 onPaste、文件校验及 `onAttachmentReady` 路径，因此粘贴入口可放在操作栏并沿用原有上传行为。

模拟原生 evaluateJavaScript 的布尔返回值转数字 1 时，旧 accepted 判断会拒绝；不依赖宿主的布尔转换约定，改为在页面端将同步布尔结果转换为 accepted / rejected 文本再跨桥返回。这是代码回放证据，并未直接采集用户 MN 的原生回调类型。再次阅读 JavaScriptCore 运行时和全局对象文档；未新增原生 API 或直接上传接口。

### 2026-10-13：文字与图片统一粘贴

先访问新版 API 站点 `https://mnext.museday.top/`，此次工具无法访问，改用 mndocs 检索并读取 UIPasteboard 全文；[UIPasteboard](https://mn-docs.museday.top/reference/uikit/uipasteboard/) 明确 `generalPasteboard().string` 用于读取剪贴板文本。再次阅读 JavaScriptCore 运行时与全局对象文档。沿用已有原生剪贴板读取，不需要新增 MN Utils 依赖；同时存在图片与文字时优先读取图片，只在用户点击时取值，文字不进入持久存储。

当日检查网站公开部署脚本 `/assets/index-DNVX-les.js`，共用 AI 输入框的 textarea 使用 React 受控 `value`，`onChange` 从 `event.target.value` 更新草稿；`onPaste` 只处理文件。因此图片继续派发网站原有 paste 事件，文字则通过 HTMLTextAreaElement 原生 value setter 和冒泡 input 事件同步网站草稿，不读取 React 私有属性、不调用发送接口。文字在网页侧分块接收，提前保存选区，提交前核对对话、题目、输入框和草稿，保留原草稿前后内容并将光标移到插入末尾。附件满额只限制图片，不限制文字。

### 2026-10-13：AI 工具显示粘贴开关

再次访问新版文档站点（工具无法访问），通过 mndocs 读取 [UISwitch](https://mn-docs.museday.top/reference/uikit/uiswitch/) 与 [NSUserDefaults](https://mn-docs.museday.top/reference/foundation/ns-user-defaults/) 全文，并复核原生运行时及全局入口。开关沿用 `new UISwitch(frame)`、`on` 属性与 `1 << 12` 的 ValueChanged 事件，配置复用项目原生偏好封装，插件前缀 key 为 `ai-tools.show-paste`，未保存时默认开启。

网页不保存此业务开关，由原生在注入、打开面板、返回数学页及操作开关时同步。关闭后移除按钮并取消尚未提交的接收；原生命令和剪贴板入口同样检查开关，旧网页命令不会继续读取剪贴板。保留网站原有输入、上传及系统粘贴行为，不更改用户已有草稿或附件。
