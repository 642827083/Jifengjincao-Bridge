import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { nativeHost, source, tick } from './helpers.mjs';

function panel() {
  const h=nativeHost();const classes={};h.context.JSB={defineClass(name,methods){classes[name]=methods;return{new(){return{};}}}};
  vm.runInContext(source('src/WebPanelController.js'),h.context);
  return {...h,panel:h.context.__JFJC_PANEL__,methods:classes['JifengjincaoBridgePanelController : UIViewController <UIWebViewDelegate>']};
}
function mountedPanel() {
  const h = panel();
  class View {
    constructor(frame) { this.frame = frame; this.layer = {}; this.subviews = []; this.hidden = false; }
    get bounds() { return { x: 0, y: 0, width: this.frame.width, height: this.frame.height }; }
    addSubview(view) { this.subviews.push(view); view.superview = this; }
    removeFromSuperview() { if (this.superview) this.superview.subviews = this.superview.subviews.filter(view => view !== this); this.superview = null; }
    addGestureRecognizer() {}
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
    loadHTMLStringBaseURL(html, base) { this.html = html; this.base = base; }
    evaluateJavaScript(code, callback) {
      this.scripts.push(code);
      if (code.includes('__JFJC_READINESS__')) return callback(JSON.stringify({ origin: 'https://bbkaoyan.cn', route: '/papers/237', ready: 'complete', content: true }), null);
      callback(code.includes('JSON.stringify(window.__JFJC_PAGE__.context())') ? '{"paperId":237}' : 'injected', null);
    }
  }
  Object.assign(h.context, {
    UIView: View, UILabel: View, UIScrollView: View, UIButton: Button, UISwitch: Button, UIWebView: WebView,
    UIPanGestureRecognizer: class {},
    __JFJC_PAGE_SCRIPT__: '',
    __JFJC_IMPORT_HTML__: '<html>导入页面</html>',
    UIFont: { systemFontOfSize: size => ({ size }), boldSystemFontOfSize: size => ({ size, bold: true }) },
    UIColor: { whiteColor: () => 'white', grayColor: () => 'gray', darkGrayColor: () => 'darkgray', lightGrayColor: () => 'lightgray',
      colorWithWhiteAlpha: (white, alpha) => ({ white, alpha }), colorWithRedGreenBlueAlpha: (red, green, blue, alpha) => ({ red, green, blue, alpha }) },
    NSURL: { URLWithString: url => ({ absoluteString: url }) }, NSURLRequest: { requestWithURL: url => ({ URL: url }) }
  });
  const controller = { addon: { window: {} } }; h.context.self = controller; h.methods.viewDidLoad();
  return { ...h, controller };
}
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
  h.context.__JFJC_CLIPBOARD__.start=async (owner,item)=>calls.push([owner,item]);
  assert.equal(h.panel.command(controller,'jifengjincaobridge://paste-record?token=&scope=composer-1'),true);
  assert.equal(calls[0][1],'composer-1');
  for(const scope of ['0','-1','5519','composer-0','composer-1%26url%3Devil','composer-1000000000']) assert.equal(h.panel.command(controller,'jifengjincaobridge://paste-record?token=&scope='+scope),false);
  assert.equal(h.panel.command(controller,'jifengjincaobridge://paste-record?token=other&scope=composer-1'),false);
  controller.clipboardOperation={token:'clipboard'}; h.context.self=controller;
  const request={URL:{absoluteString:'https://bbkaoyan.cn/papers'},mainDocumentURL:{absoluteString:'https://bbkaoyan.cn/papers'}};
  h.methods.webViewShouldStartLoadWithRequestNavigationType(controller.webView,request,0);
  assert.equal(controller.clipboardOperation,null);
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
    assert.equal(f.close.width,44);assert.equal(f.close.height,36);assert.equal(f.close.y,0);
    assert.ok(f.math.x>=0&&f.settings.x+f.settings.width<=f.close.x);
    assert.equal((f.math.x+f.settings.x+f.settings.width)/2,width/2);
    assert.ok(f.math.x+f.math.width<f.imports.x&&f.imports.x+f.imports.width<f.settings.x);
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
  for (const [width, height] of [[304, 340], [920, 680]]) { c.view.frame = { x: 0, y: 0, width, height }; h.methods.viewDidLayoutSubviews(); assert.equal(local.frame.width, width); assert.equal(local.frame.height, height - 36); }
  c.panelOperation = 'loadPaper'; h.methods.openMath(); assert.equal(c.activePage, 'import');
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
  assert.equal(h.panel.command(c, 'jifengjincaobridge://paste-record?token=&scope=composer-1'), false);
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

test('读取或导入期间切换设置被拒绝，空闲预览捕获知识点设置', async () => {
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
  assert.equal(c.importSettingsTitle.text, '题卡设置');
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
    assert.ok(section.y + section.height < c.importSettingsSection.frame.y);
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
    assert.equal(section.height - c.importSettingsSection.frame.height, 3 * (title.y - c.showLocateCardTitle.frame.y));
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

test('设置包含题目工具、AI 工具和题卡设置，网页诊断及辅助分组已移除', () => {
  const h = mountedPanel(), c = h.controller;
  assert.equal(h.context.__JFJC_WEB_DIAGNOSTICS__, undefined);
  assert.equal(c.supportSettingsSection, undefined); assert.equal(c.webDiagnosticPanel, undefined);
  assert.equal(h.methods.toggleWebDiagnostics, undefined);
  h.methods.openSettings();
  for (const width of [304, 390, 600, 920]) {
    c.view.frame = { x: 0, y: 0, width, height: 400 }; h.methods.viewDidLayoutSubviews();
    const card = c.importSettingsSection.frame;
    assert.equal(card.width, c.questionToolsSection.frame.width);
    assert.equal(card.width, c.aiToolsSection.frame.width);
    assert.ok(card.y + card.height + 18 <= c.settingsPage.contentSize.height);
  }
});

test('显示粘贴默认开启，开关独立保存并在重新打开和原生配置回退时恢复', async () => {
  const h = mountedPanel(), c = h.controller;
  assert.equal(c.aiToolsTitle.text, 'AI 工具'); assert.equal(c.showPasteTitle.text, '显示粘贴');
  assert.equal(c.showPasteSwitch.on, true); assert.equal(c.showPasteSwitch.action, 'toggleShowPaste:');
  c.showPasteSwitch.on = false; h.methods.toggleShowPaste(c.showPasteSwitch); await tick();
  assert.equal(h.context.__JFJC_SETTINGS__.showPaste(), false);
  assert.equal(h.context.__JFJC_SETTINGS__.showLocateCard(), true); assert.equal(h.context.__JFJC_SETTINGS__.importTopics(), true);
  assert.ok(c.webView.scripts.some(code => code.includes('__JFJC_REVIEW__.configure({enabled:false})')));
  const reopened = { addon: c.addon }; h.context.self = reopened; h.methods.viewDidLoad();
  assert.equal(reopened.showPasteSwitch.on, false);
  h.context.MNUtil = undefined;
  reopened.showPasteSwitch.on = true; h.methods.toggleShowPaste(reopened.showPasteSwitch); await tick();
  h.context.__JFJC_SETTINGS__.refresh(c); assert.equal(c.showPasteSwitch.on, true);
  assert.equal(h.context.__JFJC_SETTINGS__.showPaste(), true);
});

test('AI 工具设置分组等宽、间距一致，窄窗口说明和开关不重叠且可滚动', () => {
  const h = mountedPanel(), c = h.controller;
  for (const [width, height] of [[304,320], [390,540], [599,540], [600,540], [920,680]]) {
    c.view.frame = { x: 0, y: 0, width, height }; h.methods.viewDidLayoutSubviews();
    const tools = c.questionToolsSection.frame, ai = c.aiToolsSection.frame, card = c.importSettingsSection.frame;
    assert.equal(ai.width, tools.width); assert.equal(ai.width, card.width); assert.equal(ai.x, card.x);
    assert.equal(ai.y - (tools.y + tools.height), 18); assert.equal(card.y - (ai.y + ai.height), 18);
    assert.equal(ai.height, card.height);
    const text = c.showPasteDescription.frame, toggle = c.showPasteSwitch.frame;
    assert.ok(text.x + text.width + 12 <= toggle.x || text.y + text.height + 2 <= toggle.y);
    assert.ok(toggle.x + toggle.width <= ai.width); assert.ok(toggle.y + toggle.height <= ai.height);
    assert.ok(text.y + text.height <= ai.height);
    assert.equal(toggle.y, c.importTopicsSwitch.frame.y);
    assert.ok(card.y + card.height + 18 <= c.settingsPage.contentSize.height);
  }
});

test('粘贴开关关闭时忽略旧网页命令，重新开启才允许读取剪贴板', () => {
  const h = panel(), calls = [], c = { addon: { window: {} }, webView: { evaluateJavaScript(code, cb) { cb('cancelled', null); } } };
  h.context.__JFJC_CLIPBOARD__.start = async () => calls.push('paste');
  h.native.savePreference('ai-tools.show-paste', false);
  assert.equal(h.panel.command(c, 'jifengjincaobridge://paste-record?token=&scope=composer-1'), true);
  assert.deepEqual(calls, []);
  h.native.savePreference('ai-tools.show-paste', true);
  assert.equal(h.panel.command(c, 'jifengjincaobridge://paste-record?token=&scope=composer-1'), true);
  assert.deepEqual(calls, ['paste']);
});
