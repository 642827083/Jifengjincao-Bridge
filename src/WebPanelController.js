var __JFJC_PANEL__ = (function () {
  const N = __JFJC_NATIVE__, T = __JFJC_TRANSPORT__, START_URL = 'https://bbkaoyan.cn/past-papers?subject=math1', BAR_HEIGHT = __JFJC_PANEL_NAVIGATION__.height;
  function study(controller) { return Application.sharedInstance().studyController(controller.addon.window); }
  function safeFrame(frame, bounds) {
    const margin = 8, width = Math.max(0, Math.min(Math.max(360, Number(frame && frame.width) || 980), bounds.width - margin * 2));
    const height = Math.max(0, Math.min(Math.max(340, Number(frame && frame.height) || 680), bounds.height - margin * 2));
    return { x: Math.max(margin, Math.min(Number(frame && frame.x) || (bounds.width - width) / 2, bounds.width - width - margin)),
      y: Math.max(margin, Math.min(Number(frame && frame.y) || (bounds.height - height) / 2, bounds.height - height - margin)), width: width, height: height };
  }
  function saveFrame(controller) { N.savePreference('frame', JSON.stringify(controller.view.frame)); }
  function toolbarFrames(width) { return __JFJC_PANEL_NAVIGATION__.frames(width); }
  function setPage(controller, page) {
    if (['math', 'import', 'settings'].indexOf(page) < 0) return false;
    if (page !== controller.activePage && (controller.previewing || controller.panelOperation === 'importQuestions' || (controller.session && controller.session.running))) {
      N.show(controller.addon, '请先停止或等待当前导入任务，再切换页面'); return false;
    }
    if (page !== controller.activePage && controller.activePage === 'import') {
      __JFJC_WEB_COMMANDS__.cancelRead(controller);
      if (controller.importWebView) controller.importWebView.evaluateJavaScript('window.__JFJC_IMPORT_PAGE__&&window.__JFJC_IMPORT_PAGE__.deactivate()', function () {});
    }
    if (page !== 'math' && controller.activePage === 'math') {
      T.cancel(controller);
      T.optional(controller, 'window.__JFJC_PAGE__&&window.__JFJC_PAGE__.dismiss()').catch(function () {});
    }
    const changed = page !== controller.activePage;
    if (changed) { __JFJC_CARD_LOCATOR_UI__.cancelMode(controller); __JFJC_SETTINGS__.cancelFold(controller); __JFJC_SETTINGS_NAVIGATION__.stop(controller); }
    controller.activePage = page;
    controller.webView.hidden = page !== 'math';
    if (controller.importWebView) controller.importWebView.hidden = page !== 'import';
    if (controller.settingsPage) controller.settingsPage.hidden = page !== 'settings';
    if (page === 'settings') __JFJC_SETTINGS__.refresh(controller);
    if (page === 'math') syncAiTools(controller).catch(function () {});
    if (page === 'import') {
      if (!controller.importWebView) setupImportPage(controller);
      else controller.importWebView.evaluateJavaScript('window.__JFJC_IMPORT_PAGE__&&window.__JFJC_IMPORT_PAGE__.activate()', function () {});
    }
    __JFJC_PANEL_NAVIGATION__.refresh(controller, changed);
    if (controller.settingsHeader) __JFJC_SETTINGS_NAVIGATION__.layout(controller, controller.webView.frame);
    return true;
  }
  function tabButton(title, controller, selector) {
    const button = new UIButton({ x: 0, y: 0, width: 82, height: BAR_HEIGHT });
    button.setTitleForState(title, 0); button.titleLabel.font = UIFont.boldSystemFontOfSize(14);
    button.backgroundColor = UIColor.colorWithWhiteAlpha(1, 0); button.addTargetActionForControlEvents(controller, selector, 1 << 6);
    return button;
  }
  function setupImportPage(controller) {
    const web = new UIWebView(controller.webView.frame);
    if (typeof web.loadHTMLStringBaseURL !== 'function') throw new Error('当前 MN 版本缺少导入页面加载接口');
    web.delegate = controller; web.scalesPageToFit = false;
    controller.importWebView = web; controller.view.addSubview(web);
    web.loadHTMLStringBaseURL(__JFJC_IMPORT_HTML__, null);
    controller.view.addSubview(controller.resizeHandle);
  }
  function layout(controller) {
    if (!controller.titleBar || !controller.resizeHandle || controller.panelReady === false || controller.panelInitializing || controller.panelLayingOut) return;
    controller.panelLayingOut = true;
    try { layoutReady(controller); } finally { controller.panelLayingOut = false; }
  }
  function layoutReady(controller) {
    const b = controller.view.bounds;
    controller.titleBar.frame = { x: 0, y: 0, width: b.width, height: BAR_HEIGHT };
    __JFJC_PANEL_NAVIGATION__.layout(controller);
    controller.titleSeparator.frame = { x: 0, y: BAR_HEIGHT - 0.5, width: b.width, height: 0.5 };
    const content = { x: 0, y: BAR_HEIGHT, width: b.width, height: Math.max(0, b.height - BAR_HEIGHT) };
    controller.webView.frame = content; __JFJC_SETTINGS__.layout(controller, content);
    if (controller.importWebView) controller.importWebView.frame = content;
    controller.resizeHandle.frame = { x: b.width - 26, y: b.height - 26, width: 26, height: 26 };
    __JFJC_CARD_LOCATOR_UI__.layout(controller);
  }
  function setup(controller) {
    if (controller.panelReady || controller.panelInitializing) return;
    // 原生控件构造也可能同步触发布局，完整建立面板后才允许布局。
    controller.panelInitializing = true; controller.panelReady = false;
    try { build(controller); controller.panelReady = true; }
    finally { controller.panelInitializing = false; }
    layout(controller); load(controller, START_URL);
  }
  function build(controller) {
    if (controller.view && controller.view.superview) controller.view.removeFromSuperview();
    controller.settingsReady = false; controller.settingsHeader = null;
    controller.view = new UIView({ x: 0, y: 0, width: 980, height: 680 });
    controller.view.backgroundColor = UIColor.whiteColor(); controller.view.layer.cornerRadius = 8;
    controller.view.layer.borderWidth = 0.5; controller.view.layer.borderColor = UIColor.lightGrayColor(); controller.view.layer.masksToBounds = true;
    controller.titleBar = new UIView({ x: 0, y: 0, width: 980, height: BAR_HEIGHT });
    controller.titleBar.backgroundColor = UIColor.colorWithWhiteAlpha(0.985, 1); controller.view.addSubview(controller.titleBar);
    controller.mathButton = tabButton('数学', controller, 'openMath:');
    controller.importButton = tabButton('导入', controller, 'openImport:');
    controller.settingsButton = tabButton('设置', controller, 'openSettings:');
    controller.closeButton = new UIButton({ x: 936, y: 0, width: 44, height: BAR_HEIGHT });
    controller.closeButton.setTitleForState('×', 0); controller.closeButton.setTitleColorForState(UIColor.colorWithWhiteAlpha(0.4, 1), 0);
    controller.closeButton.backgroundColor = UIColor.colorWithWhiteAlpha(1, 0); controller.closeButton.titleLabel.font = UIFont.systemFontOfSize(20);
    controller.closeButton.addTargetActionForControlEvents(controller, 'closePanel:', 1 << 6);
    __JFJC_PANEL_NAVIGATION__.setup(controller);
    controller.titleSeparator = new UIView({ x: 0, y: BAR_HEIGHT - 0.5, width: 980, height: 0.5 });
    controller.titleSeparator.backgroundColor = UIColor.colorWithWhiteAlpha(0.91, 1); controller.titleBar.addSubview(controller.titleSeparator);
    controller.webView = new UIWebView({ x: 0, y: BAR_HEIGHT, width: 980, height: 680 - BAR_HEIGHT });
    controller.webView.delegate = controller; controller.webView.scalesPageToFit = true; controller.view.addSubview(controller.webView);
    __JFJC_SETTINGS__.setup(controller); __JFJC_SETTINGS_NAVIGATION__.setup(controller); controller.activePage = 'math';
    controller.resizeHandle = new UILabel({ x: 894, y: 654, width: 26, height: 26 }); controller.resizeHandle.text = '◢';
    controller.resizeHandle.textColor = UIColor.grayColor(); controller.resizeHandle.userInteractionEnabled = true;
    controller.resizeHandle.addGestureRecognizer(new UIPanGestureRecognizer(controller, 'resizePanel:')); controller.view.addSubview(controller.resizeHandle);
  }
  async function inject(controller) {
    await T.waitReady(controller);
    const result = await T.evaluate(controller, '(function(){' + __JFJC_PAGE_SCRIPT__ + ';window.__JFJC_QUESTION_TOOLS__.configure({enabled:' + __JFJC_SETTINGS__.showLocateCard() + ',importEnabled:' + __JFJC_SETTINGS__.showSingleImport() + '});window.__JFJC_REVIEW__&&window.__JFJC_REVIEW__.configure({enabled:' + __JFJC_SETTINGS__.showUpload() + ',source:' + JSON.stringify(__JFJC_SETTINGS__.uploadSource()) + ',attachFirst:' + __JFJC_SETTINGS__.attachFirstContent() + ',hasPrompt:' + Boolean(__JFJC_SETTINGS__.uploadExtraText()) + '});return "injected";})()');
    return result;
  }
  function syncQuestionTools(controller) {
    return T.optional(controller, 'window.__JFJC_QUESTION_TOOLS__&&window.__JFJC_QUESTION_TOOLS__.configure({enabled:' + __JFJC_SETTINGS__.showLocateCard() + ',importEnabled:' + __JFJC_SETTINGS__.showSingleImport() + '})');
  }
  function syncAiTools(controller) {
    return T.optional(controller, 'window.__JFJC_REVIEW__&&window.__JFJC_REVIEW__.configure({enabled:' + __JFJC_SETTINGS__.showUpload() + ',source:' + JSON.stringify(__JFJC_SETTINGS__.uploadSource()) + ',attachFirst:' + __JFJC_SETTINGS__.attachFirstContent() + ',hasPrompt:' + Boolean(__JFJC_SETTINGS__.uploadExtraText()) + '})');
  }
  async function singleImport(controller, token, target) {
    let session;
    try {
      if (!__JFJC_SETTINGS__.showSingleImport() || controller.visible === false || controller.activePage && controller.activePage !== 'math') throw new Error('导入本题未启用');
      if (controller.cardLocationRequest || controller.previewing || controller.panelOperation || controller.uploadOperation || controller.session && controller.session.running) throw new Error('请先完成当前任务，再导入本题');
      const context = N.context(controller.addon);
      // 在任何异步读取前固定所选卡片，读取期间的选中变化不改变落点。
      const destination = __JFJC_SINGLE_IMPORT__.capture(controller.addon, context, __JFJC_SETTINGS__.singleImportPosition());
      controller.previewing = true;
      session = { token: token, context: context, destination: destination, cancelled: false, running: false, includeTopics: __JFJC_SETTINGS__.importTopics() };
      controller.session = session;
      await T.take(controller, session, 'window.__JFJC_PAGE__.direct(' + JSON.stringify(token) + ',' + JSON.stringify(target) + ')');
      await __JFJC_IMPORT__.run(controller, session);
    } catch (error) { N.show(controller.addon, String(error.message || error)); }
    finally {
      // 只清理本次会话，避免晚到的回调结束后续操作。
      if (session && controller.session === session) {
        await T.optional(controller, 'window.__JFJC_PAGE__&&window.__JFJC_PAGE__.dismiss()').catch(function () {});
        controller.session = null; controller.previewing = false;
      }
      await T.optional(controller, 'window.__JFJC_QUESTION_TOOLS__&&window.__JFJC_QUESTION_TOOLS__.finishSingle(' + JSON.stringify(token) + ')').catch(function () {});
    }
  }
  async function locateCard(controller, token, target) {
    if (!__JFJC_SETTINGS__.showLocateCard() || controller.visible === false || controller.activePage && controller.activePage !== 'math') return;
    if (controller.cardLocationRequest || controller.previewing || controller.panelOperation || controller.uploadOperation || controller.session && controller.session.running) {
      N.show(controller.addon, '请先完成当前任务，再定位卡片');
      T.evaluate(controller, 'window.__JFJC_QUESTION_TOOLS__&&window.__JFJC_QUESTION_TOOLS__.finish(' + JSON.stringify(token) + ')').catch(function () {}); return;
    }
    const request = { token: token, target: target }; controller.cardLocationRequest = request;
    async function validate() {
      if (controller.cardLocationRequest !== request || controller.visible === false || controller.activePage && controller.activePage !== 'math' || !__JFJC_SETTINGS__.showLocateCard()) throw new Error('已取消定位');
      // 在网页端固定返回文字，避免 true 被宿主桥接成 NSNumber 或字符串 "1"。
      const valid = await T.evaluate(controller, '(function(){return (window.__JFJC_QUESTION_TOOLS__&&window.__JFJC_QUESTION_TOOLS__.matches(' + JSON.stringify(target) + '))?"accepted":"rejected";})()');
      if (controller.cardLocationRequest !== request) throw new Error('已取消定位');
      if (String(valid) !== 'accepted') throw new Error('当前网页或题目已切换，请重新点击定位卡片');
    }
    let located = false, current = false;
    try {
      await validate();
      await __JFJC_CARD_LOCATOR__.locate(controller.addon, target, validate); located = true;
    } catch (error) { N.show(controller.addon, String(error.message || error)); }
    finally {
      await T.evaluate(controller, 'window.__JFJC_QUESTION_TOOLS__&&window.__JFJC_QUESTION_TOOLS__.finish(' + JSON.stringify(token) + ')').catch(function () {});
      current = controller.cardLocationRequest === request;
      if (current) controller.cardLocationRequest = null;
    }
    if (located && current && controller.visible !== false && (!controller.activePage || controller.activePage === 'math')) { hide(controller); N.show(controller.addon, '已定位脑图卡片'); }
  }
  function load(controller, url) {
    T.cancel(controller);
    controller.pageLoadEpoch = (controller.pageLoadEpoch || 0) + 1;
    controller.webView.loadRequest(NSURLRequest.requestWithURL(NSURL.URLWithString(url)));
  }
  async function preview(controller, scope) {
    if (controller.activePage && controller.activePage !== 'math') return;
    if (controller.previewing) return;
    controller.previewing = true;
    try {
      if (['single', 'selected', 'all'].indexOf(scope) < 0) throw new Error('导入入口无效');
      if (controller.cardLocationRequest) throw new Error('请先完成当前卡片定位');
      if (controller.uploadOperation || controller.panelOperation) throw new Error('请先完成当前任务，再打开选题导入');
      if (controller.session && controller.session.running) throw new Error('请先停止或等待当前导入任务');
      const context = N.context(controller.addon);
      await inject(controller);
      const page = JSON.parse(String(await T.evaluate(controller, 'JSON.stringify(window.__JFJC_PAGE__.context())')));
      if (!page) throw new Error('请打开试卷、题目详情、AI 找题结果或题篮');
      const token = 'jfjc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      controller.session = { token: token, context: context, cancelled: false, running: false,
        includeTopics: __JFJC_SETTINGS__.importTopics(), aiSearch: Boolean(page.search), basket: Boolean(page.basket) };
      const options = { token: token, target: context.title, content: N.preference('content', 'questionAnswer') };
      await T.evaluate(controller, '(function(){window.__JFJC_PAGE__.open(' + JSON.stringify(scope) + ',' + JSON.stringify(options) + ').catch(function(e){console.log(e.message);});return "opening";})()');
    } catch (error) { N.show(controller.addon, String(error.message || error)); }
    finally { controller.previewing = false; }
  }
  function requestAddress(request) {
    const url = N.value(request, 'URL'); return String(N.value(url, 'absoluteString') || '');
  }
  function command(controller, address) {
    const match = /^jifengjincaobridge:\/\/(preview|import|cancel|upload-content|locate-card|cancel-locate|single-import|cancel-single)\?token=([^&]*)&scope=([^&]*)$/.exec(address);
    if (!match) return false;
    let token, scope;
    try { token = decodeURIComponent(match[2]); scope = decodeURIComponent(match[3]); } catch (error) { return false; }
    if (match[1] === 'cancel-locate') {
      if (scope || !controller.cardLocationRequest || controller.cardLocationRequest.token !== token) return false;
      __JFJC_CARD_LOCATOR__.cancel(controller.addon); controller.cardLocationRequest = null; return true;
    }
    if (match[1] === 'cancel-single') {
      if (scope || !controller.session || controller.session.token !== token || !controller.session.destination) return false;
      T.cancel(controller); return true;
    }
    if ((controller.visible === false || controller.activePage && controller.activePage !== 'math') && match[1] !== 'cancel') return false;
    if (match[1] === 'locate-card' || match[1] === 'single-import') {
      const single = match[1] === 'single-import';
      if (!(single ? /^jfjc-single-[a-z0-9-]{1,80}$/ : /^jfjc-locate-[a-z0-9-]{1,80}$/).test(token) || scope.length > 2048) return false;
      let target; try { target = JSON.parse(scope); } catch (error) { return false; }
      if (!target || !Number.isSafeInteger(target.paperId) || target.paperId < 0 || !Number.isSafeInteger(target.questionId) || target.questionId < 1 || typeof target.route !== 'string' || !target.route.startsWith('/') || target.route.length > 1024) return false;
      if (target.snapshot !== undefined && (typeof target.snapshot !== 'string' || !/^(?:search|basket|review)-[1-9]\d{0,12}$/.test(target.snapshot))) return false;
      target = { paperId: target.paperId, questionId: target.questionId, route: target.route, snapshot: target.snapshot };
      if (single) singleImport(controller, token, target); else locateCard(controller, token, target); return true;
    }
    if (match[1] === 'upload-content') {
      if (token || !/^composer-[1-9]\d{0,8}$/.test(scope)) return false;
      if (!__JFJC_SETTINGS__.showUpload()) return true;
      if (controller.cardLocationRequest) { N.show(controller.addon, '请先完成当前卡片定位'); return true; }
      if (controller.previewing || controller.panelOperation || controller.session && controller.session.running) { N.show(controller.addon, '请先完成当前导入，再上传'); return true; }
      __JFJC_UPLOAD__.start(controller, scope).catch(function (error) { N.show(controller.addon, String(error.message || error)); }); return true;
    }
    if (match[1] === 'preview') { preview(controller, scope); return true; }
    const session = controller.session;
    if (!session || !token || token !== session.token) return false;
    if (match[1] === 'cancel') { T.cancel(controller); return true; }
    if (session.destination) return false;
    if (controller.cardLocationRequest) { N.show(controller.addon, '请先完成当前卡片定位'); return true; }
    if (!session.running) { session.cancelled = false; __JFJC_IMPORT__.run(controller, session).catch(function (error) { N.show(controller.addon, error.message || error); }); }
    return true;
  }
  function show(controller) {
    if (controller.titleBar && (!controller.resizeHandle || !controller.settingsReady)) controller.panelReady = false;
    if (controller.panelReady === false && !controller.panelInitializing) setup(controller);
    const parent = study(controller); if (!parent || !parent.view) throw new Error('当前学习窗口不可用');
    if (!controller.view.superview) parent.view.addSubview(controller.view);
    let frame = {}; try { frame = JSON.parse(String(N.preference('frame', '{}'))); } catch (error) {}
    controller.view.frame = safeFrame(frame, parent.view.bounds); controller.view.hidden = false; layout(controller);
    if (controller.activePage === 'settings') __JFJC_SETTINGS__.refresh(controller);
    controller.visible = true; N.savePreference('visible', true); parent.refreshAddonCommands();
    syncQuestionTools(controller).catch(function () {});
    syncAiTools(controller).catch(function () {});
  }
  function openSource(controller, target) {
    show(controller);
    if (!setPage(controller, 'math')) return;
    load(controller, target.url);
  }
  function hide(controller) {
    __JFJC_PANEL_NAVIGATION__.stop(controller); __JFJC_SETTINGS_NAVIGATION__.stop(controller);
    __JFJC_SETTINGS__.cancelFold(controller);
    controller.pageLoadEpoch = (controller.pageLoadEpoch || 0) + 1;
    __JFJC_WEB_COMMANDS__.cancelRead(controller);
    T.cancel(controller); controller.visible = false; controller.view.hidden = true; controller.view.removeFromSuperview();
    N.savePreference('visible', false); const parent = study(controller); if (parent) parent.refreshAddonCommands();
  }
  const panelClass = JSB.defineClass('JifengjincaoBridgePanelController : UIViewController <UIWebViewDelegate>', {
    viewDidLoad: function () { setup(self); },
    viewDidLayoutSubviews: function () { layout(self); },
    closePanel: function () { hide(self); },
    openMath: function () { setPage(self, 'math'); },
    openImport: function () { try { setPage(self, 'import'); } catch (error) { N.show(self.addon, String(error.message || error)); setPage(self, 'math'); } },
    openSettings: function () { setPage(self, 'settings'); },
    selectSettingsSection: function (sender) { __JFJC_SETTINGS_NAVIGATION__.select(self, sender); },
    resetPanelOnDoubleTap: function (recognizer) {
      const controller = self, parent = controller.view.superview;
      if (!parent || !recognizer || recognizer.state !== 3) return;
      controller.view.frame = safeFrame(null, parent.bounds); layout(controller); saveFrame(controller);
    },
    toggleImportTopics: function (sender) { __JFJC_SETTINGS__.toggle(self, sender); },
    toggleShowLocateCard: function (sender) { __JFJC_SETTINGS__.toggleLocate(self, sender); },
    toggleShowSingleImport: function (sender) { __JFJC_SETTINGS__.toggleSingle(self, sender); },
    toggleShowUpload: function (sender) { __JFJC_SETTINGS__.toggleUpload(self, sender); },
    toggleAttachFirstContent: function (sender) { __JFJC_SETTINGS__.toggleAttachFirstContent(self, sender); },
    toggleExtraText: function (sender) { __JFJC_SETTINGS__.toggleExtraText(self, sender); },
    saveExtraText: function () { __JFJC_SETTINGS__.saveExtraText(self); },
    chooseUploadSource: function () { try { __JFJC_SETTINGS__.chooseUploadSource(self); } catch (error) { N.show(self.addon, String(error.message || error)); } },
    selectUploadSource: function (sender) { __JFJC_CARD_LOCATOR_UI__.selectMode(self, Number(N.value(sender, 'tag')), sender); },
    toggleSourceCommentFold: function (sender) { __JFJC_SETTINGS__.toggleFold(self, sender); },
    chooseSourceCommentDisplay: function () { try { __JFJC_SETTINGS__.chooseSourceDisplay(self); } catch (error) { N.show(self.addon, String(error.message || error)); } },
    selectSourceCommentDisplay: function (sender) { __JFJC_CARD_LOCATOR_UI__.selectMode(self, Number(N.value(sender, 'tag')), sender); },
    repairImportedCards: function () { __JFJC_SETTINGS__.repairCards(self); },
    chooseSingleImportPosition: function () { try { __JFJC_SETTINGS__.choosePosition(self); } catch (error) { N.show(self.addon, String(error.message || error)); } },
    selectSingleImportPosition: function (sender) { __JFJC_CARD_LOCATOR_UI__.selectMode(self, Number(N.value(sender, 'tag')), sender); },
    chooseCardLocationMode: function () { try { __JFJC_SETTINGS__.chooseMode(self); } catch (error) { N.show(self.addon, String(error.message || error)); } },
    selectCardLocationMode: function (sender) { __JFJC_CARD_LOCATOR_UI__.selectMode(self, Number(N.value(sender, 'tag')), sender); },
    selectCardLocationChoice: function (sender) { __JFJC_CARD_LOCATOR_UI__.select(self, Number(N.value(sender, 'tag')), sender); },
    cancelCardLocationChoice: function () { __JFJC_CARD_LOCATOR_UI__.cancel(self); },
    movePanel: function (recognizer) {
      const controller = self, parent = controller.view.superview; if (!parent) return;
      const translation = recognizer.translationInView(parent), frame = controller.view.frame;
      // 与大观园一致，拖动允许移出屏幕，重新打开或双击时再恢复可见位置。
      controller.view.frame = { x: frame.x + translation.x, y: frame.y + translation.y, width: frame.width, height: frame.height };
      recognizer.setTranslationInView({ x: 0, y: 0 }, parent); if (recognizer.state === 3) saveFrame(controller);
    },
    resizePanel: function (recognizer) {
      const controller = self, parent = controller.view.superview; if (!parent) return;
      const translation = recognizer.translationInView(parent), frame = controller.view.frame;
      const size = safeFrame({ x: frame.x, y: frame.y, width: frame.width + translation.x, height: frame.height + translation.y }, parent.bounds);
      // 仅限制尺寸，不改变用户已放置的左上角，包括屏幕外的位置。
      controller.view.frame = { x: frame.x, y: frame.y, width: size.width, height: size.height };
      layout(controller); recognizer.setTranslationInView({ x: 0, y: 0 }, parent); if (recognizer.state === 3) saveFrame(controller);
    },
    webViewShouldStartLoadWithRequestNavigationType: function (webView, request, type) {
      if (webView === self.extraTextEditor) {
        const address = requestAddress(request);
        if (/^mnaddon:/i.test(address)) { __JFJC_WEB_COMMANDS__.handle(self, address, webView); return false; }
        return address === 'about:blank';
      }
      if (webView === self.importWebView) {
        const localAddress = requestAddress(request);
        if (/^mnaddon:/i.test(localAddress)) { __JFJC_WEB_COMMANDS__.handle(self, localAddress); return false; }
        return localAddress === 'about:blank';
      }
      if (webView !== self.webView) return false;
      const address = requestAddress(request);
      if (/^jifengjincaobridge:/i.test(address)) { command(self, address); return false; }
      // 主页面导航取消当前任务；子资源和桥接 iframe 不改变导入落点。
      const main = N.value(request, 'mainDocumentURL');
      if ((self.session || self.uploadOperation || self.cardLocationRequest) && main && String(N.value(main, 'absoluteString') || '') === address) T.cancel(self);
      return /^(https?:|about:)/i.test(address);
    },
    webViewDidFinishLoad: function (webView) {
      const controller = self; if (webView !== controller.webView) return;
      inject(controller).catch(function (error) { console.log('[Jifengjincao Bridge] 网页连接失败：' + String(error.message || error)); });
    },
    webViewDidFailLoadWithError: function (webView, error) {
      if (webView === self.extraTextEditor) {
        self.extraTextWebReady = false; self.extraTextSaveButton.enabled = false;
        self.extraTextHint.text = '文字输入框加载失败，请重新打开面板';
      }
      if (webView === self.webView) console.log('[Jifengjincao Bridge] 页面加载：' + String(N.value(error, 'localizedDescription') || error));
    }
  });
  function create(addon) { const controller = panelClass.new(); controller.addon = addon; return controller; }
  return { create: create, show: show, hide: hide, openSource: openSource, preview: preview, command: command, safeFrame: safeFrame, toolbarFrames: toolbarFrames, setPage: setPage, syncQuestionTools: syncQuestionTools, syncAiTools: syncAiTools, locateCard: locateCard, singleImport: singleImport };
})();
