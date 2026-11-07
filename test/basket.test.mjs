import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { browserHost, nativeHost, source, envelope, packet, tick } from './helpers.mjs';
import { pageScriptSource } from '../scripts/web-bundle.mjs';

function question(id, paperId = 251, number = '7', subject = 'math2') {
  return { ...envelope().questions[0].question, id, subject,
    papers: [{ id: paperId, title: '来源试卷 ' + paperId, kind: 'official', question_number: number }] };
}
function basket(questions, responseFor, pathname = '/baskets/42') {
  const b = browserHost(undefined, async (url, options) => {
    if (responseFor) { const response = await responseFor(url, options); if (response) return response; }
    const id = Number(/\/api\/questions\/(\d+)$/.exec(url)?.[1]);
    if (id) return new Response(JSON.stringify(questions.find(q => q.id === id)), { headers: { 'Content-Type': 'application/json' } });
  });
  b.location.pathname = pathname;
  const root = b.document.createElement('section'); root.className = 'page ' + (pathname.startsWith('/public-baskets/') ? 'shared-basket-page' : 'basket-detail-page');
  root.innerHTML = questions.map(q => '<article id="basket-question-' + q.id + '" class="question-card basket-detail-question-card"><div class="question-card-head"><div class="question-card-meta-line"><div class="question-label">序 1</div><button class="question-global-id">#' + q.id + '</button><div class="question-meta">来源信息</div></div><button aria-label="移除题目">移除</button></div><div class="question-stem">题干</div></article>').join('');
  b.document.body.appendChild(root); b.runtime.refresh();
  return { ...b, root };
}
function connect(b) {
  const h = nativeHost(); h.context.JSB = { defineClass() { return { new() { return {}; } }; } };
  vm.runInContext(source('src/WebPanelController.js'), h.context);
  const addon = { window: {} }, c = { addon, visible: true, activePage: 'math',
    webView: { evaluateJavaScript(script, callback) { try { callback(vm.runInContext(script, b.context), null); } catch (error) { callback(null, error); } } } };
  h.native.savePreference('question-tools.show-single-import', true);
  b.window.__JFJC_QUESTION_TOOLS__.configure({ enabled: true, importEnabled: true });
  const parent = h.database.createNoteWithTitleTopicid('练习', 'book-1'); h.notebookController.focusNote = parent;
  return { ...h, c, parent, panel: h.context.__JFJC_PANEL__ };
}

test('选题导入固定在 AI 组件左侧，导航重绘后恢复且不再浮在网页底部', async () => {
  const b = basket([question(5395)]), nav = b.document.querySelector('.primary-nav');
  const toolbar = b.document.getElementById('jfjc-toolbar');
  assert.equal(toolbar.parentNode, nav.parentNode); assert.equal(toolbar.nextElementSibling, nav);
  assert.equal(toolbar.querySelector('button').disabled, false);
  assert.doesNotMatch(b.window.__JFJC_DIALOG_CSS__.split('#jfjc-dialog')[0], /position\s*:\s*fixed|bottom\s*:|box-shadow/);
  vm.runInContext(pageScriptSource(), b.context); assert.equal(b.document.querySelectorAll('#jfjc-toolbar').length, 1);
  const actions = nav.parentNode, replacement = actions.cloneNode(true);
  replacement.querySelector('#jfjc-toolbar').remove(); actions.replaceWith(replacement);
  await new Promise(resolve => setTimeout(resolve, 100));
  const restored = b.document.getElementById('jfjc-toolbar');
  assert.equal(restored.nextElementSibling, replacement.querySelector('.primary-nav'));
  restored.querySelector('button').click(); assert.match(b.frames.at(-1), /preview\?token=&scope=selected$/);
  replacement.remove(); b.runtime.refresh(); assert.equal(b.document.getElementById('jfjc-toolbar'), null);
  assert.equal(b.document.querySelectorAll('#jfjc-dialog').length, 1);
});

test('私人和公开题篮均在全局题号后显示工具，独立开关不影响复制题号或移除题目', () => {
  for (const pathname of ['/baskets/42', '/public-baskets/public-42']) {
    const b = basket([question(5395)], null, pathname), tools = b.window.__JFJC_QUESTION_TOOLS__;
    tools.configure({ enabled: true, importEnabled: true });
    const host = b.root.querySelector('.question-card-meta-line'), number = host.querySelector('.question-global-id');
    assert.equal(number.nextElementSibling.textContent, '定位题目');
    assert.equal(number.nextElementSibling.nextElementSibling.textContent, '导入本题');
    assert.equal(host.lastElementChild.className, 'question-meta');
    const target = host.querySelector('.jfjc-import-single').__jfjcTarget;
    assert.equal(target.questionId, 5395); assert.match(target.snapshot, /^basket-\d+$/);
    assert.equal(tools.matches(target), true); assert.equal(tools.matchesSingle(target), true);
    tools.configure({ enabled: false, importEnabled: true });
    assert.equal(host.querySelector('.jfjc-locate-card'), null); assert.equal(number.nextElementSibling.textContent, '导入本题');
    tools.configure({ enabled: true, importEnabled: false });
    assert.equal(host.querySelector('.jfjc-import-single'), null); assert.equal(number.nextElementSibling.textContent, '定位题目');
    b.location.pathname = '/baskets'; b.runtime.refresh(); tools.refresh();
    assert.equal(b.root.querySelector('.jfjc-locate-card'), null);
    assert.equal(b.document.querySelector('#jfjc-toolbar button').disabled, true);
  }
});

test('题篮批量默认全选，混合来源保留原卷与题号，实际建卡和重复导入一致', async () => {
  const qs = [question(5395), question(5434, 253, '1', 'math1')]; qs[1].papers[0].kind = 'mock';
  const b = basket(qs), h = connect(b);
  for (let attempt = 0; attempt < 2; attempt++) {
    await b.runtime.open('selected', { token: 'test-task', target: '学习集', content: 'questionAnswer' });
    assert.ok(Array.from(b.document.querySelectorAll('input[data-id]')).every(i => i.checked));
    b.document.getElementById('jfjc-commit').click();
    const session = { token: 'test-task', context: h.native.context(h.c.addon), basket: true, cancelled: false, running: false };
    h.c.session = session; const result = await h.importer.run(h.c, session);
    assert.equal(result.created, attempt ? 0 : 2); assert.equal(result.skipped, attempt ? 2 : 0); assert.equal(result.failed.length, 0);
  }
  const cards = [...h.notes.values()].filter(n => n.comments.some(c => c.text.includes('JFJC_QUESTION:')));
  assert.equal(cards.length, 2);
  assert.equal(cards.find(n => n.comments[1].text.includes('JFJC_QUESTION:251:5395')).parentNote.parentNote.noteTitle, '历年真题');
  assert.equal(cards.find(n => n.comments[1].text.includes('JFJC_QUESTION:253:5434')).parentNote.parentNote.noteTitle, '模拟卷');
  assert.ok(cards.some(n => n.noteTitle === '来源试卷 251 · 第 7 题' && n.comments[1].text.includes('JFJC_QUESTION:251:5395')));
  assert.ok(cards.some(n => n.noteTitle === '来源试卷 253 · 第 1 题' && n.comments[1].text.includes('JFJC_QUESTION:253:5434')));
  assert.ok(b.calls.every(call => call.options.credentials === 'include'));
  assert.ok(b.calls.every(call => !call.url.includes('/api/papers/')));
});

test('题篮移除、排序、替换页面或切换题篮后，旧预览不可导入', async () => {
  for (const change of ['remove', 'reorder', 'replace', 'route']) {
    const b = basket([question(5395), question(5434)]);
    await b.runtime.open('selected', { token: 'test-task', target: '学习集', content: 'question' });
    if (change === 'remove') b.root.firstElementChild.remove();
    if (change === 'reorder') b.root.appendChild(b.root.firstElementChild);
    if (change === 'replace') b.root.replaceWith(b.root.cloneNode(true));
    if (change === 'route') b.location.pathname = '/baskets/43';
    const count = b.frames.length; b.document.getElementById('jfjc-commit').click();
    assert.equal(b.frames.length, count); assert.match(b.document.getElementById('jfjc-status').textContent, /已变化|切换/);
  }
});

test('题篮请求途中切换或删除题目会取消读取，无效 ID 和重复卡片不进入选题框', async () => {
  const q = question(5395); let release;
  const b = basket([q], () => new Promise(resolve => { release = resolve; }));
  const opening = b.runtime.open('selected', { token: 'test-task', target: '学习集', content: 'question' });
  await tick(); b.root.firstElementChild.remove();
  release(new Response(JSON.stringify(q), { headers: { 'Content-Type': 'application/json' } })); await opening;
  assert.equal(b.document.getElementById('jfjc-commit'), null);
  const valid = basket([q]);
  valid.root.appendChild(valid.root.firstElementChild.cloneNode(true));
  const bad = valid.root.firstElementChild.cloneNode(true); bad.id = 'basket-question-0'; valid.root.appendChild(bad);
  await valid.runtime.open('selected', { token: 'test-task', target: '学习集', content: 'question' });
  assert.equal(valid.document.querySelectorAll('input[data-id]').length, 1);
  valid.document.getElementById('jfjc-commit').click();
  assert.equal((await packet(valid, () => valid.runtime.begin('test-task'))).envelope.collection, 'basket');
});

test('题篮导入本题实际走单题短命令，写入捕获父卡且替换页面会拒绝旧目标', async () => {
  const q = question(5395), b = basket([q]), h = connect(b);
  const button = b.root.querySelector('.jfjc-import-single'), target = button.__jfjcTarget;
  button.click(); assert.equal(h.panel.command(h.c, b.frames.at(-1)), true);
  for (let i = 0; i < 150 && !h.c.lastResult; i++) await tick();
  assert.equal(h.c.lastResult.created, 1); assert.equal(h.parent.childNotes.length, 1);
  assert.equal(h.parent.childNotes[0].noteTitle, '来源试卷 251 · 第 7 题');
  assert.equal(h.parent.childNotes[0].childNotes.length, 0);
  assert.deepEqual(b.calls.map(c => new URL(c.url).pathname), ['/api/questions/5395']);
  b.root.replaceWith(b.root.cloneNode(true));
  assert.equal(b.window.__JFJC_QUESTION_TOOLS__.matchesSingle(target), false);
});

test('题篮定位题目复用 MN 实际身份定位，不读取网站题目 API', async () => {
  const b = basket([question(5395)]), h = connect(b), events = [];
  const note = h.database.createNoteWithTitleTopicid('已导入题目', 'book-1');
  note.comments = [{ text: '正文' }, { text: '[查看原题](url)\n\n<!-- JFJC_QUESTION:251:5395 -->' }];
  const originalApp = h.context.Application.sharedInstance();
  const study = { notebookController: h.notebookController, refreshAddonCommands() {} };
  h.notebookController.changeFocusToNote = card => events.push(['focus', card.noteId]);
  h.context.Application.sharedInstance = () => ({ ...originalApp, studyController: () => study });
  h.context.MNUtil.currentWindow = h.c.addon.window;
  h.context.MNUtil.focusNoteInMindMapById = id => events.push(['locate', id]);
  h.c.view = { removeFromSuperview() {} }; h.c.addon.panelController = h.c;
  b.root.querySelector('.jfjc-locate-card').click();
  assert.equal(h.panel.command(h.c, b.frames.at(-1)), true);
  for (let i = 0; i < 150 && h.c.visible; i++) await tick();
  assert.deepEqual(events, [['focus', note.noteId], ['locate', note.noteId]]);
  assert.equal(b.calls.length, 0); assert.equal(h.c.visible, false);
});
