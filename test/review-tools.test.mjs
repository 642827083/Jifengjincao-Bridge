import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { browserHost, nativeHost, source, envelope, tick, reviewPageHTML } from './helpers.mjs';

function review(t, responseFor) {
  const question = { ...envelope().questions[0].question, id: 5684, subject: 'math2', question_type: 'solution',
    papers: [{ id: 263, title: '2012 年考研数学二真题', kind: 'official', question_number: '23', year: 2012 }], assets: [] };
  const b = browserHost(undefined, async (url, options) => {
    if (responseFor) { const result = await responseFor(url, options); if (result) return result; }
    return new Response(JSON.stringify(url.endsWith('/api/questions/5684') ? question : { detail: 'Question not found' }), {
      status: url.endsWith('/api/questions/5684') ? 200 : 404, headers: { 'Content-Type': 'application/json' }
    });
  });
  b.location.pathname = '/assistant/conversations/review-42/review';
  b.document.body.innerHTML = reviewPageHTML(); b.runtime.refresh();
  const tools = b.window.__JFJC_QUESTION_TOOLS__;
  tools.configure({ enabled: true, importEnabled: true });
  t.after(() => {
    const address = b.frames.findLast(url => /:\/\/(?:locate-card|single-import)\?/.test(url));
    if (address) tools.finish(new URL(address).searchParams.get('token'));
    tools.configure({ enabled: false, importEnabled: false }); b.runtime.cancel();
  });
  return { ...b, tools, question };
}
function connect(b) {
  const h = nativeHost(), events = [];
  h.context.JSB = { defineClass() { return { new() { return {}; } }; } };
  vm.runInContext(source('src/WebPanelController.js'), h.context);
  const addon = { window: {} }, c = { addon, visible: true, activePage: 'math', view: { removeFromSuperview() {} },
    webView: { evaluateJavaScript(script, callback) { try { callback(vm.runInContext(script, b.context), null); } catch (error) { callback(null, error); } } } };
  addon.panelController = c;
  h.native.savePreference('question-tools.show-single-import', true);
  const parent = h.database.createNoteWithTitleTopicid('我的练习', 'book-1'); h.notebookController.focusNote = parent;
  const app = h.context.Application.sharedInstance();
  h.notebookController.changeFocusToNote = note => events.push(['focus', note.noteId]);
  h.context.Application.sharedInstance = () => ({ ...app, studyController: () => ({ notebookController: h.notebookController, refreshAddonCommands() {} }) });
  h.context.MNUtil.currentWindow = addon.window; h.context.MNUtil.focusNoteInMindMapById = id => events.push(['locate', id]);
  h.database.allNotebooks = () => [h.notebook];
  return { ...h, parent, c, events, panel: h.context.__JFJC_PANEL__ };
}
async function waitFor(done) { for (let i = 0; i < 160 && !done(); i++) await tick(); assert.ok(done(), '原生操作应结束'); }

test('复盘导入本题实际命令请求题库 5684，不请求上下文 29894，也不返回 404', async t => {
  const b = review(t), h = connect(b);
  b.document.querySelector('.jfjc-import-single').click();
  const address = b.frames.at(-1), target = JSON.parse(new URL(address).searchParams.get('scope'));
  assert.equal(h.panel.command(h.c, address), true);
  await waitFor(() => !h.c.previewing);
  assert.equal(target.questionId, 5684);
  assert.deepEqual(b.calls.map(call => new URL(call.url).pathname), ['/api/questions/5684']);
  assert.equal(h.c.lastResult?.created, 1, h.hud.join('\n'));
  assert.match(h.parent.childNotes[0].comments[1].text, /JFJC_QUESTION:263:5684/);
  assert.equal(b.document.querySelector('.jfjc-import-single').disabled, false);
});

test('复盘定位实际命令找到真实题号的已有卡片，不按上下文编号误报无卡', async t => {
  const b = review(t), h = connect(b);
  const note = h.database.createNoteWithTitleTopicid('2012 年数学二 · 第 23 题', 'book-1');
  note.comments = [{ text: '题干' }, { text: '[查看原题](url)\n<!-- JFJC_QUESTION:263:5684 -->' }];
  b.document.querySelector('.jfjc-locate-card').click();
  assert.equal(h.panel.command(h.c, b.frames.at(-1)), true);
  await waitFor(() => !h.c.cardLocationRequest);
  assert.deepEqual(h.events, [['focus', note.noteId], ['locate', note.noteId]], h.hud.join('\n'));
  assert.equal(h.c.visible, false); assert.equal(b.calls.length, 0);
});

test('复盘缺少题卡、上下文未知、题号冲突及加载失败时按钮禁用，不借用其他分栏题号', t => {
  for (const change of ['missing', 'context', 'conflict', 'multiple', 'busy', 'error', 'outside']) {
    const b = review(t), card = b.document.querySelector('.review-question-card');
    if (change === 'missing') card.remove();
    if (change === 'context') b.document.querySelector('small').textContent = '等待题目上下文';
    if (change === 'conflict') b.document.querySelector('.review-question-source').setAttribute('aria-label', '题号 9999');
    if (change === 'multiple') card.parentNode.appendChild(card.cloneNode(true));
    if (change === 'busy') b.document.querySelector('.review-question-pane').setAttribute('aria-busy', 'true');
    if (change === 'error') b.document.querySelector('.review-question-pane').insertAdjacentHTML('beforeend', '<div class="review-missing-state">当前题目暂不可用</div>');
    if (change === 'outside') b.document.body.appendChild(card);
    b.tools.refresh();
    const buttons = b.document.querySelectorAll('.jfjc-locate-card,.jfjc-import-single'); assert.equal(buttons.length, 2, change);
    for (const button of buttons) {
      assert.equal(button.disabled, true, change); button.click();
    }
    assert.equal(b.frames.length, 0, change);
    assert.equal(b.tools.matches({ paperId: 0, questionId: 29894, route: b.location.pathname }), false, change);
  }
});

test('加载属性变化自动禁用和恢复按钮，重复注入不复制或复用旧目标', async t => {
  const b = review(t), old = b.document.querySelector('.jfjc-import-single').__jfjcTarget;
  const pane = b.document.querySelector('.review-question-pane');
  pane.setAttribute('aria-busy', 'true');
  await waitFor(() => b.document.querySelector('.jfjc-import-single').disabled);
  vm.runInContext(source('web/src/BBKaoyanQuestionTools.js'), b.context);
  assert.equal(b.document.querySelectorAll('.jfjc-import-single').length, 1);
  assert.equal(b.document.querySelectorAll('.jfjc-locate-card').length, 1);
  pane.removeAttribute('aria-busy');
  await waitFor(() => !b.document.querySelector('.jfjc-import-single').disabled);
  assert.equal(b.tools.matchesSingle(old), false);
  const current = b.document.querySelector('.jfjc-import-single').__jfjcTarget;
  assert.equal(current.questionId, 5684); assert.equal(b.tools.matchesSingle(current), true);
});

test('同一道题切换复盘上下文时取消旧定位和导入，切回原记录也不复用旧请求', t => {
  for (const single of [false, true]) {
    const b = review(t), button = b.document.querySelector(single ? '.jfjc-import-single' : '.jfjc-locate-card');
    const old = button.__jfjcTarget; button.click();
    const token = new URL(b.frames.at(-1)).searchParams.get('token');
    b.document.querySelector('small').textContent = '题目上下文 #29895'; b.tools.refresh();
    const cancelled = new URL(b.frames.at(-1));
    assert.equal(cancelled.hostname, single ? 'cancel-single' : 'cancel-locate');
    assert.equal(cancelled.searchParams.get('token'), token);
    assert.equal(button.disabled, false);
    b.document.querySelector('small').textContent = '题目上下文 #29894'; b.tools.refresh();
    assert.equal(b.tools.matches(old), false); assert.equal(b.tools.matchesSingle(old), false);
  }
});

test('同题换上下文后晚到的定位命令被原生再次校验，不跳到已有题卡', async t => {
  const b = review(t), h = connect(b), note = h.database.createNoteWithTitleTopicid('已导入的题目', 'book-1');
  note.comments = [{ text: '<!-- JFJC_QUESTION:263:5684 -->' }];
  b.document.querySelector('.jfjc-locate-card').click(); const address = b.frames.at(-1);
  b.document.querySelector('small').textContent = '题目上下文 #29895';
  assert.equal(h.panel.command(h.c, address), true);
  await waitFor(() => !h.c.cardLocationRequest);
  assert.deepEqual(h.events, []); assert.equal(h.c.visible, true);
  assert.ok(h.hud.some(text => text.includes('已切换')));
});

test('复盘上下文变化或同题卡替换使旧目标失效，题目加载后按钮恢复', t => {
  for (const change of ['context', 'replace', 'missing']) {
    const b = review(t), old = b.document.querySelector('.jfjc-import-single').__jfjcTarget;
    if (change === 'context') b.document.querySelector('small').textContent = '题目上下文 #29895';
    if (change === 'replace') { const card = b.document.querySelector('.review-question-card'); card.replaceWith(card.cloneNode(true)); }
    if (change === 'missing') b.document.querySelector('.review-question-card').remove();
    assert.equal(b.tools.matches(old), false, change); assert.equal(b.tools.matchesSingle(old), false, change);
    b.tools.refresh();
    if (change === 'missing') {
      assert.equal(b.document.querySelector('.jfjc-import-single').disabled, true);
      b.document.querySelector('.review-question-pane').innerHTML = '<p>正在读取复盘题目…</p>';
      b.document.querySelector('.review-question-pane').innerHTML = /<section class="review-question-pane">([\s\S]*?)<\/section>/.exec(reviewPageHTML(5684, 29895))[1];
    }
    b.tools.refresh();
    const current = b.document.querySelector('.jfjc-import-single').__jfjcTarget;
    assert.equal(current.questionId, 5684); assert.equal(b.tools.matchesSingle(current), true);
    assert.equal(b.document.querySelector('.jfjc-import-single').disabled, false);
    assert.notEqual(current.snapshot, old.snapshot, change);
  }
});

test('切题加载期间拒绝尚未分发的旧命令，不发网站请求或创建卡片', async t => {
  const b = review(t), h = connect(b);
  b.document.querySelector('.jfjc-import-single').click(); const address = b.frames.at(-1);
  b.document.querySelector('.review-question-card').remove();
  assert.equal(h.panel.command(h.c, address), true);
  await waitFor(() => !h.c.previewing);
  assert.equal(b.calls.length, 0); assert.equal(h.parent.childNotes.length, 0);
});

test('复盘读取途中切换上下文、替换题卡或进入加载状态，晚到响应不写入 MN', async t => {
  for (const change of ['context', 'replace', 'missing']) {
    let release;
    const b = review(t, () => new Promise(resolve => { release = resolve; })), h = connect(b);
    b.document.querySelector('.jfjc-import-single').click();
    assert.equal(h.panel.command(h.c, b.frames.at(-1)), true);
    await waitFor(() => Boolean(release));
    if (change === 'context') b.document.querySelector('small').textContent = '题目上下文 #29895';
    if (change === 'replace') { const card = b.document.querySelector('.review-question-card'); card.replaceWith(card.cloneNode(true)); }
    if (change === 'missing') b.document.querySelector('.review-question-card').remove();
    release(new Response(JSON.stringify(b.question), { headers: { 'Content-Type': 'application/json' } }));
    await waitFor(() => !h.c.previewing);
    assert.equal(h.parent.childNotes.length, 0, change);
  }
});
