import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { nativeHost, browserHost, source, tick, envelope, reviewPageHTML } from './helpers.mjs';
import { pageScriptSource } from '../scripts/web-bundle.mjs';

function locatorHost() {
  const h = nativeHost(), events = [], addon = { window: {} }, books = new Map([['book-1', h.notebook]]);
  const study = { notebookController: { notebookId: 'book-1', changeFocusToNote(note) { events.push(['focus', note.noteId]); } },
    focusNoteInMindMapById(id) { events.push(['native-locate', id]); }, refreshAddonCommands() {},
    view: { bounds: { width: 1024, height: 800 }, addSubview(view) { view.superview = this; } } };
  const app = { studyController(window) { assert.equal(window, addon.window); return study; }, showHUD(text) { h.hud.push(text); },
    openURL(url) { events.push(['open', url.absoluteString]); study.notebookController.notebookId = 'book-2'; } };
  h.context.Application.sharedInstance = () => app;
  h.context.NSURL = { URLWithString: url => ({ absoluteString: url }) };
  h.context.MNUtil.currentWindow = addon.window;
  h.context.MNUtil.focusNoteInMindMapById = id => events.push(['utils-locate', id]);
  h.database.getNotebookById = id => books.get(id);
  h.database.allNotebooks = () => [...books.values()];
  const controller = { addon, activePage: 'math', visible: true,
    webView: { evaluateJavaScript(code, callback) { callback(code.includes('?"accepted":"rejected"') ? 'accepted' : true, null); } },
    view: { frame: { x: 0, y: 0, width: 920, height: 680 }, removeFromSuperview() { this.superview = null; } } };
  addon.panelController = controller;
  const methods = {};
  h.context.JSB = { defineClass(name, body) { Object.assign(methods, body); return { new() { return {}; } }; } };
  vm.runInContext(source('src/WebPanelController.js'), h.context);
  const locator = h.context.__JFJC_CARD_LOCATOR__, target = { paperId: 237, questionId: 5074, route: '/papers/237' };
  function card(paper = 237, question = 5074, book = 'book-1') {
    const note = h.database.createNoteWithTitleTopicid('同一个题卡标题', 'book-1');
    note.comments = [{ text: '完整题干\n\n<!-- JFJC_QUESTION:' + paper + ':' + question + ' -->\n<!-- JFJC_ORDER:1 -->' }];
    note.notebookId = book;
    if (book !== 'book-1') {
      if (!books.has(book)) books.set(book, { topicId: book, title: '其他学习集', notes: [] });
      books.get(book).notes.push(note);
    }
    h.notebook.notes = [...h.notes.values()].filter(n => n.notebookId === 'book-1' && !n.parentNote);
    return note;
  }
  return { ...h, addon, controller, locator, study, app, books, card, events, target, methods, panel: h.context.__JFJC_PANEL__ };
}
const valid = async () => {};

test('从真实 QUESTION 标记定位，不要求原题链接，默认聚焦后通过 MN Utils 定位', async () => {
  const h = locatorHost(), card = h.card();
  const result = await h.locator.locate(h.addon, h.target, valid);
  assert.equal(result.noteId, card.noteId);
  assert.deepEqual(h.events, [['focus', card.noteId], ['utils-locate', card.noteId]]);
  assert.equal(h.addon.__jfjcCardLocation, null);
  assert.equal(card.comments.length, 1);
});

test('仅定位不改变焦点，多窗口不会使用绑定其他窗口的 MN Utils 定位', async () => {
  const h = locatorHost(), card = h.card(); h.locator.setMode('locate');
  h.context.MNUtil.currentWindow = {};
  await h.locator.locate(h.addon, h.target, valid);
  assert.deepEqual(h.events, [['native-locate', card.noteId]]);
  assert.equal(h.context.__JFJC_SETTINGS__.cardLocationMode(), 'locate');
  assert.throws(() => h.locator.setMode('other'), /方式无效/);
});

test('当前学习集优先，原卷身份优先，同题的单题导入也能匹配', async () => {
  const h = locatorHost(); h.card(238); const current = h.card(); h.card(237, 5074, 'book-2');
  let scans = 0; h.database.allNotebooks = () => { scans++; return [...h.books.values()]; };
  await h.locator.locate(h.addon, h.target, valid);
  assert.equal(h.events.at(-1)[1], current.noteId); assert.equal(scans, 0);
  const single = locatorHost(), imported = single.card(0);
  await single.locator.locate(single.addon, single.target, valid);
  assert.equal(single.events.at(-1)[1], imported.noteId);
});

test('多张匹配卡片提供选择，删除、移动或身份变化不定位失效卡片', async () => {
  for (const mutation of ['choose', 'delete', 'move', 'identity']) {
    const h = locatorHost(); h.card(); const selected = h.card();
    h.context.__JFJC_CARD_LOCATOR_UI__.choose = async (controller, candidates) => {
      assert.equal(candidates.length, 2); assert.equal(candidates[1].studySetTitle, '我的学习集');
      if (mutation === 'delete') h.notes.delete(selected.noteId);
      if (mutation === 'move') selected.notebookId = 'book-2';
      if (mutation === 'identity') selected.comments[0].text = '<!-- JFJC_QUESTION:237:5075 -->';
      return candidates[1];
    };
    if (mutation === 'choose') { const result = await h.locator.locate(h.addon, h.target, valid); assert.equal(result.noteId, selected.noteId); }
    else { await assert.rejects(h.locator.locate(h.addon, h.target, valid), /不存在|移动|来源已变化/); assert.equal(h.events.length, 0); }
  }
});

test('找不到当前学习集题卡时查其他学习集，用官方卡片链接切换后再定位', async () => {
  const h = locatorHost(), card = h.card(237, 5074, 'book-2');
  await h.locator.locate(h.addon, h.target, valid);
  assert.deepEqual(h.events, [['open', 'marginnote4app://note/' + card.noteId], ['focus', card.noteId], ['utils-locate', card.noteId]]);
});

test('跨学习集切换只保留自身定位，打开学习集后恢复；超时不聚焦旧学习集', async () => {
  const h = locatorHost(); h.card(237, 5074, 'book-2');
  const timers = [];
  h.context.NSTimer.scheduledTimerWithTimeInterval = (seconds, repeats, callback) => {
    const timer = { seconds, active: true, invalidate() { this.active = false; }, fire() { if (this.active) callback(); } }; timers.push(timer);
    if (seconds < 1) queueMicrotask(() => timer.fire());
    return timer;
  };
  h.app.openURL = () => {
    assert.equal(h.locator.switching(h.addon), true);
    h.transport.cancel(h.controller, true);
    assert.ok(h.addon.__jfjcCardLocation);
    h.study.notebookController.notebookId = 'book-2'; h.locator.resume(h.addon);
  };
  await h.locator.locate(h.addon, h.target, valid);
  assert.equal(h.events[0][0], 'focus');
  const stalled = locatorHost(); stalled.card(237, 5074, 'book-2');
  stalled.app.openURL = () => {};
  stalled.context.NSTimer.scheduledTimerWithTimeInterval = (seconds, repeats, callback) => {
    const timer = { invalidate() { this.cancelled = true; } };
    if (seconds === 10) queueMicrotask(() => { if (!timer.cancelled) callback(); }); return timer;
  };
  await assert.rejects(stalled.locator.locate(stalled.addon, stalled.target, valid), /切换目标学习集超时/);
  assert.equal(stalled.events.length, 0); assert.equal(stalled.addon.__jfjcCardLocation, null);
});

test('没有标记、标记冲突、缺少 MN Utils、题目已切换均明确失败', async () => {
  const h = locatorHost(), card = h.card();
  card.comments[0].text += '\n<!-- JFJC_QUESTION:238:999 -->';
  await assert.rejects(h.locator.locate(h.addon, h.target, valid), /没有这道题/);
  assert.equal(h.locator.identity(card), null);
  card.comments[0].text = '<!-- JFJC_QUESTION:237:5074 -->\n<!-- JFJC_QUESTION:9007199254740993:5074 -->';
  assert.equal(h.locator.identity(card), null);
  card.comments[0].text = '同名题目，无来源标记';
  await assert.rejects(h.locator.locate(h.addon, h.target, valid), /没有这道题/);
  card.comments[0].text = '<!-- JFJC_QUESTION:237:5074 -->';
  await assert.rejects(h.locator.locate(h.addon, h.target, async () => { throw new Error('题目已切换'); }), /题目已切换/);
  delete h.context.MNUtil.focusNoteInMindMapById;
  await assert.rejects(h.locator.locate(h.addon, h.target, valid), /MN Utils/);
  assert.equal(h.events.length, 0);
});

test('正在定位时不重复执行，关闭、取消或扫描中换学习集能停止定位', async () => {
  const h = locatorHost(); h.card(); let resolve;
  const pending = h.locator.locate(h.addon, h.target, () => new Promise(r => { resolve = r; }));
  await tick();
  await assert.rejects(h.locator.locate(h.addon, h.target, valid), /正在定位/);
  h.transport.cancel(h.controller);
  await assert.rejects(pending, /取消定位/); resolve(); await tick(); assert.equal(h.events.length, 0);
  const moved = locatorHost();
  for (let i = 0; i < 151; i++) moved.card(237, i + 1);
  moved.context.NSTimer.scheduledTimerWithTimeInterval = (seconds, repeats, callback) => {
    const id = setTimeout(() => { if (seconds === .001) moved.study.notebookController.notebookId = 'book-2'; callback(); }, seconds < 1 ? 0 : seconds * 1000);
    return { invalidate() { clearTimeout(id); } };
  };
  await assert.rejects(moved.locator.locate(moved.addon, moved.target, valid), /学习集已切换/);
});

function webCard(browser, id) {
  browser.document.body.innerHTML = '<article class="question-card" id="question-' + id + '"><div class="question-card-head"><div class="question-card-title-block"><div class="question-card-meta-line"><div class="question-label">第 01 题</div></div></div><button>加入选题篮</button></div><p>题干和公式</p></article>';
}
function tools(browser) { return browser.window.__JFJC_QUESTION_TOOLS__; }

test('试卷题号旁只注入一个定位按钮，关闭开关即时删除，重复注入不复制', () => {
  const b = browserHost(); webCard(b, 5074); tools(b).configure({ enabled: true });
  const button = b.document.querySelector('.jfjc-locate-card');
  assert.equal(button.parentNode.className, 'question-card-meta-line');
  assert.equal(button.textContent, '定位卡片');
  vm.runInContext(pageScriptSource(), b.context); tools(b).refresh();
  assert.equal(b.document.querySelectorAll('.jfjc-locate-card').length, 1);
  assert.equal(tools(b).matches({ paperId: 237, questionId: 5074, route: '/papers/237' }), true);
  tools(b).configure({ enabled: false }); assert.equal(b.document.querySelector('.jfjc-locate-card'), null);
  assert.equal(tools(b).matches({ paperId: 237, questionId: 5074, route: '/papers/237' }), false);
});

test('题目详情和真实复盘题目可定位，普通对话与未知上下文不注入', async () => {
  const b = browserHost(); b.location.pathname = '/questions/5074'; webCard(b, 5074); tools(b).configure({ enabled: true });
  assert.equal(tools(b).matches({ paperId: 0, questionId: 5074, route: '/questions/5074' }), true);
  b.location.pathname = '/assistant/conversations/thread/review';
  b.document.body.innerHTML = reviewPageHTML(5519, 29894);
  await new Promise(r => setTimeout(r, 70));
  assert.equal(b.document.querySelectorAll('.jfjc-locate-card').length, 1);
  const original = b.document.querySelector('.jfjc-locate-card').__jfjcTarget;
  assert.equal(original.questionId, 5519); assert.equal(tools(b).matches(original), true);
  b.document.body.innerHTML = reviewPageHTML(5605, 29895);
  await new Promise(r => setTimeout(r, 70));
  assert.equal(tools(b).matches(original), false);
  const current = b.document.querySelector('.jfjc-locate-card').__jfjcTarget;
  assert.equal(current.questionId, 5605); assert.equal(tools(b).matches(current), true);
  b.location.pathname = '/assistant/conversations/thread/solve'; tools(b).refresh();
  assert.equal(b.document.querySelector('.jfjc-locate-card'), null);
});

test('实际网页按钮经过原生命令校验、数据库匹配与定位，成功后关闭面板', async () => {
  const b = browserHost(), h = locatorHost(), model = h.adapter.normalize(envelope()), entry = model.entries[0];
  const prepared = h.format.format(entry, model.paper, { images: { 369: 'data:image/png;base64,aGVsbG8=' }, inlineImages: {} }, true, false);
  const card = h.importer.write(h.native.context(h.addon), model.paper, entry, prepared, null, false).note;
  assert.equal(card.comments.length, 2); assert.doesNotMatch(card.comments[0].text, /<!-- JFJC_|查看原题/);
  assert.match(card.comments[1].text, /^\[查看原题\]\([^)]+\)\n\n<!-- JFJC_QUESTION:237:5074 -->/);
  webCard(b, 5074); tools(b).configure({ enabled: true });
  h.controller.webView.evaluateJavaScript = (code, callback) => { try { const value = vm.runInContext(code, b.context); callback(value === true ? 1 : value, null); } catch (error) { callback(null, error); } };
  b.document.querySelector('.jfjc-locate-card').click();
  const address = b.frames.find(url => url.includes('://locate-card?'));
  assert.equal(h.panel.command(h.controller, address), true);
  for (let i = 0; i < 30 && h.controller.visible; i++) await tick();
  assert.equal(h.controller.visible, false); assert.equal(h.controller.view.hidden, true);
  assert.deepEqual(h.events, [['focus', card.noteId], ['utils-locate', card.noteId]]);
  assert.equal(b.document.querySelector('.jfjc-locate-card').disabled, false);
  assert.equal(h.controller.cardLocationRequest, null);
});

test('WebView 将有效布尔值桥接为字符串 1 时，原页重复点击仍应能定位', async () => {
  const b = browserHost(), h = locatorHost(), card = h.card(); webCard(b, 5074); tools(b).configure({ enabled: true });
  h.controller.webView.evaluateJavaScript = (code, callback) => {
    try { const value = vm.runInContext(code, b.context); callback(typeof value === 'boolean' ? (value ? '1' : '0') : value, null); }
    catch (error) { callback(null, error); }
  };
  for (let attempt = 0; attempt < 2 && h.controller.visible; attempt++) {
    assert.equal(tools(b).matches(h.target), true);
    b.document.querySelector('.jfjc-locate-card').click();
    const address = b.frames.filter(url => url.includes('://locate-card?')).at(-1);
    assert.equal(h.panel.command(h.controller, address), true);
    for (let i = 0; i < 30 && h.controller.cardLocationRequest; i++) await tick();
    assert.equal(tools(b).matches(h.target), true);
  }
  assert.equal(h.hud.includes('当前网页或题目已切换，请重新点击定位卡片'), false, '题目没有切换，两次点击却都被相同提示拒绝');
  assert.equal(h.controller.visible, false); assert.equal(h.events.at(-1)?.[1], card.noteId);
});

test('原生 NSString 和 NSNumber 桥接不会误判有效题目，也不会放过已经换题的请求', async () => {
  for (const requested of [5074, 5075]) {
    const b = browserHost(), h = locatorHost(); h.card(); webCard(b, 5074); tools(b).configure({ enabled: true });
    h.controller.webView.evaluateJavaScript = (code, callback) => {
      try {
        const value = vm.runInContext(code, b.context);
        const text = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
        callback({ toString() { return text; } }, null);
      } catch (error) { callback(null, error); }
    };
    await h.panel.locateCard(h.controller, 'jfjc-locate-native-value', { ...h.target, questionId: requested });
    if (requested === 5074) { assert.equal(h.controller.visible, false); assert.equal(h.events.length, 2); }
    else { assert.equal(h.controller.visible, true); assert.equal(h.events.length, 0); assert.match(h.hud.at(-1), /当前网页或题目已切换/); }
  }
});

test('伪造目标、过时请求与网页换题不会定位；当前 token 才能取消', async () => {
  const b = browserHost(), h = locatorHost(); h.card(); webCard(b, 5074); tools(b).configure({ enabled: true });
  h.controller.webView.evaluateJavaScript = (code, cb) => cb(vm.runInContext(code, b.context), null);
  const command = (target, token = 'jfjc-locate-test') => 'jifengjincaobridge://locate-card?token=' + token + '&scope=' + encodeURIComponent(JSON.stringify(target));
  for (const target of [{ ...h.target, questionId: -1 }, { ...h.target, questionId: '5074' }, { ...h.target, paperId: null }, { ...h.target, route: 1 }]) assert.equal(h.panel.command(h.controller, command(target)), false);
  assert.equal(h.panel.command(h.controller, command(h.target, 'invalid')), false);
  await h.panel.locateCard(h.controller, 'jfjc-locate-test', { ...h.target, questionId: 5075 });
  assert.equal(h.events.length, 0); assert.match(h.hud.at(-1), /网页或题目已切换/);
  b.document.querySelector('.jfjc-locate-card').click();
  const address = b.frames.find(url => url.includes('://locate-card?')); const token = new URL(address).searchParams.get('token');
  h.controller.cardLocationRequest = { token };
  assert.equal(h.panel.command(h.controller, 'jifengjincaobridge://cancel-locate?token=old&scope='), false);
  b.location.pathname = '/papers/238'; tools(b).refresh();
  const cancel = b.frames.find(url => url.includes('://cancel-locate?'));
  assert.equal(h.panel.command(h.controller, cancel), true); assert.equal(h.controller.cardLocationRequest, null);
  assert.equal(h.events.length, 0);
});
