import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { nativeHost, source, tick } from './helpers.mjs';
import { extraTextPageHTML } from '../scripts/web-bundle.mjs';

test('题卡工具的折叠开关独立保存，管理菜单可取消且只列折叠与展开', async () => {
  const h = mountedPanel(), c = h.controller;
  assert.equal(c.importSettingsTitle.text, '题卡工具');
  assert.equal(c.sourceFoldTitle.text, '自动折叠原题评论'); assert.equal(c.sourceFoldSwitch.on, false);
  assert.equal(c.sourceCommentTitle.text, '已导入题卡管理');
  c.sourceFoldSwitch.on = true; h.methods.toggleSourceCommentFold(c.sourceFoldSwitch);
  const reopened = { addon: c.addon }; h.context.self = reopened; h.methods.viewDidLoad();
  assert.equal(reopened.sourceFoldSwitch.on, true); assert.equal(reopened.importTopicsSwitch.on, true);
  h.context.self = c; h.methods.openSettings();
  const calls = []; h.context.__JFJC_COMMENT_FOLD__.batch = async (addon, collapsed) => { calls.push(collapsed); return { changed: 0, unchanged: 0, skipped: 0, failed: [] }; };
  h.methods.chooseSourceCommentDisplay();
  assert.deepEqual(Array.from(c.cardLocationModeChoice.buttons, b => b.title), ['折叠原题评论', '展开原题评论', '取消']);
  h.methods.selectSourceCommentDisplay(c.cardLocationModeChoice.buttons[2]); await tick(); assert.deepEqual(calls, []);
  for (const [index, expected] of [[0, true], [1, false]]) {
    h.methods.chooseSourceCommentDisplay(); h.methods.selectSourceCommentDisplay(c.cardLocationModeChoice.buttons[index]);
    await tick(); assert.equal(calls.at(-1), expected); assert.equal(c.commentFoldOperation, null);
  }
  assert.equal(h.context.__JFJC_COMMENT_FOLD__.enabled(), true);
});

test('折叠任务禁止重复启动，离开设置及关闭面板后取消过期进度和提示', async () => {
  for (const action of ['page', 'hide']) {
    const h = mountedPanel(), c = h.controller; h.methods.openSettings();
    const app = h.context.Application.sharedInstance();
    const study = app.studyController(c.addon.window); study.refreshAddonCommands = () => {};
    app.studyController = () => study; h.context.Application.sharedInstance = () => app;
    let finish, active, progress;
    h.context.__JFJC_COMMENT_FOLD__.batch = (addon, collapsed, onProgress, isActive) => {
      active = isActive; progress = onProgress; return new Promise(resolve => { finish = resolve; });
    };
    const task = h.context.__JFJC_SETTINGS__.foldExisting(c, true);
    assert.equal(c.sourceFoldSwitch.enabled, false); assert.equal(c.sourceCommentButton.enabled, false); assert.equal(active(), true);
    const operation = c.commentFoldOperation; await h.context.__JFJC_SETTINGS__.foldExisting(c, false); assert.equal(c.commentFoldOperation, operation);
    if (action === 'page') h.methods.openMath(); else h.methods.closePanel();
    assert.equal(active(), false); const description = c.sourceCommentDescription.text;
    progress({ processed: 10, total: 20 }); assert.equal(c.sourceCommentDescription.text, description);
    const hudCount = h.hud.length; finish({ changed: 10, unchanged: 0, skipped: 0, failed: [], interrupted: '已停止' });
    await task; assert.equal(h.hud.length, hudCount); assert.equal(c.commentFoldOperation, null);
  }
});

test('折叠设置行在窄窗口可滚动且不重叠，导入期间管理入口拒绝执行', async () => {
  const h = mountedPanel(), c = h.controller; h.methods.openSettings();
  h.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
  for (const width of [304, 390, 599, 600, 920]) {
    c.view.frame = { x: 0, y: 0, width, height: 400 }; h.methods.viewDidLayoutSubviews();
    const card = c.importSettingsSection.frame, desc = c.sourceFoldDescription.frame, toggle = c.sourceFoldSwitch.frame;
    assert.ok(desc.x + desc.width + 12 <= toggle.x || desc.y + desc.height + 2 <= toggle.y);
    assert.ok(toggle.x + toggle.width <= card.width);
    assert.ok(toggle.y + toggle.height < c.sourceCommentButton.frame.y);
    assert.ok(c.sourceCommentButton.frame.y + c.sourceCommentButton.frame.height <= card.height);
    assert.ok(card.y + card.height + 18 <= c.settingsPage.contentSize.height);
  }
  c.session = { running: true };
  h.methods.chooseSourceCommentDisplay(); assert.equal(c.cardLocationModeChoice, undefined);
  await h.context.__JFJC_SETTINGS__.foldExisting(c, true); assert.ok(!c.commentFoldOperation); assert.match(h.hud.at(-1), /请先完成/);
});

function panel() {
  const h=nativeHost();const classes={};h.context.JSB={defineClass(name,methods){classes[name]=methods;return{new(){return{};}}}};
  vm.runInContext(source('src/WebPanelController.js'),h.context);
  return {...h,panel:h.context.__JFJC_PANEL__,methods:classes['JifengjincaoBridgePanelController : UIViewController <UIWebViewDelegate>']};
}
function mountedPanel(options = {}) {
  const h = panel();
  class View {
    constructor(frame) {
      this.frame = frame; this.subviews = []; this.gestures = []; this.hidden = false;
      this.layer = { animations: new Map(),
        addAnimationForKey(animation, key) { this.animations.set(key, animation); },
        removeAnimationForKey(key) { this.animations.delete(key); },
        presentationLayer() { return this.presentation; } };
    }
    get frame() { return this.currentFrame; }
    set frame(frame) { this.currentFrame = frame; if (options.onFrameChange) options.onFrameChange(h, this); }
    get bounds() { return { x: 0, y: 0, width: this.frame.width, height: this.frame.height }; }
    addSubview(view) { this.subviews.push(view); view.superview = this; }
    removeFromSuperview() { if (this.superview) this.superview.subviews = this.superview.subviews.filter(view => view !== this); this.superview = null; }
    addGestureRecognizer(gesture) { this.gestures.push(gesture); gesture.view = this; }
  }
  class Button extends View {
    constructor(frame) { super(frame); this.titleLabel = {}; }
    setTitleForState(title) { this.title = title; }
    setTitleColorForState(color) { this.color = color; }
    addTargetActionForControlEvents(target, action, event) { Object.assign(this, { target, action, event }); }
  }
  class WebView extends View {
    constructor(frame) { super(frame); this.requests = []; this.scripts = []; }
    loadRequest(request) { this.requests.push(request); }
    loadHTMLStringBaseURL(html, base) {
      this.html = html; this.base = base;
      if (html.includes('id="extra-text"')) {
        if (options.onExtraEditorCreate) options.onExtraEditorCreate(h);
        const parsed = parseHTML(html), owner = h.context.self, web = this;
        this.editorDocument = parsed.document;
        this.editorEvent = parsed.window.Event;
        this.editorDocument.querySelector('textarea').blur = () => { this.blurred = true; };
        const window = options.editorIframeBridge ? { setTimeout, clearTimeout } : { mn: { call(command, payload) { return h.context.__JFJC_WEB_COMMANDS__.dispatch(owner, command, payload, web); } } };
        if (options.editorIframeBridge) {
          this.bridgeAddresses = [];
          const append = parsed.document.body.appendChild.bind(parsed.document.body);
          parsed.document.body.appendChild = node => {
            const result = append(node);
            if (node.tagName === 'IFRAME') {
              this.bridgeAddresses.push(node.src);
              h.methods.webViewShouldStartLoadWithRequestNavigationType(web, { URL: { absoluteString: node.src } }, 0);
            }
            return result;
          };
        }
        this.editorContext = vm.createContext({ window, document: parsed.document });
        vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1], this.editorContext);
      }
    }
    evaluateJavaScript(code, callback) {
      this.scripts.push(code);
      if (this.editorContext) {
        try { callback(vm.runInContext(code, this.editorContext), null); } catch (error) { callback(null, error); }
        return;
      }
      if (code.includes('__JFJC_READINESS__')) return callback(JSON.stringify({ origin: 'https://bbkaoyan.cn', route: '/papers/237', ready: 'complete', content: true }), null);
      callback(code.includes('JSON.stringify(window.__JFJC_PAGE__.context())') ? '{"paperId":237}' : 'injected', null);
    }
  }
  class TextView extends View {
    constructor(frame) {
      super(frame);
      if (options.onTextViewCreate) options.onTextViewCreate(h);
    }
  }
  Object.assign(h.context, {
    UIView: View, UILabel: View, UIScrollView: View, UIButton: Button, UISwitch: Button, UIWebView: WebView, UITextView: TextView,
    UIPanGestureRecognizer: class { constructor(target, action) { Object.assign(this, { target, action }); } },
    UITapGestureRecognizer: class {
      constructor(target, action) { Object.assign(this, { target, action }); }
      requireGestureRecognizerToFail(gesture) { this.failureRequirement = gesture; }
    },
    __JFJC_PAGE_SCRIPT__: '',
    __JFJC_IMPORT_HTML__: '<html>导入页面</html>',
    __JFJC_EXTRA_TEXT_HTML__: extraTextPageHTML(),
    UIFont: { systemFontOfSize: size => ({ size }), boldSystemFontOfSize: size => ({ size, bold: true }) },
    UIColor: { whiteColor: () => 'white', grayColor: () => 'gray', darkGrayColor: () => 'darkgray', lightGrayColor: () => 'lightgray',
      colorWithWhiteAlpha: (white, alpha) => ({ white, alpha }), colorWithRedGreenBlueAlpha: (red, green, blue, alpha) => ({ red, green, blue, alpha }) },
    NSURL: { URLWithString: url => ({ absoluteString: url }) }, NSURLRequest: { requestWithURL: url => ({ URL: url }) }
  });
  const controller = { addon: { window: {} } }; h.context.self = controller; h.methods.viewDidLoad();
  return { ...h, controller };
}
function typeExtra(controller, text) {
  const web = controller.extraTextEditor, input = web.editorDocument.querySelector('textarea');
  input.value = text; input.dispatchEvent(new web.editorEvent('input')); return input;
}
function extraValue(controller) { return controller.extraTextEditor.editorDocument.querySelector('textarea').value; }

test('创建提示词输入框时同步触发布局，不中断设置导航、缩放角和数学页加载', async () => {
  let reentered = false;
  const h = mountedPanel({ onExtraEditorCreate(host) { reentered = true; host.methods.viewDidLayoutSubviews(); } });
  await tick();
  const c = h.controller;
  assert.equal(reentered, true); assert.ok(c.extraTextHint); assert.ok(c.extraTextSaveButton);
  assert.ok(c.extraTextEditor); assert.equal(c.extraTextEditor.editorDocument.querySelector('textarea').disabled, false); assert.equal(c.extraTextSaveButton.enabled, true);
  assert.ok(c.settingsHeader); assert.equal(c.settingsNavigationButtons.length, 3);
  assert.equal(c.resizeHandle.text, '◢'); assert.equal(c.resizeHandle.superview, c.view);
  assert.equal(c.resizeHandle.gestures[0].action, 'resizePanel:');
  assert.equal(c.webView.requests.length, 1); assert.equal(c.activePage, 'math');
  c.view.frame = { x: 0, y: 0, width: 980, height: 680 }; h.methods.viewDidLayoutSubviews();
  assert.equal(c.resizeHandle.frame.x, 954); assert.equal(c.resizeHandle.frame.y, 654);
});

test('原生 frame 赋值再次触发布局时，创建与正常缩放均不会递归或访问半成品控件', () => {
  let callbacks = 0;
  const h = mountedPanel({ onFrameChange(host) {
    if (host.context.self && host.context.self.webView) { callbacks++; host.methods.viewDidLayoutSubviews(); }
  } });
  const c = h.controller; assert.ok(callbacks > 20); assert.ok(c.extraTextEditor);
  assert.equal(c.panelReady, true); assert.equal(c.panelLayingOut, false);
  c.view.frame = { x: 0, y: 0, width: 600, height: 500 };
  h.methods.viewDidLayoutSubviews();
  assert.equal(c.resizeHandle.frame.x, 574); assert.equal(c.resizeHandle.frame.y, 474);
  assert.equal(c.webView.frame.width, 600); assert.equal(c.settingsHeader.frame.width, 600);
});

test('可选文字编辑器创建异常时保留设置胶囊、数学页、关闭、拖动和右下角缩放', () => {
  const h = mountedPanel({ onExtraEditorCreate() { throw new Error('模拟本地编辑页加载失败'); } }), c = h.controller;
  assert.equal(c.panelReady, true); assert.equal(c.settingsReady, true);
  assert.equal(c.extraTextEditor, null); assert.equal(c.extraTextSaveButton.enabled, false);
  assert.match(c.extraTextHint.text, /加载失败/); assert.equal(c.webView.requests.length, 1);
  assert.equal(c.closeButton.action, 'closePanel:'); assert.equal(c.resizeHandle.gestures[0].action, 'resizePanel:');
  h.methods.openSettings(); h.methods.selectSettingsSection(c.settingsNavigationButtons[2]); h.methods.viewDidLayoutSubviews();
  assert.equal(c.aiToolsSection.hidden, false); assert.equal(c.settingsHeader.hidden, false);
  h.methods.openMath(); assert.equal(c.webView.hidden, false);
  const parent = new h.context.UIView({ x: 0, y: 0, width: 1024, height: 800 }); parent.addSubview(c.view);
  h.methods.resizePanel({ state: 2, translationInView: () => ({ x: -100, y: -80 }), setTranslationInView() {} });
  assert.equal(c.view.frame.width, 880); assert.equal(c.view.frame.height, 600);
  assert.equal(c.resizeHandle.frame.x, 854); assert.equal(c.resizeHandle.frame.y, 574);
});

test('UITextView 不可构造时仍提供可编辑的提示词输入框', () => {
  const h = mountedPanel({ onTextViewCreate() { throw new Error('UITextView 不可构造'); } }), c = h.controller;
  assert.ok(c.extraTextEditor);
  assert.equal(typeof c.extraTextEditor.loadHTMLStringBaseURL, 'function');
  assert.match(c.extraTextEditor.html, /textarea/);
  assert.equal(c.panelReady, true); assert.equal(c.resizeHandle.superview, c.view);
});

test('设置初始化中断后的半成品面板再次打开会重建，而非因为存在 webView 就跳过', () => {
  const h = mountedPanel(), c = { addon: h.controller.addon }, settings = h.context.__JFJC_SETTINGS__, setup = settings.setup;
  let fail = true; settings.setup = controller => { setup(controller); if (fail) { fail = false; throw new Error('模拟初始化中断'); } };
  h.context.self = c;
  assert.throws(() => h.methods.viewDidLoad(), /初始化中断/);
  const oldView = c.view; assert.ok(c.webView); assert.equal(c.panelReady, false); assert.equal(c.resizeHandle, undefined);
  const parent = new h.context.UIView({ x: 0, y: 0, width: 1024, height: 800 });
  h.context.Application.sharedInstance = () => ({ studyController: () => ({ view: parent, refreshAddonCommands() {} }) });
  h.panel.show(c);
  assert.notEqual(c.view, oldView); assert.equal(c.view.superview, parent); assert.equal(c.panelReady, true);
  assert.equal(c.settingsNavigationButtons.length, 3); assert.ok(c.extraTextEditor);
  assert.equal(c.resizeHandle.superview, c.view); assert.equal(c.webView.requests.length, 1);
  const rebuilt = c.view;
  delete c.panelReady; c.settingsReady = false; c.resizeHandle = null;
  h.panel.show(c);
  assert.notEqual(c.view, rebuilt); assert.equal(rebuilt.superview, null);
  assert.equal(c.panelReady, true); assert.equal(c.resizeHandle.superview, c.view);
});
test('窗口在手机大小学习窗口内保持可见，保存 frame 只用字符串',()=>{
  const h=panel();const f=h.panel.safeFrame({x:999,y:999,width:920,height:680},{width:390,height:600});
  assert.ok(f.x>=0&&f.y>=0&&f.x+f.width<=390&&f.y+f.height<=600);
});

test('初始空页面打开面板不会抛出切站错误，网页完成后仍同步定位工具', async () => {
  const h = panel(), errors = [], calls = [], location = { origin: 'null' }, web = vm.createContext({ window: { location } });
  const parent = { view: { bounds: { width: 1024, height: 800 }, addSubview(view) { view.superview = this; } }, notebookController: { notebookId: 'book-1' }, refreshAddonCommands() {} };
  h.context.Application.sharedInstance = () => ({ studyController: () => parent, showHUD() {} });
  const c = { addon: { window: {} }, view: {}, activePage: 'math', webView: { loading: true,
    evaluateJavaScript(code, callback) { calls.push(code); try { callback(vm.runInContext(code, web), null); } catch (error) { errors.push(error.message); callback(null, error); } }
  } };
  h.panel.show(c); await tick(); assert.deepEqual(errors, []);
  let configured;
  location.origin = 'https://bbkaoyan.cn'; c.webView.loading = false;
  web.window.__JFJC_QUESTION_TOOLS__ = { configure(value) { configured = value.enabled; } };
  h.panel.show(c); await tick(); assert.equal(configured, true); assert.deepEqual(errors, []);
  assert.ok(calls.every(code => !code.includes('fetch(')));
});
test('未知命令和旧 token 不执行导入，合法取消命令生效',()=>{
  const h=panel(),session={token:'new-token',cancelled:false},controller={session,addon:{window:{}},webView:{evaluateJavaScript(code,cb){cb('cancelled',null);}}};
  assert.equal(h.panel.command(controller,'jifengjincaobridge://delete?token=new-token&scope='),false);
  assert.equal(h.panel.command(controller,'jifengjincaobridge://import?token=old-token&scope='),false);
  assert.equal(h.panel.command(controller,'jifengjincaobridge://cancel?token=new-token&scope='),true);assert.equal(session.cancelled,true);
});

test('对话粘贴命令只接受输入框标识，导航离开会取消正在传输的图片',()=>{
  const h=panel(), calls=[], controller={addon:{window:{}},webView:{evaluateJavaScript(code,cb){cb('cancelled',null);}}};
  h.context.__JFJC_UPLOAD__.start=async (owner,item)=>calls.push([owner,item]);
  assert.equal(h.panel.command(controller,'jifengjincaobridge://upload-content?token=&scope=composer-1'),true);
  assert.equal(calls[0][1],'composer-1');
  for(const scope of ['0','-1','5519','composer-0','composer-1%26url%3Devil','composer-1000000000']) assert.equal(h.panel.command(controller,'jifengjincaobridge://upload-content?token=&scope='+scope),false);
  assert.equal(h.panel.command(controller,'jifengjincaobridge://upload-content?token=other&scope=composer-1'),false);
  controller.uploadOperation={token:'none'}; h.context.self=controller;
  const request={URL:{absoluteString:'https://bbkaoyan.cn/papers'},mainDocumentURL:{absoluteString:'https://bbkaoyan.cn/papers'}};
  h.methods.webViewShouldStartLoadWithRequestNavigationType(controller.webView,request,0);
  assert.equal(controller.uploadOperation,null);
});
test('统一上传命令遵守开关与忙碌限制，旧手写入口不再绕过设置',()=>{
  const h=panel(), calls=[], controller={addon:{window:{}},webView:{evaluateJavaScript(code,cb){cb('cancelled',null);}}};
  h.native.savePreference('ai-tools.show-paste',false);
  h.context.__JFJC_UPLOAD__.start=async (owner,scope)=>calls.push([owner,scope]);
  const command='jifengjincaobridge://upload-content?token=&scope=composer-1';
  assert.equal(h.panel.command(controller,command),true); assert.equal(calls.length,0);
  assert.equal(h.panel.command(controller,command.replace('upload-content','upload-handwriting')),false);
  h.native.savePreference('ai-tools.show-paste',true); h.native.savePreference('ai-tools.upload-source','handwriting');
  assert.equal(h.panel.command(controller,command),true); assert.deepEqual(calls[0],[controller,'composer-1']);
  assert.equal(h.panel.command(controller,command.replace('token=&','token=other&')),false);
  assert.equal(h.panel.command(controller,command.replace('composer-1','composer-0')),false);
  controller.visible=false; assert.equal(h.panel.command(controller,command),false);
  controller.visible=true; controller.panelOperation={}; assert.equal(h.panel.command(controller,command),true);
  assert.equal(calls.length,1);
});
test('桥接 iframe 不误取消任务，主页面导航取消任务',()=>{
  const h=panel(),session={token:'token',cancelled:false},controller={session,addon:{window:{}},webView:{evaluateJavaScript(code,cb){cb('cancelled',null);}}};h.context.self=controller;
  const request=url=>({URL:{absoluteString:url},mainDocumentURL:{absoluteString:'https://bbkaoyan.cn/papers/237'}});
  assert.equal(h.methods.webViewShouldStartLoadWithRequestNavigationType(controller.webView,request('about:blank'),0),true);assert.equal(session.cancelled,false);
  h.methods.webViewShouldStartLoadWithRequestNavigationType(controller.webView,request('https://bbkaoyan.cn/papers/237'),0);assert.equal(session.cancelled,true);
});

test('三个页签按数学、导入、设置排列并居中，窄窗口也不覆盖关闭按钮',()=>{
  const h=panel();
  for(const width of [304,360,390,480,500,620,768,920,1366]){
    const f=h.panel.toolbarFrames(width);
    assert.ok(f.close.x>=0&&f.close.x+f.close.width<=width);
    assert.equal(f.close.width,44);assert.equal(f.close.height,44);assert.equal(f.close.y,0);
    assert.ok(f.math.x>=0&&f.settings.x+f.settings.width<=f.close.x);
    assert.equal((f.math.x+f.settings.x+f.settings.width)/2,width/2);
    assert.ok(f.math.x+f.math.width<=f.imports.x&&f.imports.x+f.imports.width<=f.settings.x);
    assert.equal(f.navigation,undefined);assert.equal(f.menu,undefined);
  }
});

test('导入页只在首次点击加载，与数学和设置互斥显示，网站实例和浏览位置保留', () => {
  const h = mountedPanel(), c = h.controller, website = c.webView;
  assert.equal(website.requests[0].URL.absoluteString, 'https://bbkaoyan.cn/past-papers?subject=math1');
  website.scrollY = 600; assert.equal(c.importWebView, undefined);
  h.methods.openImport(); const local = c.importWebView;
  assert.equal(c.activePage, 'import'); assert.equal(local.html, '<html>导入页面</html>'); assert.equal(local.hidden, false); assert.equal(website.hidden, true); assert.equal(c.settingsPage.hidden, true);
  h.methods.openSettings(); assert.equal(local.hidden, true);
  h.methods.openMath(); assert.equal(website.hidden, false); assert.equal(c.webView, website); assert.equal(website.scrollY, 600); assert.equal(website.requests.length, 1);
  h.methods.openImport(); assert.equal(c.importWebView, local);
  for (const [width, height] of [[304, 340], [920, 680]]) { c.view.frame = { x: 0, y: 0, width, height }; h.methods.viewDidLayoutSubviews(); assert.equal(local.frame.width, width); assert.equal(local.frame.height, height - 44); }
  c.panelOperation = 'loadPaper'; h.methods.openMath(); assert.equal(c.activePage, 'math'); assert.equal(c.panelOperation, null);
});

test('目录读取尚未完成时可切回数学，迟到的就绪回调不能重建导入会话', async () => {
  const h = mountedPanel(), c = h.controller; h.methods.openImport();
  let release;
  h.context.__JFJC_TRANSPORT__.waitReady = () => new Promise(resolve => { release = resolve; });
  const running = h.context.__JFJC_WEB_COMMANDS__.dispatch(c, 'loadCatalog', { subject: 'math1', kind: 'official' });
  const completed = running.catch(error => error);
  assert.equal(c.panelOperation, 'loadCatalog');
  const switched = h.panel.setPage(c, 'math');
  release(); const error = await completed;
  assert.equal(switched, true); assert.equal(c.activePage, 'math');
  assert.match(error.message, /取消|停止|离开/);
  assert.ok(!c.panelOperation); assert.ok(!c.session || c.session.cancelled);
});

test('停止目录读取后可发起同名新请求，旧请求结束不解锁新请求', async () => {
  const h = mountedPanel(), c = h.controller; h.methods.openImport();
  const queue = [];
  h.context.__JFJC_TRANSPORT__.waitReady = () => new Promise(resolve => queue.push(resolve));
  const send = () => h.context.__JFJC_WEB_COMMANDS__.dispatch(c, 'loadCatalog', { subject: 'math1', kind: 'official' }).catch(error => error);
  const old = send(); h.context.__JFJC_WEB_COMMANDS__.cancelRead(c);
  const newer = send(), request = c.panelRequest;
  queue[0](); await old;
  assert.equal(c.panelRequest, request); assert.equal(c.panelOperation, 'loadCatalog');
  h.context.__JFJC_WEB_COMMANDS__.cancelRead(c); queue[1](); await newer;
  assert.equal(c.panelOperation, null);
});

test('真正导入即使尚在准备阶段仍保留切页保护，停止入口对应导入任务', () => {
  const h = mountedPanel(), c = h.controller; h.methods.openImport();
  c.panelOperation = 'importQuestions'; c.session = { running: false };
  assert.equal(h.panel.setPage(c, 'math'), false); assert.equal(c.activePage, 'import');
  assert.match(h.hud.at(-1), /停止.*导入/);
});

test('删除浏览菜单和返回题库刷新处理，保留关闭拖动及缩放',()=>{
  const h=panel();
  for(const name of ['toggleNavigationMenu','openHome','goBack','reloadPage'])assert.equal(h.methods[name],undefined);
  for(const name of ['closePanel','movePanel','resizePanel'])assert.equal(typeof h.methods[name],'function');
});

test('点击原题会显示面板、加载对应地址并取消旧导入任务',()=>{
  const h=panel(),parent={view:{bounds:{width:1024,height:800},addSubview(view){view.superview=this;}},notebookController:{notebookId:'book-1'},refreshAddonCommands(){}};
  h.context.Application.sharedInstance=()=>({studyController:()=>parent,showHUD(){}});
  h.context.NSURL={URLWithString:url=>({absoluteString:url})};h.context.NSURLRequest={requestWithURL:url=>({URL:url})};
  const controller={addon:{window:{}},view:{hidden:true},session:{token:'old',cancelled:false},webView:{evaluateJavaScript(code,cb){cb('cancelled',null);},loadRequest(request){controller.request=request;}}};
  h.panel.openSource(controller,{url:'https://bbkaoyan.cn/papers/237#question-5074'});
  assert.equal(controller.visible,true);assert.equal(controller.view.hidden,false);assert.equal(controller.session.cancelled,true);
  assert.equal(controller.request.URL.absoluteString,'https://bbkaoyan.cn/papers/237#question-5074');
});

test('数学与设置切换保留同一个网站和浏览位置，隐藏网页不接受导入与图片命令', () => {
  const h = mountedPanel(), c = h.controller, website = c.webView;
  website.currentURL = 'https://bbkaoyan.cn/papers/237#question-5074'; website.scrollY = 600;
  c.session = { token: 'pending', cancelled: false, running: false };
  h.methods.openSettings();
  assert.equal(c.activePage, 'settings'); assert.equal(c.settingsPage.hidden, false); assert.equal(website.hidden, true);
  assert.equal(c.session.cancelled, true);
  assert.ok(website.scripts.some(code => code.includes('.dismiss()')));
  assert.equal(h.panel.command(c, 'jifengjincaobridge://preview?token=&scope=selected'), false);
  assert.equal(h.panel.command(c, 'jifengjincaobridge://upload-content?token=&scope=composer-1'), false);
  h.methods.openMath();
  assert.equal(c.activePage, 'math'); assert.equal(c.settingsPage.hidden, true); assert.equal(c.webView, website);
  assert.equal(website.requests.length, 1); assert.equal(website.currentURL, 'https://bbkaoyan.cn/papers/237#question-5074'); assert.equal(website.scrollY, 600);
});

test('知识点默认开启，关闭后跨面板保存，缺少 MN Utils 时沿用原生配置存储', () => {
  const h = mountedPanel(), c = h.controller;
  assert.equal(c.importTopicsSwitch.on, true);
  c.importTopicsSwitch.on = false; h.methods.toggleImportTopics(c.importTopicsSwitch);
  assert.equal(h.native.preference('import.include-topics', true), false);
  const reopened = { addon: c.addon }; h.context.self = reopened; h.methods.viewDidLoad();
  assert.equal(reopened.importTopicsSwitch.on, false);
  h.context.MNUtil = undefined;
  reopened.importTopicsSwitch.on = true; h.methods.toggleImportTopics(reopened.importTopicsSwitch);
  assert.equal(h.context.__JFJC_SETTINGS__.importTopics(), true);
});

test('选题预览或导入期间切换设置被拒绝，空闲预览捕获知识点设置', async () => {
  const h = mountedPanel(), c = h.controller;
  c.session = { token: 'running', running: true, cancelled: false };
  h.methods.openSettings(); assert.equal(c.activePage, 'math'); assert.equal(c.session.cancelled, false);
  c.session.running = false; c.previewing = true;
  h.methods.openSettings(); assert.equal(c.activePage, 'math'); c.previewing = false;
  h.context.__JFJC_SETTINGS__.saveTopics(false);
  await h.panel.preview(c, 'selected');
  assert.equal(c.session.includeTopics, false);
  assert.equal(c.session.includeSourceLink, undefined);
  h.context.__JFJC_SETTINGS__.saveTopics(true); assert.equal(c.session.includeTopics, false);
});

test('设置卡片在手机、低高度及平板窗口内排列，开关与文字不重叠', () => {
  const h = mountedPanel(), c = h.controller;
  h.methods.openSettings(); h.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
  assert.equal(c.importSettingsTitle.text, '题卡工具');
  for (const [width, height] of [[304,320], [390,540], [599,540], [600,540], [920,680]]) {
    c.view.frame = { x: 0, y: 0, width, height }; h.methods.viewDidLayoutSubviews();
    const section = c.importSettingsSection.frame, text = c.importTopicsDescription.frame, toggle = c.importTopicsSwitch.frame;
    assert.ok(section.x + section.width <= width);
    assert.ok(text.x + text.width + 12 <= toggle.x || text.y + text.height + 2 <= toggle.y);
    assert.ok(toggle.x + toggle.width <= section.width);
    assert.ok(text.y + text.height <= section.height);
    assert.ok(toggle.y + toggle.height <= section.height);
    assert.ok(section.y + section.height <= c.settingsPage.contentSize.height);
  }
});

test('原题链接开关与处理函数移除，历史关闭配置不影响新面板和知识点设置', () => {
  const h = mountedPanel(), c = h.controller;
  h.native.savePreference('import.include-source-link', false);
  assert.equal(c.importSourceLinkSwitch, undefined); assert.equal(h.methods.toggleImportSourceLink, undefined);
  assert.equal(h.context.__JFJC_SETTINGS__.importSourceLink, undefined); assert.equal(h.context.__JFJC_SETTINGS__.saveSourceLink, undefined);
  assert.equal(c.importTopicsSwitch.on, true);
  const reopened = { addon: c.addon }; h.context.self = reopened; h.methods.viewDidLoad();
  assert.equal(reopened.importSourceLinkSwitch, undefined);
  reopened.importTopicsSwitch.on = false; h.methods.toggleImportTopics(reopened.importTopicsSwitch);
  assert.equal(h.context.__JFJC_SETTINGS__.importTopics(), false);
});

test('题目工具显示开关默认开启并持久化，两种定位方式可选择、取消和恢复', async () => {
  const h = mountedPanel(), c = h.controller;
  assert.equal(c.questionToolsTitle.text, '题目工具'); assert.equal(c.showLocateCardTitle.text, '显示定位卡片');
  assert.equal(c.showLocateCardSwitch.on, true); assert.equal(c.cardLocationModeTitle.text, '定位卡片方式');
  assert.equal(c.cardLocationModeValue.text, '定位并聚焦');
  c.showLocateCardSwitch.on = false; h.methods.toggleShowLocateCard(c.showLocateCardSwitch); await Promise.resolve();
  assert.equal(h.context.__JFJC_SETTINGS__.showLocateCard(), false);
  assert.ok(c.webView.scripts.some(code => code.includes('configure({enabled:false,importEnabled:false})')));
  h.methods.chooseCardLocationMode(); const choice = c.cardLocationModeChoice;
  assert.equal(choice.buttons[0].title, '仅定位'); assert.match(choice.buttons[1].title, /当前/);
  h.methods.selectCardLocationMode(choice.buttons[0]);
  assert.equal(c.cardLocationModeChoice, null); assert.equal(c.cardLocationModeValue.text, '仅定位');
  h.methods.chooseCardLocationMode(); h.methods.selectCardLocationMode(c.cardLocationModeChoice.buttons[2]);
  assert.equal(h.context.__JFJC_SETTINGS__.cardLocationMode(), 'locate');
  const reopened = { addon: c.addon }; h.context.self = reopened; h.methods.viewDidLoad();
  assert.equal(reopened.showLocateCardSwitch.on, false); assert.equal(reopened.cardLocationModeValue.text, '仅定位');
  assert.equal(reopened.importTopicsSwitch.on, true); assert.equal(reopened.importSourceLinkSwitch, undefined);
});

test('设置行宽度间距一致、方式文字箭头居中，窄窗口不重叠；切页关闭弹层', () => {
  const h = mountedPanel(), c = h.controller;
  h.methods.openSettings();
  for (const [width, height] of [[304, 320], [390, 540], [599, 540], [600, 540], [920, 680]]) {
    c.view.frame = { x: 0, y: 0, width, height }; h.methods.viewDidLayoutSubviews();
    const section = c.questionToolsSection.frame, desc = c.showLocateCardDescription.frame, toggle = c.showLocateCardSwitch.frame;
    assert.ok(desc.x + desc.width + 12 <= toggle.x || desc.y + desc.height + 2 <= toggle.y);
    assert.equal(c.questionToolsSection.hidden, false); assert.equal(c.importSettingsSection.hidden, true);
    const title = c.cardLocationModeTitle.frame, option = c.cardLocationModeButton.frame;
    const value = c.cardLocationModeValue.frame, arrow = c.cardLocationModeChevron.frame, modeDesc = c.cardLocationModeDescription.frame;
    assert.ok(modeDesc.x + modeDesc.width + 12 <= value.x || modeDesc.y + modeDesc.height + 2 <= value.y);
    assert.equal(value.y + value.height / 2, arrow.y + arrow.height / 2);
    assert.equal(value.y + value.height / 2 - (toggle.y + toggle.height / 2), title.y - c.showLocateCardTitle.frame.y);
    assert.ok(value.x + value.width <= arrow.x && arrow.x + arrow.width <= section.width);
    assert.equal(c.cardLocationModeValue.textAlignment, 2); assert.equal(c.cardLocationModeChevron.textAlignment, 1);
    for (const item of [c.showLocateCardTitle, c.cardLocationModeTitle, c.importTopicsTitle, c.showSingleImportTitle, c.singleImportPositionTitle,
      c.showLocateCardDescription, c.cardLocationModeDescription, c.importTopicsDescription, c.showSingleImportDescription, c.singleImportPositionDescription]) {
      assert.equal(item.frame.width, desc.width); assert.equal(item.frame.x, desc.x);
    }
    assert.equal(section.width, c.importSettingsSection.frame.width);
    assert.equal(section.height, c.importSettingsSection.frame.height);
    assert.equal(option.x, 0); assert.equal(option.width, section.width);
    assert.ok(option.y <= title.y && title.y + title.height <= option.y + option.height);
    assert.ok(option.y <= value.y && value.y + value.height <= option.y + option.height);
    assert.ok(option.y + option.height <= section.height);
    h.methods.chooseCardLocationMode(); h.methods.viewDidLayoutSubviews();
    const sheet = c.cardLocationModeChoice.sheet.frame;
    assert.ok(sheet.width <= width && sheet.x >= 0);
    h.methods.openMath(); assert.equal(c.cardLocationModeChoice, null);
    h.methods.openSettings();
  }
});

test('导入本题设置独立保存，默认子节点，位置选择取消不更改且行宽和居中一致', async () => {
  const h = mountedPanel(), c = h.controller;
  assert.equal(c.showSingleImportTitle.text, '显示导入本题'); assert.equal(c.showSingleImportSwitch.on, false);
  assert.equal(c.singleImportPositionValue.text, '子节点');
  c.showSingleImportSwitch.on = true; h.methods.toggleShowSingleImport(c.showSingleImportSwitch); await tick();
  assert.equal(h.context.__JFJC_SETTINGS__.showSingleImport(), true); assert.equal(h.context.__JFJC_SETTINGS__.showLocateCard(), true);
  h.methods.chooseSingleImportPosition(); const choice = c.cardLocationModeChoice;
  assert.equal(choice.title.text, '导入本题位置'); assert.deepEqual(Array.from(choice.values), ['child', 'sibling']);
  h.methods.selectSingleImportPosition(choice.buttons[1]); assert.equal(c.singleImportPositionValue.text, '同级节点');
  h.methods.chooseSingleImportPosition(); h.methods.selectSingleImportPosition(c.cardLocationModeChoice.buttons[2]);
  assert.equal(h.context.__JFJC_SETTINGS__.singleImportPosition(), 'sibling');
  const reopened = { addon: c.addon }; h.context.self = reopened; h.methods.viewDidLoad();
  assert.equal(reopened.showSingleImportSwitch.on, true); assert.equal(reopened.singleImportPositionValue.text, '同级节点');
  for (const width of [304, 390, 599, 600, 920]) {
    reopened.view.frame = { x: 0, y: 0, width, height: 540 }; h.methods.viewDidLayoutSubviews();
    const option = reopened.singleImportPositionButton.frame, mode = reopened.cardLocationModeButton.frame;
    assert.equal(option.width, mode.width); assert.equal(option.height, mode.height);
    const toggle = reopened.showSingleImportSwitch.frame, desc = reopened.showSingleImportDescription.frame;
    assert.ok(desc.x + desc.width + 12 <= toggle.x || desc.y + desc.height + 2 <= toggle.y);
    const value = reopened.singleImportPositionValue.frame, arrow = reopened.singleImportPositionChevron.frame;
    assert.equal(value.y + value.height / 2, arrow.y + arrow.height / 2);
    assert.ok(option.y + option.height <= reopened.questionToolsSection.frame.height);
  }
});

test('同题多卡选择显示学习集与路径，只接受本轮按钮，取消会结束选择', async () => {
  const h = mountedPanel(), c = h.controller, ui = h.context.__JFJC_CARD_LOCATOR_UI__;
  const candidates = [{ noteId: 'note-1', title: '题卡', studySetTitle: '数学', path: '真题 / 2026 / 选择题' }, { noteId: 'note-2', title: '备份', studySetTitle: '复习', path: '' }];
  const promise = ui.choose(c, candidates), choice = c.cardLocationChoice;
  assert.match(choice.buttons[0].title, /数学\n真题 \/ 2026/);
  ui.select(c, 1, choice.buttons[0]); assert.equal(c.cardLocationChoice, choice);
  h.methods.selectCardLocationChoice(choice.buttons[1]); assert.equal((await promise).noteId, 'note-2');
  assert.equal(c.cardLocationChoice, null);
  const cancelled = ui.choose(c, candidates); h.methods.cancelCardLocationChoice();
  await assert.rejects(cancelled, /取消定位/);
});

test('设置包含题目工具、AI 工具和题卡工具，网页诊断及辅助分组已移除', () => {
  const h = mountedPanel(), c = h.controller;
  assert.equal(h.context.__JFJC_WEB_DIAGNOSTICS__, undefined);
  assert.equal(c.supportSettingsSection, undefined); assert.equal(c.webDiagnosticPanel, undefined);
  assert.equal(h.methods.toggleWebDiagnostics, undefined);
  h.methods.openSettings();
  h.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
  for (const width of [304, 390, 600, 920]) {
    c.view.frame = { x: 0, y: 0, width, height: 400 }; h.methods.viewDidLayoutSubviews();
    const card = c.importSettingsSection.frame;
    assert.equal(card.width, c.questionToolsSection.frame.width);
    assert.equal(card.width, c.aiToolsSection.frame.width);
    assert.ok(card.y + card.height + 18 <= c.settingsPage.contentSize.height);
  }
});

test('显示上传默认开启，开关独立保存并在重新打开和原生配置回退时恢复', async () => {
  const h = mountedPanel(), c = h.controller;
  assert.equal(c.aiToolsTitle.text, 'AI 工具'); assert.equal(c.showUploadTitle.text, '显示上传');
  assert.equal(c.showUploadSwitch.on, true); assert.equal(c.showUploadSwitch.action, 'toggleShowUpload:');
  c.showUploadSwitch.on = false; h.methods.toggleShowUpload(c.showUploadSwitch); await tick();
  assert.equal(h.context.__JFJC_SETTINGS__.showUpload(), false);
  assert.equal(h.context.__JFJC_SETTINGS__.showLocateCard(), true); assert.equal(h.context.__JFJC_SETTINGS__.importTopics(), true);
  assert.ok(c.webView.scripts.some(code => code.includes('__JFJC_REVIEW__.configure({enabled:false,source:"none",attachFirst:false,hasPrompt:false})')));
  const reopened = { addon: c.addon }; h.context.self = reopened; h.methods.viewDidLoad();
  assert.equal(reopened.showUploadSwitch.on, false);
  h.context.MNUtil = undefined;
  reopened.showUploadSwitch.on = true; h.methods.toggleShowUpload(reopened.showUploadSwitch); await tick();
  h.context.__JFJC_SETTINGS__.refresh(c); assert.equal(c.showUploadSwitch.on, true);
  assert.equal(h.context.__JFJC_SETTINGS__.showUpload(), true);
});

test('AI 工具设置分组等宽、间距一致，窄窗口说明和开关不重叠且可滚动', () => {
  const h = mountedPanel(), c = h.controller;
  h.methods.openSettings(); h.methods.selectSettingsSection(c.settingsNavigationButtons[2]);
  for (const [width, height] of [[304,320], [390,540], [599,540], [600,540], [920,680]]) {
    c.view.frame = { x: 0, y: 0, width, height }; h.methods.viewDidLayoutSubviews();
    const tools = c.questionToolsSection.frame, ai = c.aiToolsSection.frame, card = c.importSettingsSection.frame;
    assert.equal(ai.width, tools.width); assert.equal(ai.width, card.width); assert.equal(ai.x, card.x);
    assert.equal(ai.y, tools.y); assert.equal(card.y, ai.y);
    assert.equal(c.aiToolsSection.hidden, false); assert.equal(c.questionToolsSection.hidden, true); assert.equal(c.importSettingsSection.hidden, true);
    assert.ok(ai.height > card.height);
    const text = c.showUploadDescription.frame, toggle = c.showUploadSwitch.frame;
    assert.ok(text.x + text.width + 12 <= toggle.x || text.y + text.height + 2 <= toggle.y);
    assert.ok(toggle.x + toggle.width <= ai.width); assert.ok(toggle.y + toggle.height <= ai.height);
    assert.ok(text.y + text.height <= ai.height);
    const sourceText = c.uploadSourceDescription.frame, value = c.uploadSourceValue.frame, arrow = c.uploadSourceChevron.frame, option = c.uploadSourceButton.frame;
    assert.ok(sourceText.x + sourceText.width + 8 <= value.x || sourceText.y + sourceText.height + 2 <= value.y);
    assert.equal(value.y + value.height / 2, arrow.y + arrow.height / 2);
    assert.ok(option.y + option.height <= ai.height);
    const firstText = c.attachFirstDescription.frame, firstSwitch = c.attachFirstSwitch.frame;
    assert.ok(firstText.x + firstText.width + 12 <= firstSwitch.x || firstText.y + firstText.height + 2 <= firstSwitch.y);
    assert.ok(firstSwitch.y + firstSwitch.height <= ai.height);
    assert.ok(firstSwitch.y + firstSwitch.height <= option.y);
    assert.equal(toggle.y, c.importTopicsSwitch.frame.y);
    assert.ok(ai.y + ai.height + 18 <= c.settingsPage.contentSize.height);
  }
});

test('上传卡片内容默认关闭，全部来源可操作，原生保存恢复并同步网页', async () => {
  const h = mountedPanel(), c = h.controller, settings = h.context.__JFJC_SETTINGS__;
  assert.equal(c.attachFirstTitle.text, '上传卡片内容');
  assert.equal(c.attachFirstSwitch.on, false); assert.notEqual(c.attachFirstSwitch.enabled, false);
  c.attachFirstSwitch.on = true; h.methods.toggleAttachFirstContent(c.attachFirstSwitch);
  assert.equal(settings.attachFirstContent(), true); assert.equal(c.attachFirstSwitch.on, true);
  c.attachFirstSwitch.on = false; h.methods.toggleAttachFirstContent(c.attachFirstSwitch);
  h.methods.chooseUploadSource(); h.methods.selectUploadSource(c.cardLocationModeChoice.buttons[1]); await tick();
  assert.notEqual(c.attachFirstSwitch.enabled, false);
  let cancelled = false; c.uploadOperation = { token: 'reading', source: { cancel() { cancelled = true; } } };
  h.context.MNUtil = undefined;
  c.attachFirstSwitch.on = true; h.methods.toggleAttachFirstContent(c.attachFirstSwitch); await tick();
  assert.equal(settings.attachFirstContent(), true); assert.equal(cancelled, true);
  assert.ok(c.webView.scripts.some(code => code.includes('source:"mindmap",attachFirst:true')));
  const reopened = { addon: c.addon }; h.context.self = reopened; h.methods.viewDidLoad();
  assert.equal(reopened.attachFirstSwitch.on, true); assert.notEqual(reopened.attachFirstSwitch.enabled, false);
  h.methods.chooseUploadSource(); h.methods.selectUploadSource(reopened.cardLocationModeChoice.buttons[1]); await tick();
  assert.notEqual(reopened.attachFirstSwitch.enabled, false); assert.equal(settings.attachFirstContent(), true);
});

test('提示词默认关闭，多行内容原生保存，关闭仍保留；其他开关刷新不覆盖未保存输入', async () => {
  const h = mountedPanel(), c = h.controller, settings = h.context.__JFJC_SETTINGS__;
  await tick(); h.methods.openSettings();
  assert.equal(c.extraTextTitle.text, '提示词'); assert.equal(c.attachFirstTitle.text, '上传卡片内容');
  assert.equal(c.extraTextSwitch.on, false); assert.equal(c.extraTextEditor.editorDocument.querySelector('textarea').disabled, false);
  assert.equal(extraValue(c), ''); assert.equal(c.extraTextSaveButton.action, 'saveExtraText:');
  assert.equal(c.extraTextSwitch.action, 'toggleExtraText:');
  typeExtra(c, '请检查思路\r\n\r\n先给提示 😀');
  h.methods.saveExtraText(); await tick();
  assert.equal(settings.extraText(), '请检查思路\n\n先给提示 😀'); assert.equal(settings.uploadExtraText(), '');
  c.extraTextSwitch.on = true; h.methods.toggleExtraText(c.extraTextSwitch);
  assert.equal(settings.uploadExtraText(), settings.extraText());
  typeExtra(c, '尚未保存的草稿');
  c.attachFirstSwitch.on = true; h.methods.toggleAttachFirstContent(c.attachFirstSwitch);
  assert.equal(extraValue(c), '尚未保存的草稿'); assert.notEqual(settings.extraText(), extraValue(c));
  c.extraTextSwitch.on = false; h.methods.toggleExtraText(c.extraTextSwitch);
  const reopened = { addon: c.addon }; h.context.self = reopened; h.methods.viewDidLoad();
  await tick(); h.methods.openSettings();
  assert.equal(reopened.extraTextSwitch.on, false); assert.equal(extraValue(reopened), '请检查思路\n\n先给提示 😀');
  h.context.MNUtil = undefined;
  typeExtra(reopened, '使用原生存储'); h.methods.saveExtraText(); await tick();
  reopened.extraTextSwitch.on = true; h.methods.toggleExtraText(reopened.extraTextSwitch);
  assert.equal(settings.uploadExtraText(), '使用原生存储');
});

test('提示词保存失败或超长保留已保存内容和编辑草稿，启用或保存修改会取消读取', async () => {
  const h = mountedPanel(), c = h.controller, settings = h.context.__JFJC_SETTINGS__;
  await tick(); h.methods.openSettings();
  typeExtra(c, '原文字'); h.methods.saveExtraText(); await tick();
  c.uploadOperation = { token: 'pending' };
  c.extraTextSwitch.on = true; h.methods.toggleExtraText(c.extraTextSwitch);
  assert.equal(c.uploadOperation, null);
  typeExtra(c, 'x'.repeat(16385)); h.methods.saveExtraText(); await tick();
  assert.equal(settings.extraText(), '原文字'); assert.equal(extraValue(c).length, 16385); assert.match(h.hud.at(-1), /16384/);
  const save = h.context.MNUtil.setLocalDataByKey;
  h.context.MNUtil.setLocalDataByKey = () => { throw new Error('写入失败'); };
  typeExtra(c, '新的多行\n内容'); h.methods.saveExtraText(); await tick();
  assert.equal(settings.extraText(), '原文字'); assert.equal(extraValue(c), '新的多行\n内容'); assert.match(h.hud.at(-1), /文字未保存/);
  h.context.MNUtil.setLocalDataByKey = save;
  c.uploadOperation = { token: 'pending-2' }; h.methods.saveExtraText(); await tick();
  assert.equal(c.uploadOperation, null); assert.equal(settings.extraText(), '新的多行\n内容');
});

test('提示词设置在窄屏和低窗口可滚动，输入框、说明、开关与保存按钮不重叠', () => {
  const h = mountedPanel(), c = h.controller; h.methods.openSettings(); h.methods.selectSettingsSection(c.settingsNavigationButtons[2]);
  for (const width of [304, 390, 599, 600, 920]) {
    c.view.frame = { x: 0, y: 0, width, height: 320 }; h.methods.viewDidLayoutSubviews();
    const area = c.aiToolsSection.frame, text = c.extraTextDescription.frame, toggle = c.extraTextSwitch.frame, editor = c.extraTextEditor.frame, hint = c.extraTextHint.frame, save = c.extraTextSaveButton.frame;
    assert.ok(text.x + text.width + 12 <= toggle.x || text.y + text.height + 2 <= toggle.y);
    assert.ok(toggle.y + toggle.height < editor.y); assert.ok(editor.x + editor.width <= area.width - 20);
    assert.ok(editor.y + editor.height <= save.y); assert.ok(hint.x + hint.width <= save.x);
    assert.equal(editor.height, 72);
    assert.ok(save.y + save.height < area.height);
    assert.ok(area.height + 18 <= c.settingsPage.contentSize.height);
  }
});

test('本地文字输入框实际 iframe 桥接保存长中文及换行，正文不放入命令 URL', async () => {
  const h = mountedPanel({ editorIframeBridge: true }), c = h.controller;
  await tick(); h.methods.openSettings();
  const text = '首段😀\n' + '中文'.repeat(7000) + '\n</textarea><script>不是脚本</script>';
  typeExtra(c, text); h.methods.saveExtraText(); await tick();
  assert.equal(h.context.__JFJC_SETTINGS__.extraText(), text); assert.equal(extraValue(c), text);
  assert.equal(c.extraTextEditor.blurred, true);
  assert.ok(c.extraTextEditor.bridgeAddresses.length >= 2);
  assert.ok(c.extraTextEditor.bridgeAddresses.every(address => address.length < 1000 && !address.includes(encodeURIComponent('首段'))));
});

test('本地文字编辑器仅可读写提示词，导入页、数学页和旧编辑器无法调用保存', async () => {
  const h = mountedPanel(), c = h.controller, commands = h.context.__JFJC_WEB_COMMANDS__;
  await tick(); h.methods.openSettings();
  await assert.rejects(commands.dispatch(c, 'loadPaper', { paperId: 237 }, c.extraTextEditor), /未知设置命令/);
  await assert.rejects(commands.dispatch(c, 'saveExtraText', { revision: 0 }, {}), /来源无效/);
  await assert.rejects(commands.dispatch(c, 'getExtraText', {}), /来源无效/);
  assert.equal(h.context.__JFJC_SETTINGS__.extraText(), '');
  for (const address of ['https://example.com/', 'file:///etc/passwd', 'jifengjincaobridge://upload-content?scope=composer-1']) {
    assert.equal(h.methods.webViewShouldStartLoadWithRequestNavigationType(c.extraTextEditor, { URL: { absoluteString: address } }, 0), false);
  }
  h.methods.openMath();
  await assert.rejects(commands.dispatch(c, 'saveExtraText', { revision: 0 }, c.extraTextEditor), /打开设置/);
});

test('保存读取期间修改文字或替换编辑器不写入旧内容，失败后仍能重试保存', async () => {
  for (const action of ['edit', 'replace']) {
    const h = mountedPanel(), c = h.controller, settings = h.context.__JFJC_SETTINGS__;
    await tick(); h.methods.openSettings();
    typeExtra(c, '旧草稿');
    const web = c.extraTextEditor, evaluate = web.evaluateJavaScript.bind(web); let release;
    web.evaluateJavaScript = (code, callback) => {
      if (code.startsWith('JSON.stringify(window.__JFJC_EXTRA_TEXT__.read(')) release = () => evaluate(code, callback);
      else evaluate(code, callback);
    };
    h.methods.saveExtraText();
    assert.equal(typeof release, 'function');
    if (action === 'edit') typeExtra(c, '修改后的草稿'); else c.extraTextEditor = {};
    release(); await tick();
    assert.equal(settings.extraText(), ''); assert.match(h.hud.at(-1), /文字未保存/);
    c.extraTextEditor = web; web.evaluateJavaScript = evaluate;
    h.methods.saveExtraText(); await tick();
    assert.equal(settings.extraText(), action === 'edit' ? '修改后的草稿' : '旧草稿');
  }
});

test('旧剪贴板来源迁移为无，卡片开关和提示词保留，保存失败也不会中断设置页', async () => {
  const h = mountedPanel(), c = h.controller, settings = h.context.__JFJC_SETTINGS__;
  h.native.savePreference('ai-tools.upload-source', 'clipboard');
  h.native.savePreference('ai-tools.attach-first-content', true);
  h.native.savePreference('ai-tools.extra-text-enabled', true); h.native.savePreference('ai-tools.extra-text', '保留的提示词');
  settings.refresh(c);
  assert.equal(settings.uploadSource(), 'none'); assert.equal(h.native.preference('ai-tools.upload-source', ''), 'none');
  assert.equal(c.uploadSourceValue.text, '无'); assert.equal(c.uploadSourceTitle.text, '上传手写内容');
  assert.equal(c.attachFirstTitle.text, '上传卡片内容'); assert.equal(c.extraTextTitle.text, '提示词');
  assert.equal(c.attachFirstSwitch.on, true); assert.equal(settings.uploadExtraText(), '保留的提示词');
  assert.ok(c.attachFirstTitle.frame.y < c.uploadSourceTitle.frame.y); assert.ok(c.uploadSourceTitle.frame.y < c.extraTextTitle.frame.y);
  h.native.savePreference('ai-tools.upload-source', 'clipboard');
  h.context.MNUtil.setLocalDataByKey = () => { throw new Error('模拟迁移写入失败'); };
  assert.doesNotThrow(() => settings.refresh(c)); assert.equal(settings.uploadSource(), 'none');
});

test('上传来源默认无，可切换、取消和重新打开恢复，旧显示配置继续生效', async () => {
  const h = mountedPanel(), c = h.controller, settings = h.context.__JFJC_SETTINGS__;
  assert.equal(settings.uploadSource(), 'none'); assert.equal(c.uploadSourceValue.text, '无');
  assert.equal(c.uploadSourceButton.action, 'chooseUploadSource:');
  h.methods.openSettings(); h.methods.selectSettingsSection(c.settingsNavigationButtons[2]);
  h.methods.chooseUploadSource(); const choice = c.cardLocationModeChoice;
  assert.equal(choice.title.text, '上传手写内容'); assert.deepEqual(Array.from(choice.values), ['none', 'mindmap', 'handwriting']);
  c.uploadOperation = { token: 'old-transfer', handwriting: false };
  h.methods.selectUploadSource(choice.buttons[2]); await tick();
  assert.equal(c.uploadSourceValue.text, '卡片手写'); assert.equal(c.uploadOperation, null);
  assert.equal(settings.uploadSource(), 'handwriting');
  assert.ok(c.webView.scripts.some(code => code.includes('source:"handwriting"')));
  h.methods.chooseUploadSource(); h.methods.selectUploadSource(c.cardLocationModeChoice.buttons[3]);
  assert.equal(settings.uploadSource(), 'handwriting');
  h.native.savePreference('ai-tools.show-paste', false);
  const reopened = { addon: c.addon }; h.context.self = reopened; h.methods.viewDidLoad();
  assert.equal(reopened.uploadSourceValue.text, '卡片手写'); assert.equal(reopened.showUploadSwitch.on, false);
  h.context.MNUtil = undefined;
  h.methods.chooseUploadSource(); h.methods.selectUploadSource(reopened.cardLocationModeChoice.buttons[0]); await tick();
  assert.equal(settings.uploadSource(), 'none'); assert.equal(reopened.uploadSourceValue.text, '无');
});

test('脑图手写来源由原生保存，切换取消读取，重新打开恢复并同步网站', async () => {
  const h = mountedPanel(), c = h.controller, settings = h.context.__JFJC_SETTINGS__;
  h.methods.openSettings(); h.methods.selectSettingsSection(c.settingsNavigationButtons[2]);
  let cancelled = false;
  c.uploadOperation = { token: 'pending-media', source: { cancel() { cancelled = true; } } };
  h.methods.chooseUploadSource(); h.methods.selectUploadSource(c.cardLocationModeChoice.buttons[1]); await tick();
  assert.equal(settings.uploadSource(), 'mindmap'); assert.equal(c.uploadSourceValue.text, '脑图手写');
  assert.equal(cancelled, true); assert.equal(c.uploadOperation, null);
  assert.ok(c.webView.scripts.some(code => code.includes('source:"mindmap"')));
  const reopened = { addon: c.addon }; h.context.self = reopened; h.methods.viewDidLoad();
  assert.equal(reopened.uploadSourceValue.text, '脑图手写');
  h.methods.chooseUploadSource();
  const choice = reopened.cardLocationModeChoice;
  assert.equal(choice.buttons[1].title, '脑图手写（当前）');
  for (const [width, height] of [[304, 320], [390, 540], [920, 680]]) {
    reopened.view.frame = { x: 0, y: 0, width, height }; h.methods.viewDidLayoutSubviews();
    assert.ok(choice.sheet.frame.y + choice.sheet.frame.height <= choice.overlay.frame.height);
    choice.buttons.forEach(button => assert.ok(button.frame.y + button.frame.height <= choice.sheet.frame.height));
  }
  h.methods.selectUploadSource(choice.buttons[3]);
  assert.equal(settings.uploadSource(), 'mindmap');
});

test('上传来源保存失败不切换来源、不取消现有操作，并显示失败原因', () => {
  const h = mountedPanel(), c = h.controller;
  c.uploadOperation = { token: 'keep' };
  h.context.MNUtil.setLocalDataByKey = () => { throw new Error('模拟写入失败'); };
  h.methods.chooseUploadSource(); h.methods.selectUploadSource(c.cardLocationModeChoice.buttons[1]);
  assert.equal(h.context.__JFJC_SETTINGS__.uploadSource(), 'none'); assert.equal(c.uploadSourceValue.text, '无');
  assert.equal(c.uploadOperation.token, 'keep'); assert.match(h.hud.at(-1), /设置未保存.*模拟写入失败/);
});

test('粘贴开关关闭时忽略旧网页命令，重新开启才允许执行上传', () => {
  const h = panel(), calls = [], c = { addon: { window: {} }, webView: { evaluateJavaScript(code, cb) { cb('cancelled', null); } } };
  h.context.__JFJC_UPLOAD__.start = async () => calls.push('paste');
  h.native.savePreference('ai-tools.show-paste', false);
  assert.equal(h.panel.command(c, 'jifengjincaobridge://upload-content?token=&scope=composer-1'), true);
  assert.deepEqual(calls, []);
  h.native.savePreference('ai-tools.show-paste', true);
  assert.equal(h.panel.command(c, 'jifengjincaobridge://upload-content?token=&scope=composer-1'), true);
  assert.deepEqual(calls, ['paste']);
});

test('自动折叠原题评论设置默认关闭，保存后恢复，新增行在窄窗口不重叠', () => {
  const h = mountedPanel(), c = h.controller; h.methods.openSettings();
  h.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
  assert.equal(c.sourceFoldSwitch.on, false); assert.equal(c.sourceFoldSwitch.action, 'toggleSourceCommentFold:');
  c.sourceFoldSwitch.on = true; h.methods.toggleSourceCommentFold(c.sourceFoldSwitch);
  assert.equal(h.context.__JFJC_COMMENT_FOLD__.enabled(), true);
  const reopened = { addon: c.addon }; h.context.self = reopened; h.methods.viewDidLoad();
  assert.equal(reopened.sourceFoldSwitch.on, true); h.context.self = c;
  for (const width of [304, 390, 600, 920]) {
    c.view.frame = { x: 0, y: 0, width, height: 320 }; h.methods.viewDidLayoutSubviews();
    const group = c.importSettingsSection.frame, toggle = c.sourceFoldSwitch.frame, text = c.sourceFoldDescription.frame;
    assert.equal(group.width, c.aiToolsSection.frame.width);
    assert.ok(text.x + text.width + 12 <= toggle.x || text.y + text.height + 2 <= toggle.y);
    assert.ok(toggle.y + toggle.height < c.sourceCommentButton.frame.y);
    assert.ok(c.sourceCommentButton.frame.y + c.sourceCommentButton.frame.height <= group.height);
    assert.ok(group.y + group.height + 18 <= c.settingsPage.contentSize.height);
  }
});

test('已导入题卡管理可选择折叠和展开，取消不执行，晚到结果不更新已离开的设置', async () => {
  const h = mountedPanel(), c = h.controller; h.methods.openSettings();
  let resolve, calls = [];
  h.context.__JFJC_COMMENT_FOLD__.batch = (addon, collapsed) => { calls.push(collapsed); return new Promise(done => { resolve = done; }); };
  h.methods.chooseSourceCommentDisplay();
  assert.equal(c.cardLocationModeChoice.buttons[0].title, '折叠原题评论');
  h.methods.selectSourceCommentDisplay(c.cardLocationModeChoice.buttons[2]); assert.deepEqual(calls, []);
  h.methods.chooseSourceCommentDisplay(); h.methods.selectSourceCommentDisplay(c.cardLocationModeChoice.buttons[1]);
  assert.deepEqual(calls, [false]); assert.ok(c.commentFoldOperation); assert.equal(c.sourceFoldSwitch.enabled, false);
  h.methods.openMath(); assert.equal(c.commentFoldOperation, null);
  const messages = h.hud.length; resolve({ changed: 1, unchanged: 0, failed: [] }); await tick();
  assert.equal(h.hud.length, messages); assert.equal(c.sourceFoldSwitch.enabled, true);
  h.methods.openSettings();
  const pending = h.context.__JFJC_SETTINGS__.foldExisting(c, true);
  resolve({ changed: 2, unchanged: 1, failed: [] }); await pending;
  assert.equal(c.commentFoldOperation, null); assert.ok(h.hud.some(text => text.includes('已折叠 2 张')));
});

test('学习集关闭和插件断开都取消尚未完成的评论批量操作', () => {
  const h = mountedPanel(), c = h.controller; let methods;
  h.context.JSB = { defineClass(name, body) { methods = body; return {}; } };
  vm.runInContext(source('src/WebAddon.js'), h.context); h.context.createJifengjincaoBridgeAddon();
  const addon = { panelController: c, window: c.addon.window }; h.context.self = addon;
  c.commentFoldOperation = {}; methods.notebookWillClose(); assert.equal(c.commentFoldOperation, null);
  c.commentFoldOperation = {}; methods.sceneDidDisconnect(); assert.equal(c.commentFoldOperation, null); assert.equal(addon.panelController, null);
});

test('设置胶囊固定在内容上方，分类互斥显示且各自恢复滚动位置', () => {
  const h = mountedPanel(), c = h.controller;
  h.methods.openSettings();
  c.view.frame = { x: 0, y: 0, width: 390, height: 340 }; h.methods.viewDidLayoutSubviews();
  const groups = [c.questionToolsSection, c.aiToolsSection, c.importSettingsSection];
  assert.deepEqual(Array.from(c.settingsNavigationButtons, button => button.title), ['题目工具', '题卡工具', 'AI 工具']);
  const headerFrame = { ...c.settingsHeader.frame };
  assert.equal(c.settingsPage.frame.y, headerFrame.y + headerFrame.height);
  c.settingsPage.contentOffset = { x: 0, y: 160 };
  h.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
  assert.equal(c.settingsSection, 'card'); assert.equal(c.settingsPage.contentOffset.y, 0);
  c.settingsPage.contentOffset = { x: 0, y: 100 };
  h.methods.selectSettingsSection(c.settingsNavigationButtons[2]);
  assert.deepEqual(groups.map(group => group.hidden), [true, false, true]);
  assert.equal(c.settingsPage.contentOffset.y, 0);
  assert.equal(c.settingsPage.contentSize.height, Math.max(c.settingsPage.frame.height + 1, c.aiToolsSection.frame.height + 20));
  h.methods.selectSettingsSection(c.settingsNavigationButtons[1]); assert.equal(c.settingsPage.contentOffset.y, 100);
  h.methods.selectSettingsSection(c.settingsNavigationButtons[0]); assert.equal(c.settingsPage.contentOffset.y, 160);
  assert.deepEqual({ ...c.settingsHeader.frame }, headerFrame);
  h.methods.openImport(); assert.equal(c.settingsHeader.hidden, true);
  h.methods.openSettings(); assert.equal(c.settingsHeader.hidden, false); assert.equal(c.settingsPage.contentOffset.y, 160);
  h.methods.selectSettingsSection({ tag: 1 }); assert.equal(c.settingsSection, 'question');
  c.view.frame = { x: 0, y: 0, width: 920, height: 680 }; h.methods.viewDidLayoutSubviews();
  assert.equal(c.settingsPage.contentOffset.y, 0);
  assert.deepEqual(groups.map(group => group.hidden), [false, true, true]);
});

test('分类胶囊在窄窗口内居中、点击区域不重叠，末行可滚到完整显示', () => {
  const h = mountedPanel(), c = h.controller; h.methods.openSettings();
  for (const width of [304, 360, 390, 599, 600, 920]) {
    c.view.frame = { x: 0, y: 0, width, height: 320 }; h.methods.viewDidLayoutSubviews();
    const capsule = c.settingsNavigation.frame;
    assert.equal(capsule.x + capsule.width / 2, width / 2);
    assert.ok(capsule.x >= 20 && capsule.x + capsule.width <= width - 20);
    c.settingsNavigationButtons.forEach((button, index) => {
      const f = button.frame; assert.ok(f.width >= 80); assert.equal(f.height, 40);
      if (index) assert.ok(c.settingsNavigationButtons[index - 1].frame.x + f.width <= f.x + 0.001);
    });
    for (const [index, group] of [c.questionToolsSection, c.importSettingsSection, c.aiToolsSection].entries()) {
      h.methods.selectSettingsSection(c.settingsNavigationButtons[index]);
      assert.equal(group.hidden, false);
      assert.ok(group.frame.y + group.frame.height + 20 <= c.settingsPage.contentSize.height);
      assert.equal(c.settingsPage.frame.y, 112); assert.equal(c.settingsPage.frame.height, 208);
    }
  }
});

test('标题栏只在两侧空白处拖动和双击复位，导航与关闭按钮不挂拖动手势', () => {
  const h = mountedPanel(), c = h.controller;
  for (const width of [304, 390, 920]) {
    c.view.frame = { x: 20, y: 20, width, height: 400 }; h.methods.viewDidLayoutSubviews();
    const nav = c.mainNavigation.frame, close = c.closeButton.frame;
    for (const region of c.titleBarDragRegions) {
      const frame = region.frame;
      assert.ok(frame.x + frame.width <= nav.x || frame.x >= nav.x + nav.width);
      assert.ok(frame.x + frame.width <= close.x);
      assert.equal(region.gestures[0].action, 'movePanel:');
      const tap = region.gestures[1]; assert.equal(tap.action, 'resetPanelOnDoubleTap:');
      assert.equal(tap.numberOfTapsRequired, 2); assert.equal(tap.failureRequirement, region.gestures[0]);
    }
    assert.equal(c.titleBar.gestures.length, 0);
    for (const button of [...c.mainNavigationButtons, c.closeButton]) assert.equal(button.gestures.length, 0);
  }
  c.view.superview = { bounds: { width: 1024, height: 800 } };
  h.methods.resetPanelOnDoubleTap({ state: 1 }); assert.equal(c.view.frame.width, 920);
  h.methods.resetPanelOnDoubleTap({ state: 3 });
  assert.deepEqual({ ...c.view.frame }, { x: 22, y: 60, width: 980, height: 680 });
  assert.deepEqual(JSON.parse(h.native.preference('frame', '{}')), { x: 22, y: 60, width: 980, height: 680 });
  assert.equal(c.webView.frame.y, 44);
});

function enableNavigationAnimations(h) {
  h.context.CABasicAnimation = { animationWithKeyPath: path => ({ path }) };
  h.context.CAMediaTimingFunction = { functionWithControlPoints: (...points) => points };
  h.context.CATransaction = { begin() {}, commit() {}, setAnimationDuration() {} };
}

test('拖动允许越过四边且不改变尺寸，结束手势时保存实际位置', () => {
  const h = mountedPanel(), c = h.controller;
  const parent = { bounds: { width: 1024, height: 800 } }; c.view.superview = parent;
  for (const delta of [{ x: -200, y: 0 }, { x: 200, y: 0 }, { x: 0, y: -100 }, { x: 0, y: 100 }]) {
    const start = { x: 22, y: 60, width: 980, height: 680 }; c.view.frame = start;
    const beforeSave = h.native.preference('frame', ''), content = { ...c.webView.frame };
    let translation = delta;
    const gesture = { state: 2, translationInView(view) { assert.equal(view, parent); return translation; }, setTranslationInView(point, view) { assert.equal(view, parent); translation = point; } };
    h.methods.movePanel(gesture);
    const expected = { ...start, x: start.x + delta.x, y: start.y + delta.y };
    assert.deepEqual({ ...c.view.frame }, expected);
    assert.deepEqual({ ...translation }, { x: 0, y: 0 });
    assert.deepEqual({ ...c.webView.frame }, content); assert.equal(h.native.preference('frame', ''), beforeSave);
    gesture.state = 3; h.methods.movePanel(gesture);
    assert.deepEqual(JSON.parse(h.native.preference('frame', '{}')), expected);
    assert.deepEqual({ ...c.view.frame }, expected);
  }
});

test('屏幕边缘或屏幕外缩放固定左上角，尺寸仍遵守最小值和学习窗口上限', () => {
  const h = mountedPanel(), c = h.controller;
  c.view.superview = { bounds: { width: 1024, height: 800 } };
  for (const origin of [{ x: -30, y: -20 }, { x: 0, y: 0 }, { x: 350, y: 600 }]) {
    c.view.frame = { ...origin, width: 800, height: 500 };
    let translation = { x: 1, y: 1 };
    const gesture = { state: 3, translationInView: () => translation, setTranslationInView(point) { translation = point; } };
    h.methods.resizePanel(gesture);
    assert.deepEqual({ ...c.view.frame }, { ...origin, width: 801, height: 501 });
    assert.deepEqual({ ...translation }, { x: 0, y: 0 });
    assert.deepEqual(JSON.parse(h.native.preference('frame', '{}')), { ...c.view.frame });
    assert.equal(c.webView.frame.width, 801); assert.equal(c.webView.frame.height, 501 - 44);
    translation = { x: 10000, y: 10000 }; h.methods.resizePanel(gesture);
    assert.deepEqual({ ...c.view.frame }, { ...origin, width: 1008, height: 784 });
    translation = { x: -10000, y: -10000 }; h.methods.resizePanel(gesture);
    assert.deepEqual({ ...c.view.frame }, { ...origin, width: 360, height: 340 });
  }
});

test('移出屏幕后重新打开恢复可见位置，双击重置恢复 980×680 且不重载网页', async () => {
  const h = mountedPanel(), c = h.controller;
  const parent = { bounds: { width: 1024, height: 800 }, subviews: [], addSubview(view) { this.subviews.push(view); view.superview = this; } };
  const app = h.context.Application.sharedInstance(), study = app.studyController(c.addon.window);
  study.view = parent; study.refreshAddonCommands = () => {};
  app.studyController = () => study; h.context.Application.sharedInstance = () => app;
  c.view.superview = parent; c.view.frame = { x: -178, y: -100, width: 980, height: 680 };
  h.native.savePreference('frame', JSON.stringify(c.view.frame));
  h.panel.hide(c); h.panel.show(c); await tick();
  const reopened = c.view.frame;
  assert.ok(reopened.x >= 8 && reopened.y >= 8);
  assert.ok(reopened.x + reopened.width <= 1016 && reopened.y + reopened.height <= 792);
  const requests = c.webView.requests.length, page = c.activePage;
  c.view.frame = { x: 500, y: 600, width: 800, height: 500 };
  h.methods.resetPanelOnDoubleTap({ state: 3 });
  assert.deepEqual({ ...c.view.frame }, { x: 22, y: 60, width: 980, height: 680 });
  assert.deepEqual(JSON.parse(h.native.preference('frame', '{}')), { ...c.view.frame });
  assert.equal(c.activePage, page); assert.equal(c.webView.requests.length, requests);
});

test('连续切换导航从呈现层位置继续，缩放、离开设置和关闭窗口清理动画', () => {
  const h = mountedPanel(), c = h.controller; enableNavigationAnimations(h);
  const app = h.context.Application.sharedInstance(), study = app.studyController(c.addon.window);
  study.refreshAddonCommands = () => {}; app.studyController = () => study; h.context.Application.sharedInstance = () => app;
  h.methods.openImport();
  const indicator = c.mainNavigationIndicator;
  assert.equal(indicator.layer.animations.size, 1);
  indicator.layer.presentation = { position: { x: 120 } };
  h.methods.openSettings();
  assert.equal([...indicator.layer.animations.values()][0].fromValue, 120);
  const slider = c.settingsNavigationSlider;
  h.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
  slider.layer.presentation = { position: { x: 250 } };
  h.methods.selectSettingsSection(c.settingsNavigationButtons[2]);
  assert.equal([...slider.layer.animations.values()][0].fromValue, 250);
  assert.equal(c.aiToolsSection.layer.animations.size, 1);
  h.methods.openMath();
  assert.equal(slider.layer.animations.size, 0); assert.equal(c.aiToolsSection.layer.animations.size, 0);
  c.view.frame = { x: 0, y: 0, width: 390, height: 400 }; h.methods.viewDidLayoutSubviews();
  assert.equal(indicator.layer.animations.size, 0);
  h.methods.openSettings(); h.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
  h.methods.closePanel();
  assert.equal(indicator.layer.animations.size, 0); assert.equal(slider.layer.animations.size, 0);
  assert.equal(c.importSettingsSection.layer.animations.size, 0);
});

test('动画接口缺失或执行失败时仍可切换页面、分类和显示设置', () => {
  const h = mountedPanel(), c = h.controller; enableNavigationAnimations(h);
  delete c.mainNavigationIndicator.layer.addAnimationForKey;
  h.methods.openSettings(); assert.equal(c.activePage, 'settings');
  h.context.CABasicAnimation.animationWithKeyPath = () => { throw new Error('当前宿主不支持动画'); };
  h.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
  assert.equal(c.settingsSection, 'card'); assert.equal(c.importSettingsSection.hidden, false);
  assert.equal(c.settingsNavigationSlider.frame.x, c.settingsNavigationButtons[1].frame.x);
  h.methods.chooseSourceCommentDisplay(); assert.equal(c.cardLocationModeChoice.overlay.frame.y, 44);
});

test('切换设置分类关闭选择弹层，并停止旧分类的评论管理反馈', async () => {
  const h = mountedPanel(), c = h.controller; h.methods.openSettings();
  h.methods.chooseCardLocationMode(); assert.ok(c.cardLocationModeChoice);
  h.methods.selectSettingsSection(c.settingsNavigationButtons[1]); assert.equal(c.cardLocationModeChoice, null);
  let finish, active;
  h.context.__JFJC_COMMENT_FOLD__.batch = (addon, collapsed, progress, isActive) => {
    active = isActive; return new Promise(resolve => { finish = resolve; });
  };
  const task = h.context.__JFJC_SETTINGS__.foldExisting(c, true); assert.equal(active(), true);
  h.methods.selectSettingsSection(c.settingsNavigationButtons[2]);
  assert.equal(active(), false); assert.equal(c.commentFoldOperation, null);
  const messages = h.hud.length;
  finish({ changed: 1, unchanged: 0, failed: [] }); await task; assert.equal(h.hud.length, messages);
});

function legacyRepairCard(h) {
  const note = h.database.createNoteWithTitleTopicid('旧题卡', 'book-1');
  note.comments.push({ text: '题干\n\n<!-- JFJC_QUESTION:237:5074 -->\n\n<!-- JFJC_ORDER:1 -->' });
  return note;
}

test('打开及重新显示面板、切换设置不统计或改写旧题卡', async () => {
  const h = mountedPanel(), c = h.controller, note = legacyRepairCard(h), original = JSON.stringify(note.comments);
  const app = h.context.Application.sharedInstance(), study = app.studyController(c.addon.window);
  study.view = { bounds: { width: 1024, height: 800 }, subviews: [], addSubview(view) { this.subviews.push(view); view.superview = this; } };
  study.refreshAddonCommands = () => {}; app.studyController = () => study; h.context.Application.sharedInstance = () => app;
  h.context.__JFJC_SOURCE__.repair = () => { throw new Error('不应自动修复'); };
  h.panel.show(c); h.methods.openSettings(); h.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
  h.methods.openMath(); h.panel.hide(c); h.panel.show(c); await tick();
  assert.equal(JSON.stringify(note.comments), original); assert.equal(h.snapshots.length, 0);
  assert.ok(!h.hud.some(text => /不应自动/.test(text)));
});

test('点击修复按钮直接调用原修复逻辑，保留个人评论且可撤销', () => {
  const h = mountedPanel(), c = h.controller, note = legacyRepairCard(h);
  note.comments.push({ text: '个人笔记' }); const original = note.comments.map(comment => comment.text);
  h.methods.openSettings(); h.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
  assert.equal(c.repairCardsButton.action, 'repairImportedCards:');
  h.methods.repairImportedCards();
  assert.equal(note.comments[0].text, '题干'); assert.equal(note.comments[2].text, '个人笔记');
  assert.doesNotMatch(note.comments[1].text, /ORDER:|SOURCE:/); assert.match(h.hud.at(-1), /已完成 1 项修复/);
  assert.ok(!c.cardRepairState); assert.ok(!c.cardLocationModeChoice);
  h.methods.repairImportedCards(); assert.match(h.hud.at(-1), /无需修复/);
  h.undo(); assert.deepEqual(h.notes.get(note.noteId).comments.map(comment => comment.text), original);
});

test('导入或折叠期间修复按钮不执行，原逻辑出错时显示失败提示', () => {
  const h = mountedPanel(), c = h.controller, note = legacyRepairCard(h), original = JSON.stringify(note.comments);
  h.methods.openSettings(); h.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
  for (const busy of ['previewing', 'panelOperation', 'uploadOperation', 'cardLocationRequest', 'commentFoldOperation', 'session']) {
    c[busy] = busy === 'session' ? { running: true } : {};
    h.methods.repairImportedCards(); assert.equal(JSON.stringify(note.comments), original); assert.match(h.hud.at(-1), /请先完成/);
    c[busy] = null;
  }
  h.context.__JFJC_SOURCE__.repair = () => { throw new Error('模拟修复失败'); };
  h.methods.repairImportedCards(); assert.match(h.hud.at(-1), /修复未完成：模拟修复失败/);
});

test('修复行沿用原设置布局，AI 工具紧挨题卡工具右侧', () => {
  const h = mountedPanel(), c = h.controller;
  h.methods.openSettings(); h.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
  assert.deepEqual(Array.from(c.settingsNavigationButtons, button => button.title), ['题目工具', '题卡工具', 'AI 工具']);
  for (const width of [304, 390, 600, 920]) {
    c.view.frame = { x: 0, y: 0, width, height: 340 }; h.methods.viewDidLayoutSubviews();
    const row = c.repairCardsButton.frame, section = c.importSettingsSection.frame;
    assert.ok(row.y >= c.sourceCommentButton.frame.y + c.sourceCommentButton.frame.height);
    assert.ok(row.y + row.height <= section.height); assert.ok(section.height <= c.settingsPage.contentSize.height);
  }
});
