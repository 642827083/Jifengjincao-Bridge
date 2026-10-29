# MarginNote / MN Utils 接口核验

### 2026-10-29：导入只读请求取消与切页

读取最新官方简介及站点导入方案，重新经 mndocs 阅读 JavaScriptCore 运行时和全局入口全文。本次只调整已有 UIWebView.evaluateJavaScript、NSTimer 等待、MNBridge 命令和内存状态，不新增 MarginNote 或 MN Utils 接口，不改变网站同源读取、图片保存、去重及建卡流程。

loadCatalog、loadPaper、状态刷新与偏好读取使用请求身份检查；等待网页就绪时也检查该身份。离开独立导入页可取消这些只读操作，importQuestions 及 running 会话仍须停止后切页。前端通过原有 cancelImport 取消，读取时也展示停止按钮；activate 不再隐式刷新，取消后的迟到结果不应用于当前页面。

### 2026-10-29：官方面板生命周期与读取握手

再次完整阅读官方 [面板之外](https://dev.marginnote.com.cn/zh/jsaddon)、[场景插件基础](https://dev.marginnote.com.cn/zh/plugin-base)、[路径系统](https://dev.marginnote.com.cn/zh/paths)，并经 mndocs 阅读 JavaScriptCore 运行时和全局入口全文。官方示例在 loadPanel 后调用 showFloatingIn(studyController)，清单 panel 指向包内 HTML；hideFloating 会同时清理。旧实现只 loadHTML、立即 post，从未挂载面板，本轮按官方完整流程改正，保留经典插件主窗口及最低版本元数据。手写能力继续在运行时检查，不整体改为 immersiveOnly。

媒体页面启动后通过既有 MNBridge.send('receiveHandwriting', {phase:'ready'}) 主动握手，原生以请求归属面板和当前卡片快照验证，再返回本次 token、noteId、评论序号。图片本身仍通过官方 parts/content 端点获取；新增阶段回传只使用同一命令，长图片保持 65536 字符分块。上传不再限定复盘上下文编号和页面路由，目标仍以实际输入框、当前路由、复盘题目编号（若有）和上传配置版本防止串用。

重用既有令牌检查用户重新确认的 .100 地址，READ_READY 通过；当前 capabilities 不提供可调用的插件 JS 执行或插件日志接口，因此挂载与握手的修正由模拟宿主验证，设备内部链路仍待安装验收。没有改电脑已保存的连接配置，也未扫描其他地址。

### 2026-10-29：官方独立手写 PNG 实测与替换

读取新版官方 [JSAddon 开发](https://dev.marginnote.com.cn/zh/jsaddon)、[批量获取卡片](https://dev.marginnote.com.cn/api-reference/卡片与摘录/批量获取卡片)、[获取卡片媒体文件](https://dev.marginnote.com.cn/api-reference/卡片与摘录/获取卡片媒体文件)，并复核整卡渲染与手写会话预览。整卡渲染会混入题干，手写会话预览针对练习会话，不适合作为任意已有卡片批注的读取入口。

使用用户确认的设备连接及既有令牌完成只读实测，状态、当前 guide 与 capabilities 均核验。设备返回 appVersion 4.5.0、bridgeApiVersion 0.92。选中卡片的 POST /notes/batch-get 返回两项 kind=ink、index=3/4、contentId=sub-3-image/sub-4-image、renderable=true；另有 source=mindmap 的笔迹，必须排除。分别 GET /notes/{noteId}/content/{contentId}?maxEdge=2048，结果如下：

| 批注 | HTTP / MIME | PNG 尺寸 | 字节数 |
| --- | --- | --- | --- |
| 上一条手写 | 200 / image/png | 1024×608 | 208692 |
| 最后一条手写 | 200 / image/png | 1024×787 | 135995 |

最后一条 PNG SHA256 为 2c57bc71e373123e6c8cc164064519b79bd5d1eb7174e434081f313b5f997ab6。透明底下只有该条手写，白底浏览器预览已核对，没有题干或查看原题。layers=base 在此样本返回相同内容；不把该参数误当作“只取手写”的筛选条件。

插件改用官方 AddonWebPanel.loadHTML / post / onMessage，在面板内以 mn.api 读取分项、同源 fetch 读取 PNG，再通过 MNBridge 的 mn.call 通道和 WebBridgeCommands 分块回传。保留原生单选、学习集、评论索引与 drawing 引用快照保护，但不再读取或解析 drawing 媒体；删除 Ink to Card 的 wrd 解析及 SVG 近似渲染。canvas 只在官方 PNG 原尺寸补白底。媒体读取不再调用 MN Utils；项目其他功能原有依赖不在本次改变范围内。包内不保存设备地址或外部 API 令牌。

来源变化、缺块、错误 MIME、超限、取消、30 秒超时均停止并释放面板。网页上传配置带递增版本，避免官方异步读取期间切换来源再切回后复用旧目标。官方 HTTP 端点和 PNG 已在设备实测；AddonWebPanel 与现有经典插件窗口的组合尚需安装测试包确认。

### 2026-10-29：评论排序参数方向

重读运行时、全局对象及 mndocs 的 MbBookNote 全文；最新官方索引可通过 HTTP 读取，旧 MbBookNote 文档仅说明按新索引排序，未解释映射方向。复核本地大观园 CardComments.sort 及配套宿主用例，使用 oldIndex → newIndex 映射。以该语义回放本项目实际修复链，稳定得到用户报告的“新链接、旧链接、题干”；只转换参数方向后恢复正确顺序且删除旧链接。同步纠正本项目测试宿主，避免继续用错误模拟验证自身。该回放不替代用户设备的最终验收。

### 2026-10-29：手动修复题卡格式

复核最新官方入口（本次无法访问）、JavaScriptCore 运行时和全局对象；UIButton、UILabel、MbBookNote 接口沿用此前已读取的文档。最终实现只把原修复函数从面板显示入口移到设置按钮的 TouchUpInside selector，复用既有评论、撤销与提示接口，不新增宿主 API、网页命令、统计确认流程或持久化数据。

### 2026-10-29：精简原题评论与补导追加

访问最新官方入口未成功，按规范通过 mndocs 读取 MbBookNote 全文，并重新阅读 JavaScriptCore 运行时及全局入口文档。此次不新增宿主接口，普通补导复用现有 addChild 挂接；单题指定同级位置保留原 insertChildBefore 流程。评论整理复用既有追加、删除、排序和撤销封装；折叠沿用先前核验的 commentState / setCommentsCollapsed 及版本、持久化检查，只调整新旧身份识别。网站读取与原生持久化结构不变，不新增顺序存储。

### 2026-10-21：统一上传入口与来源设置

先访问新版官方入口（本次工具无法访问），按规范通过 mndocs 读取 UIButton 与 NSUserDefaults 全文，并重新阅读 JavaScriptCore 运行时与全局入口。上传来源复用现有原生二选一弹层、按钮 TouchUpInside（1 << 6）与偏好封装；没有新增宿主 API。MN Utils 在线入口本次无法访问，继续沿用已核验的原生偏好封装和缺失时的 NSUserDefaults 回退。

新增插件前缀偏好 `ai-tools.upload-source`，仅存储 `clipboard` / `handwriting`，默认剪贴板。显示上传沿用旧 `ai-tools.show-paste` 偏好以保留已有状态。原生注入与切页同步来源，统一短命令 `upload-content` 只携带输入框标识，具体来源由原生配置决定。切换来源或关闭上传取消未提交操作；跨窗口配置改变由原生守卫再次校验。手写继续只用于复盘本题对话，使用现有单选卡片、最后一条 drawing、分块、绘图和网站附件流程。窗口默认宽度从 920 调整为 980，高度 680 与边界限制沿用已有 frame 逻辑。


### 2026-10-19：单选卡片最后一条手写上传（历史方案，已由官方媒体接口替代）

重新访问最新官方入口并复核“获取卡片渲染图”文档；该文档属于场景面板 `/bridge/v1`，现有经典 UIWebView 未建立该调用环境，不直接套用 `fetch`。重新阅读 JavaScriptCore 运行时、全局入口及 mndocs 的 MindMapNode、NotebookController；`mindmapView.selViewLst` 可用时只接受一个节点并读取 `.note`，没有选中列表接口时才使用既有 `focusNote`，不在多选或空选时退回旧焦点。

读取参考本地 `Ink-To-Card/src/InkToCardNative.js` 与 `InkToCardDrawing.js` 的真机实现：倒序查找 `type=PaintNote` 且非空 `drawing` 的最后一项，固定评论索引和媒体引用；`drawing` 属于该项目实际设备返回字段，不宣称为公开稳定 API。媒体优先使用此前核验的 `MNUtil.getMediaByHash`，缺少封装时使用官方 `Database.getMediaByHash`，均检查接口与结果。wrd 解析器保留普通笔、通道、变换和未知字段白名单；近似 SVG 在网页转白底 PNG，生成后经原生再次核对卡片和来源才派发网站原有 paste 上传，不增加发送接口，不修改卡片或剪贴板。

网站当前公开部署包 `https://bbkaoyan.cn/assets/index-90VJyEfF.js` 仍使用共用 composer 的文件粘贴、附件校验、`assistant-attachment-item is-${status}` 与 uploaded/failed 状态。桥接命令 `upload-handwriting` 只带输入框标识，长内容沿用 65536 字符分块。窗口关闭、网页导航、输入框替换、切题、切学习集、切卡或最后一条来源变化时停止；普通图片 `paint` 不冒充手写，不回退较早笔迹。

### 2026-10-17：原题评论折叠

网页读取工具无法访问最新官方站，改用 HTTP 读取官方 `llms.txt` 索引与[折叠或展开卡片批注](https://dev.marginnote.com.cn/api-reference/卡片与摘录/折叠或展开卡片批注.md)全文：读取时保存顶层 revision，写入时携带同一版本；目标使用 ownerNoteId / commentId 或读取返回的 1 起始 index，旧评论身份可为空；只有 persisted 为 true 才确认保存。该接口修改评论状态，不修改脑图分支折叠状态。

原生调用沿用本地大观园 `DaguanyuanCommentFold.js` 的 `commentState()` / `setCommentsCollapsed(targets, collapsed, revision)` 示例；新站本页描述的是网页 HTTP 接口，未据此宣称 JSB 方法已在本项目真机验证。运行前检查方法存在，缺少接口时提示更新 MN。重新阅读运行时、全局对象及 mndocs 的 MbBookNote 全文，旧文档未列出这两个方法。折叠独立在建卡撤销分组保存之后调用，冲突不强写，折叠失败作为单独警告，保留题卡、媒体及导入映射；批量范围固定当前学习集，切换学习集、页面或关闭面板时停止。

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

### 2026-10-15：复盘题库编号与对话上下文区分

检查网站当前公开部署脚本 `/assets/index-DwkznktV.js`：复盘右栏“题目上下文”显示 `current_review_item_id`，左栏 `.review-question-card .review-question-source` 的文本及 `aria-label` 显示 `question.id`，二者不能混用。截图样例中 `/api/questions/5684` 返回 200，原卷为 263、第 23 题；上下文编号 29894 对应的 `/api/questions/29894` 返回 404。

定位与单题导入统一从同一复盘工作区左侧读取题库编号，校对可见题号与辅助标签；右侧上下文、题卡实例和所属工作区只参与快照校验。缺少题卡、上下文未知、加载或题号冲突时不产生可执行目标。网页短命令携带 `review-<序号>` 快照，原生保留该快照，沿用既有网页校验、同源取题、分块传输及定位 API。未新增 MN 数据库接口，也不访问 React 私有状态。

修改前访问新版官方入口 `https://dev.marginnote.com.cn/zh/introduction`（本次工具无法访问），重新阅读 JavaScriptCore 运行时与全局入口文档；原生改动仅扩展既有短命令快照前缀白名单，不改变宿主 API 调用。

### 2026-10-18：顶部导航与设置分类的原生接口

先访问[新版官方入口](https://dev.marginnote.com.cn/zh/introduction)，本次工具无法访问，按项目规范回退到 mndocs。重新阅读[JavaScriptCore 运行时](https://mn-docs.museday.top/reference/js-runtime/)与[全局入口](https://mn-docs.museday.top/reference/global/global-variables/)，并核对以下接口：

- [UITapGestureRecognizer](https://mn-docs.museday.top/reference/uikit/uitap-gesture-recognizer/) 的 `numberOfTapsRequired` 用于双击；[UIGestureRecognizer](https://mn-docs.museday.top/reference/uikit/uigesture-recognizer/) 的 `requireGestureRecognizerToFail` 令双击等待拖动失败。手势仅绑定标题栏空白区域；创建双击前检查类是否存在。
- [UIScrollView](https://mn-docs.museday.top/reference/uikit/uiscrollview/) 的 `contentOffset`、`contentSize` 配合独立固定导航区域，保存各设置分类的面板内滚动状态，并在切换或缩放后夹紧偏移。不新增业务持久化数据。
- [CALayer](https://mn-docs.museday.top/reference/quartzcore/calayer/) 的 `presentationLayer`、`addAnimationForKey` 和 `removeAnimationForKey` 用于连续切换及按键清理动画；[CABasicAnimation](https://mn-docs.museday.top/reference/quartzcore/cabasic-animation/) 沿用父类 [CAPropertyAnimation](https://mn-docs.museday.top/reference/quartzcore/caproperty-animation/) 的 `animationWithKeyPath`、`fromValue`、`toValue` 和 `timingFunction`。
- [CAMediaTimingFunction](https://mn-docs.museday.top/reference/quartzcore/camedia-timing-function/) 的 `functionWithControlPoints` 与 [CATransaction](https://mn-docs.museday.top/reference/quartzcore/catransaction/) 的事务及动画时长接口，沿用大观园的缓出曲线。相关类和方法逐项检查，缺失或动画调用失败时直接显示最终布局。

这些原生 UI 接口能够满足本次需求，无需新增 MN Utils 封装或依赖。自动化检查与浏览器布局预览不代表已完成 MarginNote 真机验证。

### 2026-10-21：参考大观园放开窗口拖动边界

访问新版官方入口失败后，通过 mndocs 读取 UIView 和 UIPanGestureRecognizer 全文，重新阅读 JavaScriptCore 运行时与全局入口。UIView.frame 和手势 translationInView / setTranslationInView 足够实现本次调整，无需增加 MN Utils 封装或宿主 API。参考大观园 WebPanelController 的移动与缩放策略：移动直接累加坐标，缩放仅从安全尺寸计算中取宽高，保留原左上角。当前插件继续使用已有 frame 接口，而非引入新的视图属性；结束手势时仍通过已有原生偏好封装保存 JSON 字符串。打开及双击重置继续校验位置和尺寸，默认 980 × 680。

### 2026-10-22：网站紧凑顶部导航

核对网站当前部署脚本 `/assets/index-Cr7Ih_Sw.js` 与样式 `/assets/index-GWKYkdQh.css`：顶部包含 brand、topbar-search-slot、topbar-notices、topbar-actions；原搜索由 React 管理，通知轮播包含售后群和首页赞助信息。本次只在 Web 源码新增 BBKaoyanHeader，沿用原搜索节点、提交事件和导航菜单，不新增搜索 API 或 MN 原生接口。只按明确群信息标记隐藏通知，保留赞助信息；监听页面异步插入与 React 重建恢复按钮，属性仅在变化时写入以避免重复观察循环。
