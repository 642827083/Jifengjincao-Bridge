import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { browserHost, nativeHost, source, envelope, packet, tick, reviewPageHTML } from './helpers.mjs';

function question(id, paperId = 251, number = '7', subject = 'math2') {
  return { ...envelope().questions[0].question, id, subject, question_type: 'blank', stem_latex: '求 $x$ 的值。',
    papers: [{ id: paperId, title: '2000 年考研数学二真题', question_number: number, year: 2000 }] };
}
function snapshot(b, ids, missing = []) {
  const node = b.document.createElement('div'); node.className = 'search-message-snapshot';
  node.innerHTML = '<h3>找到匹配题</h3>' + ids.map(id => '<article class="search-snapshot-question"><label class="search-snapshot-question-select"><input type="checkbox"><span>题目 ' + id + '</span></label>' +
    (missing.includes(id) ? '<p class="search-snapshot-question-missing">题目内容暂不可用</p>' : '<p>求 x 的值</p>') + '</article>').join('');
  b.document.body.appendChild(node); b.runtime.refresh(); return node;
}
function search(questions, responseFor) {
  const b = browserHost(undefined, async (url, options) => {
    if (responseFor) { const response = await responseFor(url, options); if (response) return response; }
    const id = Number(/\/api\/questions\/(\d+)$/.exec(url)?.[1]);
    if (id) return new Response(JSON.stringify(questions.find(q => q.id === id)), { headers: { 'Content-Type': 'application/json' } });
  });
  b.location.pathname = '/assistant/conversations/chat-42/search'; b.runtime.refresh();
  return b;
}
function connect(b) {
  const h = nativeHost(); h.context.JSB = { defineClass() { return { new() { return {}; } }; } };
  vm.runInContext(source('src/WebPanelController.js'), h.context);
  const addon = { window: {} }, c = { addon, visible: true, activePage: 'math',
    webView: { evaluateJavaScript(script, callback) { try { callback(vm.runInContext(script, b.context), null); } catch (error) { callback(null, error); } } } };
  h.native.savePreference('question-tools.show-single-import', true);
  b.window.__JFJC_QUESTION_TOOLS__.configure({ enabled: true, importEnabled: true });
  const parent = h.database.createNoteWithTitleTopicid('我的练习', 'book-1'); h.notebookController.focusNote = parent;
  return { ...h, c, parent, panel: h.context.__JFJC_PANEL__ };
}
async function selected(b, h, content = 'questionAnswer') {
  await b.runtime.open('selected', { token: 'test-task', target: '我的学习集', content });
  b.document.getElementById('jfjc-commit').click();
  const session = { token: 'test-task', context: h.native.context(h.c.addon), aiSearch: true, cancelled: false, running: false };
  h.c.session = session; return h.importer.run(h.c, session);
}

test('AI 找题入口始终显示，等待结果时禁用，异步结果出现后可选题导入', async () => {
  const b = search([question(5395)]), toolbar = b.document.getElementById('jfjc-toolbar'), button = toolbar.querySelector('button');
  assert.equal(toolbar.hidden, false); assert.equal(button.disabled, true);
  snapshot(b, [5395]); await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(button.disabled, false); button.click(); assert.match(b.frames.at(-1), /preview\?token=&scope=selected$/);
  b.location.pathname = '/assistant'; b.runtime.refresh(); assert.equal(toolbar.hidden, false); assert.equal(button.disabled, true);
});

test('仅选最新快照可读匹配题，排除历史、边界与缺失内容，按 ID 去重且默认全选', async () => {
  const b = search([question(5395), question(5434, 253, '1')]);
  snapshot(b, [5000]); snapshot(b, [5395, 5434, 5395, 9999], [9999]);
  const boundary = b.document.createElement('article'); boundary.className = 'search-snapshot-question';
  boundary.innerHTML = '<label class="search-snapshot-question-select"><span>题目 9998</span></label>'; b.document.body.appendChild(boundary);
  await b.runtime.open('selected', { token: 'test-task', target: '数学', content: 'question' });
  const inputs = Array.from(b.document.querySelectorAll('#jfjc-dialog input[data-id]'));
  assert.deepEqual(inputs.map(i => Number(i.dataset.id)), [5395, 5434]); assert.ok(inputs.every(i => i.checked));
  assert.match(b.document.getElementById('jfjc-count').textContent, /已选 2 \/ 2/);
  assert.ok(b.calls.every(call => call.options.credentials === 'include'));
  assert.deepEqual(b.calls.map(call => new URL(call.url).pathname), ['/api/questions/5395', '/api/questions/5434']);
  b.document.getElementById('jfjc-commit').click(); const data = await packet(b, () => b.runtime.begin('test-task'));
  assert.equal(data.envelope.collection, 'ai-search'); assert.deepEqual(data.ids, [5395, 5434]);
  assert.equal(data.envelope.questions[0].sourcePaper.id, 251); assert.equal(data.envelope.questions[0].question_number, '7');
  assert.equal(data.envelope.questions[0].question.stem_latex, '求 $x$ 的值。');
});

test('换对话、替换同 ID 快照或新增结果，都拒绝旧预览和正在读取的题目', async () => {
  for (const change of ['conversation', 'replace', 'append']) {
    let release; const q = question(5395), b = search([q], () => new Promise(resolve => { release = resolve; }));
    const old = snapshot(b, [q.id]);
    const opening = b.runtime.open('selected', { token: 'test-task', target: '数学', content: 'question' });
    await tick();
    if (change === 'conversation') b.location.pathname = '/assistant/conversations/new/search';
    else { if (change === 'replace') old.remove(); snapshot(b, [q.id]); }
    release(new Response(JSON.stringify(q), { headers: { 'Content-Type': 'application/json' } })); await opening;
    assert.equal(b.document.getElementById('jfjc-commit'), null); assert.equal(b.calls.length, 1);
  }
  const b = search([question(5395)]); snapshot(b, [5395]);
  await b.runtime.open('selected', { token: 'test-task', target: '数学', content: 'question' });
  snapshot(b, [5395]); const before = b.frames.length; b.document.getElementById('jfjc-commit').click();
  assert.equal(b.frames.length, before); assert.match(b.document.getElementById('jfjc-status').textContent, /找题结果已变化/);
});

test('题目读取错误、未登录、无权限与 ID 不匹配不会建卡', async () => {
  for (const status of [401, 403, 428, 500, 200]) {
    const b = search([question(5395)], () => new Response(JSON.stringify(question(5396)), { status, headers: { 'Content-Type': 'application/json' } }));
    snapshot(b, [5395]); const h = connect(b);
    await b.runtime.open('selected', { token: 'test-task', target: '数学', content: 'question' });
    assert.equal(b.document.getElementById('jfjc-commit'), null); assert.equal(h.notes.size, 1);
    assert.ok(b.document.querySelector('[role="alert"]'));
  }
});

test('AI 混合原卷科目导入沿用题卡结构、离线图片、原卷排序及去重', async () => {
  const first = question(5395, 251, '7'), second = question(5434, 253, '1', 'math1');
  first.assets = [{ id: 369, usage: 'stem', asset_type: 'image', url: '/api/question-assets/369' }];
  second.papers[0].title = '2002 年考研数学一真题';
  const b = search([first, second]); snapshot(b, [first.id, second.id]); const h = connect(b);
  let result = await selected(b, h); assert.equal(result.created, 2); assert.equal(result.failed.length, 0);
  const cards = Array.from(h.notes.values()).filter(n => n.comments.some(c => c.text.includes('JFJC_QUESTION:')));
  assert.ok(cards.some(n => n.noteTitle === '2000 年考研数学二真题 · 第 7 题'));
  assert.ok(cards.some(n => n.noteTitle === '2002 年考研数学一真题 · 第 1 题'));
  const note = cards.find(n => n.comments[1].text.includes('JFJC_QUESTION:251:5395'));
  assert.doesNotMatch(note.comments[1].text, /JFJC_ORDER:|JFJC_SOURCE:/); assert.ok(note.mediaList); assert.equal(note.childNotes.length, 1);
  assert.equal(note.comments.length, 2); assert.doesNotMatch(note.comments[0].text, /<!--|查看原题/);
  assert.match(note.comments[1].text, /^\[查看原题\]/);
  result = await selected(b, h); assert.equal(result.created, 0); assert.equal(result.skipped, 2);
});

test('AI 分次收集解答、填空与选择题，后导入的题卡直接追加到试卷末尾', () => {
  const h = nativeHost(), paper = { id: 251, subject: 'math2', title: '2000 年考研数学二真题' };
  function add(id, number, type, ai) {
    const row = { question: { ...question(id), question_type: type }, sourcePaper: paper,
      question_number: String(number), display_order: number,
      section_title: { choice: '一、选择题', blank: '二、填空题', solution: '三、解答题' }[type] };
    const model = h.adapter.normalize({ paper, questions: [row], ...(ai ? { collection: 'ai-search' } : {}) });
    const entry = model.entries[0], prepared = h.format.format(entry, paper, { images: {}, inlineImages: {} }, true, false);
    return h.importer.write(h.native.context({ window: {} }), paper, entry, prepared, null, false).note;
  }
  const solution = add(6000, 17, 'solution', true); add(6001, 11, 'blank', false); add(6002, 1, 'choice', false);
  const paperNode = solution.parentNote;
  assert.equal(paperNode.noteTitle, paper.title);
  assert.deepEqual(paperNode.childNotes.map(n => n.noteTitle), [17, 11, 1].map(n => paper.title + ' · 第 ' + n + ' 题'));
});

test('题号右侧显示定位题目和导入本题，开关独立，按钮不改变网站选题复选框', () => {
  const b = search([question(5395)]); snapshot(b, [5395]); const tools = b.window.__JFJC_QUESTION_TOOLS__;
  tools.configure({ enabled: true, importEnabled: true });
  const host = b.document.querySelector('.search-snapshot-question-select');
  assert.deepEqual(Array.from(host.querySelectorAll('button'), n => n.textContent), ['定位题目', '导入本题']);
  const input = host.querySelector('input'), button = host.querySelector('.jfjc-import-single'); const checked = input.checked;
  button.click(); assert.equal(input.checked, checked); assert.match(b.frames.at(-1), /single-import/);
  const token = new URL(b.frames.at(-1)).searchParams.get('token'); tools.finishSingle(token);
  tools.configure({ enabled: false, importEnabled: true }); assert.equal(host.querySelector('.jfjc-locate-card'), null); assert.ok(host.querySelector('.jfjc-import-single'));
  tools.configure({ enabled: true, importEnabled: false }); assert.ok(host.querySelector('.jfjc-locate-card')); assert.equal(host.querySelector('.jfjc-import-single'), null);
  tools.refresh(); assert.equal(host.querySelectorAll('button').length, 1);
});

test('导入本题只建题卡、落到捕获子节点、同父重复跳过，不受别处已导入题影响', async () => {
  const q = question(5395), b = search([q]); snapshot(b, [q.id]); const h = connect(b);
  h.native.savePreference('content', 'questionAnswer'); const target = b.document.querySelector('.jfjc-import-single').__jfjcTarget;
  await h.panel.singleImport(h.c, 'jfjc-single-test', target);
  assert.equal(h.c.lastResult.created, 1); assert.equal(h.c.lastResult.failed.length, 0);
  const child = h.parent.childNotes[0]; assert.equal(child.noteTitle, q.papers[0].title + ' · 第 7 题');
  assert.match(child.comments[1].text, /JFJC_QUESTION:251:5395/); assert.doesNotMatch(child.comments[1].text, /JFJC_ORDER:|JFJC_SOURCE:/);
  assert.equal(child.comments.length, 2); assert.equal(child.childNotes.length, 0); assert.equal(h.parent.childNotes.length, 1);
  assert.equal(b.document.getElementById('jfjc-dialog').hidden, true); assert.equal(h.native.preference('content'), 'questionAnswer');
  await h.panel.singleImport(h.c, 'jfjc-single-repeat', target); assert.equal(h.c.lastResult.skipped, 1); assert.equal(h.parent.childNotes.length, 1);
  const other = h.database.createNoteWithTitleTopicid('其他练习', 'book-1'); h.notebookController.focusNote = other;
  await h.panel.singleImport(h.c, 'jfjc-single-other', target); assert.equal(h.c.lastResult.created, 1); assert.equal(other.childNotes.length, 1);
});

test('同级节点插到所选卡片后，异步切换所选卡片仍使用原落点', async () => {
  let release; const q = question(5395), b = search([q], () => new Promise(resolve => { release = resolve; })); snapshot(b, [q.id]); const h = connect(b);
  const anchor = h.database.createNoteWithTitleTopicid('所选', 'book-1'), next = h.database.createNoteWithTitleTopicid('后续', 'book-1');
  h.native.add(h.parent, anchor); h.native.add(h.parent, next); h.notebookController.focusNote = anchor;
  h.native.savePreference('question-tools.single-import-position', 'sibling');
  const running = h.panel.singleImport(h.c, 'jfjc-single-sibling', b.document.querySelector('.jfjc-import-single').__jfjcTarget); await tick();
  h.notebookController.focusNote = next; h.native.savePreference('question-tools.single-import-position', 'child');
  release(new Response(JSON.stringify(q), { headers: { 'Content-Type': 'application/json' } })); await running;
  assert.equal(h.c.lastResult.created, 1); assert.equal(h.parent.childNotes[0], anchor); assert.equal(h.parent.childNotes[2], next);
  assert.match(h.parent.childNotes[1].comments[1].text, /JFJC_QUESTION:251:5395/); assert.equal(next.childNotes.length, 0);
});

test('单题请求切换结果、删除父卡片、移动同级锚点、关闭面板均不写到新位置', async () => {
  for (const change of ['snapshot', 'parent', 'anchor', 'close']) {
    let release; const q = question(5395), b = search([q], () => new Promise(resolve => { release = resolve; })); snapshot(b, [q.id]); const h = connect(b);
    if (change === 'anchor') {
      const anchor = h.database.createNoteWithTitleTopicid('所选', 'book-1'); h.native.add(h.parent, anchor); h.notebookController.focusNote = anchor;
      h.native.savePreference('question-tools.single-import-position', 'sibling');
    }
    const running = h.panel.singleImport(h.c, 'jfjc-single-cancel', b.document.querySelector('.jfjc-import-single').__jfjcTarget); await tick();
    if (change === 'snapshot') snapshot(b, [q.id]);
    if (change === 'parent') h.database.deleteBookNoteTree(h.parent.noteId);
    if (change === 'anchor') h.database.deleteBookNoteTree(h.notebookController.focusNote.noteId);
    if (change === 'close') { h.c.visible = false; h.transport.cancel(h.c); }
    release(new Response(JSON.stringify(q), { headers: { 'Content-Type': 'application/json' } })); await running;
    assert.equal(Array.from(h.notes.values()).filter(n => n.comments.some(c => c.text.includes('JFJC_QUESTION:'))).length, 0, change);
    assert.equal(h.c.previewing, false); assert.equal(h.c.session, null);
  }
});

test('无所选卡片、关闭开关、伪造题号与忙碌任务拒绝单题导入，并恢复按钮', async () => {
  const q = question(5395), b = search([q]); snapshot(b, [q.id]); const h = connect(b);
  const target = b.document.querySelector('.jfjc-import-single').__jfjcTarget;
  h.notebookController.focusNote = null; await h.panel.singleImport(h.c, 'jfjc-single-empty', target); assert.equal(b.calls.length, 0);
  h.notebookController.focusNote = h.parent; h.native.savePreference('question-tools.show-single-import', false);
  await h.panel.singleImport(h.c, 'jfjc-single-off', target); assert.equal(b.calls.length, 0);
  h.native.savePreference('question-tools.show-single-import', true);
  await h.panel.singleImport(h.c, 'jfjc-single-spoof', { ...target, questionId: 9998 }); assert.equal(b.calls.length, 0);
  h.c.previewing = true; await h.panel.singleImport(h.c, 'jfjc-single-busy', target); assert.equal(b.calls.length, 0); assert.equal(h.c.previewing, true);
  for (const scope of ['{}', JSON.stringify({ ...target, snapshot: 'evil' }), JSON.stringify({ ...target, questionId: -1 })]) {
    assert.equal(h.panel.command(h.c, 'jifengjincaobridge://single-import?token=jfjc-single-test&scope=' + encodeURIComponent(scope)), false);
  }
});

test('网页实际单题命令保留快照身份，原生执行完成后按钮可再次使用', async () => {
  const q = question(5395), b = search([q]); snapshot(b, [q.id]); const h = connect(b);
  b.document.querySelector('.jfjc-import-single').click(); const address = b.frames.at(-1);
  assert.equal(h.panel.command(h.c, address), true);
  const token = new URL(address).searchParams.get('token');
  assert.equal(h.panel.command(h.c, 'jifengjincaobridge://import?token=' + encodeURIComponent(token) + '&scope='), false);
  for (let i = 0; i < 150 && !h.c.lastResult; i++) await tick();
  assert.equal(h.c.lastResult.created, 1);
  for (let i = 0; i < 30 && h.c.previewing; i++) await tick();
  assert.equal(b.document.querySelector('.jfjc-import-single').disabled, false); assert.equal(h.c.previewing, false);
});

test('导入本题支持原试卷与复盘入口，选择当前来源卷，保留离线图片且不下载原卷', async () => {
  for (const route of ['/papers/237', '/questions/5395', '/assistant/conversations/chat-42/review']) {
    const q = question(5395); q.papers.push({ id: 237, title: '当前模拟卷', question_number: '2' });
    q.assets = [{ id: 369, usage: 'stem', asset_type: 'image', url: '/api/question-assets/369' }];
    const b = search([q]); b.location.pathname = route;
    b.document.body.innerHTML = route.endsWith('/review') ? reviewPageHTML(5395, 29894) : '<article id="question-5395"><div class="question-card-meta-line">第 02 题</div></article>';
    b.runtime.refresh(); const h = connect(b), target = b.document.querySelector('.jfjc-import-single').__jfjcTarget;
    await h.panel.singleImport(h.c, 'jfjc-single-route', target);
    assert.equal(h.c.lastResult.created, 1); assert.equal(h.parent.childNotes[0].childNotes.length, 0);
    const note = h.parent.childNotes[0]; assert.ok(note.mediaList); assert.doesNotMatch(note.comments[0].text, /data:image/);
    assert.match(note.comments[1].text, new RegExp('JFJC_QUESTION:' + (route === '/papers/237' ? 237 : 251) + ':5395'));
    assert.ok(b.calls.every(call => !call.url.includes('/papers/')));
  }
});

test('第一条题干无注释也逐张检查图片转存，部分转存失败会清理本次题卡', async () => {
  const q = question(5395); q.assets = [369, 370].map(id => ({ id, usage: 'stem', asset_type: 'image', url: '/api/question-assets/' + id }));
  const b = search([q]); snapshot(b, [q.id]); const h = connect(b); h.flags.partialImageFailure = true;
  await h.panel.singleImport(h.c, 'jfjc-single-media', b.document.querySelector('.jfjc-import-single').__jfjcTarget);
  assert.equal(h.c.lastResult.created, 0); assert.equal(h.c.lastResult.failed.length, 1);
  assert.equal(h.parent.childNotes.length, 0); assert.equal(h.notes.size, 1);
});

test('AI 定位题目复用实际题卡身份查找与聚焦，不读取题目 API', async () => {
  const b = search([question(5395)]); snapshot(b, [5395]); const h = connect(b), events = [];
  const note = h.database.createNoteWithTitleTopicid('已经导入的题目', 'book-1');
  note.comments = [{ text: '正文' }, { text: '[查看原题](url)\n\n<!-- JFJC_QUESTION:251:5395 -->' }];
  const originalApp = h.context.Application.sharedInstance();
  const study = { notebookController: h.notebookController, refreshAddonCommands() {} };
  h.notebookController.changeFocusToNote = card => events.push(['focus', card.noteId]);
  h.context.Application.sharedInstance = () => ({ ...originalApp, studyController: () => study });
  h.context.MNUtil.currentWindow = h.c.addon.window; h.context.MNUtil.focusNoteInMindMapById = id => events.push(['locate', id]);
  h.c.view = { removeFromSuperview() {} }; h.c.addon.panelController = h.c;
  const button = b.document.querySelector('.jfjc-locate-card'); button.click();
  assert.equal(h.panel.command(h.c, b.frames.at(-1)), true);
  for (let i = 0; i < 150 && h.c.visible; i++) await tick();
  assert.deepEqual(events, [['focus', note.noteId], ['locate', note.noteId]]); assert.equal(h.c.visible, false);
  assert.equal(b.calls.length, 0);
});
