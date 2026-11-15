import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { nativeHost, source, tick, reviewPageHTML } from './helpers.mjs';
import { officialMediaHost } from './handwriting-host.mjs';
import { pageScriptSource } from '../scripts/web-bundle.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4XsAAAAASUVORK5CYII=', 'base64');
function review(t, state = 'uploaded', pathname = '/assistant/conversations/42/review', injection = source('web/src/BBKaoyanReview.js')) {
  const parsed = parseHTML('<html><head></head><body><section class="review-chat-pane"><div class="review-chat-heading"><span>本题对话</span><small>题目上下文 #5519</small></div><form class="assistant-composer"><textarea>保留我的提问</textarea><div class="assistant-composer-actions"><label class="assistant-upload-button">上传<input type="file"></label><button type="button" class="assistant-pro-toggle">Pro</button><div class="assistant-composer-hint-wrapper">Enter 发送</div><button type="submit">发送</button></div></form></section></body></html>');
  const document = parsed.document, timers = new Set(), calls = [];
  let sends = 0;
  document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); sends++; });
  const location = { origin: 'https://bbkaoyan.cn', pathname, search: '' };
  const window = { document, location, HTMLTextAreaElement: parsed.window.HTMLTextAreaElement, atob: value => Buffer.from(value, 'base64').toString('binary'), addEventListener() {}, setTimeout(work, ms) { const timer = setTimeout(() => { timers.delete(timer); work(); }, ms); timers.add(timer); return timer; } };
  const context = vm.createContext({ window, document, MutationObserver: parsed.window.MutationObserver, File, Event: parsed.window.Event, Uint8Array, Number, Date, Math });
  const editor = document.querySelector('textarea');
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
  let tracked = editor.value, draft = editor.value, inputs = 0;
  // 模拟受控输入框的值跟踪：直接赋值不会通知网站，原生 setter + input 才更新草稿。
  Object.defineProperty(editor, 'value', { configurable: true, get() { return descriptor.get.call(this); }, set(value) { tracked = String(value); descriptor.set.call(this, value); } });
  editor.setSelectionRange = function (start, end) { this.selectionStart = start; this.selectionEnd = end; };
  editor.addEventListener('input', () => { if (editor.value !== tracked) { inputs++; draft = editor.value; editor.value = draft; } });
  editor.addEventListener('paste', event => {
    for (const entry of event.clipboardData.items) {
    const file = entry.getAsFile(); calls.push(file);
    const item = document.createElement('div'); item.className = 'assistant-attachment-item is-' + state;
    const copy = document.createElement('span'); copy.className = 'assistant-attachment-copy';
    const name = document.createElement('strong'); name.textContent = file.name; copy.appendChild(name); item.appendChild(copy);
    if (state === 'failed') { const error = document.createElement('em'); error.textContent = '登录已失效'; item.appendChild(error); }
    document.querySelector('form').appendChild(item);
    }
  });
  vm.runInContext(injection, context);
  t.after(() => { timers.forEach(clearTimeout); window.__JFJC_REVIEW__.cancel(); });
  return { document, location, window, context, calls, sends: () => sends, inputs: () => inputs, draft: () => draft, rerender: () => { editor.value = draft; }, runtime: window.__JFJC_REVIEW__ };
}
function connect(h, page) {
  page.handwritingFixture = h.handwritingFixture;
  page.runtime.configure({ enabled: h.context.__JFJC_SETTINGS__.showUpload(), source: h.context.__JFJC_SETTINGS__.uploadSource(), attachFirst: h.context.__JFJC_SETTINGS__.attachFirstContent(), hasPrompt: Boolean(h.context.__JFJC_SETTINGS__.uploadExtraText()) });
  const controller = { addon: { window: {} }, webView: { evaluateJavaScript(code, callback) { try { callback(vm.runInContext(code, page.context), null); } catch (error) { callback(null, error); } } } };
  return { controller, upload: h.context.__JFJC_UPLOAD__ };
}

function selectedDrawing(h, data = PNG) {
  h.native.savePreference('ai-tools.upload-source', 'handwriting');
  const note = h.database.createNoteWithTitleTopicid('作答卡', 'book-1');
  note.comments = [{ type: 'TextNote', text: '题干' }, { type: 'PaintNote', drawing: 'older' }, { type: 'PaintNote', drawing: 'last' }, { type: 'PaintNote', paint: 'photo' }, { type: 'TextNote', text: '最后的文字' }];
  h.notebookController.mindmapView = { selViewLst: [{ note }] };
  const fixture = officialMediaHost(h, note, data); h.handwritingFixture = fixture;
  return { note, reads: fixture.reads, api: h.context.__JFJC_HANDWRITING__, fixture };
}
function officialPNG(page, beforeLoad = () => {}) { page.handwritingFixture.beforeImage = beforeLoad; }

function questionConversation(t, mode = 'review', questionId = 5684, format = 'legacy') {
  const page = review(t, 'uploaded', '/assistant/conversations/42/' + mode, pageScriptSource());
  const form = page.document.querySelector('form');
  if (mode === 'review') {
    page.document.body.innerHTML = reviewPageHTML(questionId, 5519, format);
    page.document.querySelector('.review-chat-pane').appendChild(form);
  } else {
    const pane = page.document.querySelector('.review-chat-pane');
    pane.className = 'solve-conversation-page'; pane.setAttribute('aria-label', '本题 AI 解题');
    pane.querySelector('.review-chat-heading').outerHTML = '<header class="solve-thread-header"><h2 class="solve-thread-title">正在讨论：#' + questionId + '</h2></header>';
  }
  const h = nativeHost(), selected = selectedDrawing(h);
  h.database.allNotebooks = () => [h.notebook];
  return { page, h, selected, ...connect(h, page) };
}
function linkDrawing(selected, question = 5684, paper = 237) {
  selected.note.comments[0].text = '题干\n<!-- JFJC_QUESTION:' + paper + ':' + question + ' -->';
}

function useMindmap(h, page) {
  h.native.savePreference('ai-tools.upload-source', 'mindmap');
  page.runtime.configure({ enabled: true, source: 'mindmap' });
}

function attachFirst(h, page, source = 'mindmap') {
  h.native.savePreference('ai-tools.upload-source', source);
  h.native.savePreference('ai-tools.attach-first-content', true);
  page.runtime.configure({ enabled: true, source, attachFirst: true });
}

function extraText(h, text = '请检查我的解题思路\n先给提示，不要直接给答案。', enabled = true) {
  h.native.savePreference('ai-tools.extra-text', text); h.native.savePreference('ai-tools.extra-text-enabled', enabled);
  return text;
}

test('上传卡片内容、手写内容和提示词独立组合，不读取剪贴板，卡片图片始终在前', async t => {
  for (const source of ['none', 'mindmap', 'handwriting']) for (const card of [false, true]) for (const prompt of [false, true]) {
    if (source === 'none' && !card && !prompt) continue;
    const { page, h, selected } = questionConversation(t, 'review', 5684, 'hash'); linkDrawing(selected);
    h.native.savePreference('ai-tools.upload-source', source); h.native.savePreference('ai-tools.attach-first-content', card);
    extraText(h, '提示词\n请检查思路', prompt);
    Object.defineProperty(h.host, 'UIPasteboard', { get() { throw new Error('上传不能读取系统剪贴板'); } });
    selected.fixture.images.set('first', PNG);
    selected.fixture.parts = parts => parts.push({ kind: 'image', index: 1, contentId: 'first', renderable: true });
    const c = connect(h, page);
    page.document.querySelector('textarea').focus = () => { throw new Error('上传不能唤起输入法'); };
    assert.equal(page.document.querySelector('.jfjc-upload-content').disabled, false);
    await c.upload.start(c.controller, 'composer-1');
    assert.equal(page.calls.length, (card ? 1 : 0) + (source === 'none' ? 0 : 1));
    assert.equal(page.draft(), '保留我的提问' + (card ? '\n\n题干' : '') + (prompt ? '\n\n提示词\n请检查思路' : ''));
    if (card) assert.match(page.calls[0].name, /^卡片图片-/);
    if (source !== 'none') assert.ok(page.calls.at(-1).name.startsWith(source === 'mindmap' ? '脑图手写-' : '卡片手写-'));
    assert.equal(page.sends(), 0); assert.equal(c.controller.uploadOperation, null);
  }
});

test('旧网页上传协议明确提示重新加载，读取前停止，不发送不兼容数据', async t => {
  const { page, selected, upload, controller } = questionConversation(t);
  const context = page.runtime.context;
  page.runtime.context = (...args) => ({ ...context(...args), protocol: undefined });
  await assert.rejects(upload.start(controller, 'composer-1'), /重新加载数学页/);
  assert.deepEqual(selected.reads, []); assert.equal(page.calls.length, 0);
});

test('同页多个输入框仅向点击的输入框加入提示词，不覆盖另一份提问', async t => {
  const page = review(t), h = nativeHost(); extraText(h, '提示词');
  const first = page.document.querySelector('form'), second = first.cloneNode(true);
  second.querySelector('textarea').value = '另一份提问'; first.parentNode.appendChild(second);
  const c = connect(h, page); await c.upload.start(c.controller, 'composer-2');
  assert.equal(first.querySelector('textarea').value, '保留我的提问');
  assert.equal(second.querySelector('textarea').value, '另一份提问\n\n提示词'); assert.equal(page.inputs(), 0);
});

test('无手写且未选卡片和提示词时按钮禁用并明确提示，不创建媒体任务', async t => {
  const page = review(t), h = nativeHost(), c = connect(h, page);
  assert.equal(page.document.querySelector('.jfjc-upload-content').disabled, true);
  assert.match(page.document.querySelector('.jfjc-upload-content').title, /选择上传内容/);
  await assert.rejects(c.upload.start(c.controller, 'composer-1'), /选择上传卡片内容/);
  assert.equal(c.controller.uploadOperation, undefined); assert.equal(page.calls.length, 0);
  assert.equal(page.draft(), '保留我的提问');
});

test('仅提示词不需要选卡和 MN 学习集，附件满额或文件上传禁用仍能加入长文字', async t => {
  const page = review(t), h = nativeHost(), text = '中文😀\n$\\frac{1}{2}$'.repeat(800);
  extraText(h, text); h.switchNotebook('closed');
  const c = connect(h, page), editor = page.document.querySelector('textarea'); editor.selectionStart = 0; editor.selectionEnd = editor.value.length;
  for (let i = 0; i < 5; i++) page.document.querySelector('form').insertAdjacentHTML('beforeend', '<div class="assistant-attachment-item is-uploaded"></div>');
  page.document.querySelector('input[type="file"]').disabled = true;
  await c.upload.start(c.controller, 'composer-1');
  assert.equal(page.draft(), '保留我的提问\n\n' + text); assert.equal(page.inputs(), 1); assert.equal(page.calls.length, 0);
});

test('上传卡片、手写和提示词时不主动聚焦或失焦，原输入框有焦点才调整光标', async t => {
  for (const source of ['none', 'mindmap', 'handwriting']) for (const focused of [false, true]) {
    const { page, h, selected } = questionConversation(t); linkDrawing(selected);
    h.native.savePreference('ai-tools.upload-source', source); extraText(h, '提示词');
    const c = connect(h, page), editor = page.document.querySelector('textarea'), other = page.document.querySelector('.assistant-pro-toggle');
    const active = focused ? editor : other; let ranges = 0;
    Object.defineProperty(page.document, 'activeElement', { configurable: true, get: () => active });
    editor.focus = editor.blur = () => { throw new Error('上传不应改变输入焦点'); };
    editor.setSelectionRange = () => { ranges++; };
    await c.upload.start(c.controller, 'composer-1');
    assert.equal(page.document.activeElement, active); assert.equal(ranges, focused ? 1 : 0);
    assert.equal(page.draft(), '保留我的提问\n\n提示词'); assert.equal(page.sends(), 0);
  }
});

test('只上传卡片首条文字时无需手写批注，保留对应题卡规则且不读取任何笔迹', async t => {
  const { page, h, selected } = questionConversation(t); linkDrawing(selected); attachFirst(h, page, 'none');
  selected.note.comments = selected.note.comments.slice(0, 1);
  const c = connect(h, page); await c.upload.start(c.controller, 'composer-1');
  assert.equal(page.draft(), '保留我的提问\n\n题干'); assert.equal(page.calls.length, 0); assert.deepEqual(selected.reads, []);
});

test('复盘题号未加载时手写与卡片内容仍禁用，仅提示词可独立加入', async t => {
  const { page, h, selected, upload, controller } = questionConversation(t);
  page.document.querySelector('.review-question-card').setAttribute('aria-busy', 'true');
  await assert.rejects(upload.start(controller, 'composer-1'), /读取当前题号/);
  h.native.savePreference('ai-tools.upload-source', 'none'); extraText(h, '只使用提示词');
  const c = connect(h, page); await c.upload.start(c.controller, 'composer-1');
  assert.equal(page.draft(), '保留我的提问\n\n只使用提示词'); assert.deepEqual(selected.reads, []);
});

test('图文包分块拒绝损坏图片、非法类型、超额和旧传输，不提前加入有效内容', t => {
  for (const bad of ['bytes', 'signature', 'type', 'many', 'name', 'text']) {
    const page = review(t); page.runtime.configure({ source: 'none', hasPrompt: true });
    const first = { name: '卡片图片', type: 'image/png', bytes: PNG.length, base64: PNG.toString('base64') };
    const next = { ...first };
    if (bad === 'bytes') next.bytes++;
    if (bad === 'signature') next.base64 = 'AAAA' + next.base64.slice(4);
    if (bad === 'type') next.type = 'image/svg+xml';
    if (bad === 'name') next.name = '剪贴板图片';
    const data = JSON.stringify({ files: bad === 'many' ? Array(6).fill(first) : [first, next], text: bad === 'text' ? null : '不应提前加入的文字' });
    const target = page.runtime.context('composer-1', true);
    assert.equal(page.runtime.prepare(target, 'test-bundle', data.length), true);
    assert.equal(page.runtime.append('wrong', 0, data), false); assert.equal(page.runtime.append('test-bundle', 1, data), false);
    assert.equal(page.runtime.append('test-bundle', 0, data), true);
    assert.equal(page.runtime.commit('test-bundle'), false); assert.equal(page.calls.length, 0); assert.equal(page.draft(), '保留我的提问');
  }
});

test('提示词传输中编辑提问或切换上下文时停止，保留用户新草稿', t => {
  for (const change of ['draft', 'context', 'source', 'prompt']) {
    const page = review(t); page.runtime.configure({ source: 'none', hasPrompt: true });
    const target = page.runtime.context('composer-1', true), data = JSON.stringify({ files: [], text: '不应加入的文字' });
    assert.equal(page.runtime.prepare(target, 'prompt', data.length), true);
    if (change === 'draft') page.document.querySelector('textarea').value = '用户新草稿';
    if (change === 'context') page.document.querySelector('small').textContent = '题目上下文 #5520';
    if (change === 'source') page.runtime.configure({ source: 'mindmap' });
    if (change === 'prompt') page.runtime.configure({ hasPrompt: false });
    const appended = page.runtime.append('prompt', 0, data);
    if (change === 'draft') { assert.equal(appended, true); assert.equal(page.runtime.commit('prompt'), false); }
    else assert.equal(appended, false);
    assert.equal(page.document.querySelector('textarea').value, change === 'draft' ? '用户新草稿' : '保留我的提问');
  }
});

test('任意图片失败前已独立添加卡片文字和提示词，失败重试不重复添加或发送', async t => {
  for (const source of ['none', 'handwriting', 'mindmap']) for (const fail of source === 'none' ? ['card'] : ['card', 'source', 'both']) {
    const { page, h, selected, upload, controller } = questionConversation(t);
    linkDrawing(selected); attachFirst(h, page, source); extraText(h, '固定的提示词');
    selected.fixture.images.set('first', PNG);
    selected.fixture.parts = parts => parts.push({ kind: 'image', index: 1, contentId: 'first', renderable: true });
    let textAtPaste;
    page.document.querySelector('textarea').addEventListener('paste', () => {
      textAtPaste = page.draft();
      for (const item of page.document.querySelectorAll('.assistant-attachment-item')) {
        const card = item.querySelector('strong').textContent.startsWith('卡片图片-');
        if (fail === 'both' || card === (fail === 'card')) item.className = 'assistant-attachment-item is-failed';
      }
    });
    await assert.rejects(upload.start(controller, 'composer-1'), /上传失败/);
    assert.equal(textAtPaste, '保留我的提问\n\n题干\n\n固定的提示词');
    assert.equal(page.draft(), textAtPaste); assert.equal(page.calls.length, source === 'none' ? 1 : 2);
    page.document.querySelectorAll('.assistant-attachment-item').forEach(item => { item.className = 'assistant-attachment-item is-uploaded'; });
    page.runtime.install();
    assert.equal(page.draft(), textAtPaste); assert.equal(page.inputs(), 1); assert.equal(page.sends(), 0);
  }
});

test('失败附件重试后节点重建或移到末尾，仍显示卡片图片在手写前，保留原有附件及草稿', async t => {
  const { page, h, selected, upload, controller } = questionConversation(t);
  linkDrawing(selected); attachFirst(h, page); extraText(h, '提示词');
  selected.fixture.images.set('first', PNG);
  selected.fixture.parts = parts => parts.push({ kind: 'image', index: 1, contentId: 'first', renderable: true });
  const form = page.document.querySelector('form');
  form.insertAdjacentHTML('beforeend', '<div class="assistant-attachment-item is-uploaded"><span class="assistant-attachment-copy"><strong>原有图片.png</strong></span></div>');
  page.document.querySelector('textarea').addEventListener('paste', () => {
    const card = Array.from(form.querySelectorAll('.assistant-attachment-item')).find(item => item.querySelector('strong').textContent.startsWith('卡片图片-'));
    card.className = 'assistant-attachment-item is-failed';
  });
  await assert.rejects(upload.start(controller, 'composer-1'), /上传失败/);
  const items = Array.from(form.querySelectorAll('.assistant-attachment-item')), card = items[1], ink = items[2];
  const retry = card.cloneNode(true); retry.className = 'assistant-attachment-item is-uploading'; retry.style.removeProperty('order');
  card.remove(); form.appendChild(retry);
  await new Promise(resolve => setTimeout(resolve, 120));
  const visible = Array.from(form.querySelectorAll('.assistant-attachment-item')).sort((a, b) => Number(a.style.order || 0) - Number(b.style.order || 0));
  assert.equal(visible[0], items[0]); assert.equal(visible[1], retry); assert.equal(visible[2], ink);
  retry.className = 'assistant-attachment-item is-uploaded'; page.runtime.install();
  assert.equal(page.calls.length, 2); assert.equal(page.inputs(), 1); assert.equal(page.sends(), 0);
  assert.equal(page.draft(), '保留我的提问\n\n题干\n\n提示词');
  page.document.querySelector('.review-chat-heading small').textContent = '题目上下文 #5520'; page.runtime.install();
  assert.equal(retry.style.order || '', ''); assert.equal(ink.style.order || '', '');
});

test('脑图附带同一题卡的首条文字，清理内部标记和原题入口，追加草稿且不发送', async t => {
  for (const mode of ['review', 'solve']) {
    const { page, h, selected, upload, controller } = questionConversation(t, mode);
    linkDrawing(selected); attachFirst(h, page);
    selected.note.comments[0].text += '\n[查看原题](marginnote4app://example)\n公式 $x^2$';
    selected.note.comments[4].text = '不能附带后续评论';
    const other = h.database.createNoteWithTitleTopicid('别的卡', 'book-1'); other.comments = [{ text: '不能借用其他卡片' }];
    h.notebookController.mindmapView.selViewLst = [{ note: other }];
    const editor = page.document.querySelector('textarea'); editor.setSelectionRange(0, 6);
    await upload.start(controller, 'composer-1');
    assert.equal(page.calls.length, 1); assert.match(page.calls[0].name, /^脑图手写-/);
    assert.equal(editor.value, '保留我的提问\n\n题干\n\n\n公式 $x^2$');
    page.rerender(); assert.equal(page.draft(), editor.value); assert.equal(page.inputs(), 1); assert.equal(page.sends(), 0);
    assert.match(h.hud.at(-1), /上传内容已添加/);
  }
});

test('脑图附带首条图片或混合图文，卡片图片按原顺序在前、手写图片在后', async t => {
  for (const mixed of [false, true]) for (const count of [1, 2]) {
    const { page, h, selected, upload, controller } = questionConversation(t); linkDrawing(selected); attachFirst(h, page);
    const picture = Buffer.concat([PNG, Buffer.from('first-picture')]);
    const second = Buffer.concat([PNG, Buffer.from('second-picture')]);
    const handwriting = Buffer.concat([PNG, Buffer.from('brain-handwriting')]);
    selected.fixture.mindmapPNG = handwriting;
    selected.fixture.images.set('first/a b', picture); selected.fixture.images.set('first-2', second);
    selected.fixture.parts = parts => {
      const text = parts.find(p => p.index === 1);
      if (mixed) text.text += '\n![题图](marginnote-media://one)';
      else parts.splice(parts.indexOf(text), 1);
      parts.push(...['first/a b', 'first-2'].slice(0, count).map(contentId => ({ kind: 'image', index: 1, contentId, renderable: true })));
    };
    await upload.start(controller, 'composer-1');
    assert.equal(page.calls.length, count + 1);
    assert.equal(new Set(page.calls.map(file => file.name)).size, count + 1);
    assert.deepEqual(Buffer.from(await page.calls[0].arrayBuffer()), picture);
    if (count === 2) assert.deepEqual(Buffer.from(await page.calls[1].arrayBuffer()), second);
    assert.deepEqual(Buffer.from(await page.calls[count].arrayBuffer()), handwriting);
    const order = ['mindmap', 'first/a b', 'first-2'].slice(0, count + 1);
    assert.deepEqual(selected.reads, [...order, ...order]);
    assert.equal(page.document.querySelector('textarea').value, mixed ? '保留我的提问\n\n题干' : '保留我的提问');
    assert.equal(page.sends(), 0);
  }
});

test('首条使用非空正文或第一个评论，不跳到后续评论；空正文不遮挡第一条评论', async t => {
  for (const root of ['', '正文首条']) {
    const { page, h, selected, upload, controller } = questionConversation(t); linkDrawing(selected); attachFirst(h, page);
    selected.fixture.parts = parts => parts.push({ kind: 'text', index: 0, text: root }, { kind: 'title', index: -1, text: '不是正文' });
    await upload.start(controller, 'composer-1');
    assert.equal(page.document.querySelector('textarea').value, '保留我的提问\n\n' + (root || '题干'));
  }
  for (const text of ['', '<!-- JFJC_QUESTION:237:5684 -->\n[查看原题](mn://link)']) {
    const { page, h, selected, upload, controller } = questionConversation(t); attachFirst(h, page);
    selected.note.comments[0].text = text;
    await assert.rejects(upload.start(controller, 'composer-1'), /首条没有可上传/);
    assert.equal(page.calls.length, 0); assert.equal(page.document.querySelector('textarea').value, '保留我的提问');
  }
});

test('首条文字超过 64K 时中文、表情和公式分块往返完整，空草稿不增加多余换行', async t => {
  const { page, h, selected, upload, controller } = questionConversation(t); linkDrawing(selected); attachFirst(h, page);
  const text = '甲😀 $x^2$\n'.repeat(9000); selected.note.comments[0].text += '\n' + text;
  page.document.querySelector('textarea').value = '';
  await upload.start(controller, 'composer-1');
  assert.equal(page.document.querySelector('textarea').value, '题干\n\n' + text.trim());
  assert.equal(page.calls.length, 1); assert.equal(page.sends(), 0);
});

test('首条发生变化、草稿编辑、改开关或缺失媒体时，整批内容不进入网站', async t => {
  for (const action of ['first', 'draft', 'setting', 'setting-back', 'missing', 'truncated', 'unsupported', 'unresolved-image']) {
    const { page, h, selected, upload, controller } = questionConversation(t); linkDrawing(selected); attachFirst(h, page);
    if (action === 'missing') selected.fixture.parts = parts => parts.push({ kind: 'image', index: 1, contentId: 'missing', renderable: false });
    if (action === 'truncated') selected.fixture.parts = parts => { parts.find(p => p.index === 1).truncated = true; };
    if (action === 'unsupported') selected.fixture.parts = parts => parts.push({ kind: 'audio', index: 1 });
    if (action === 'unresolved-image') selected.note.comments[0].text += '\n![没有媒体](https://example.com/a.png)';
    selected.fixture.beforeImage = () => {
      if (action === 'first') selected.note.comments[0].text += '修改了首条';
      if (action === 'draft') page.document.querySelector('textarea').value = '用户的新提问';
      if (action === 'setting') h.native.savePreference('ai-tools.attach-first-content', false);
      if (action === 'setting-back') { page.runtime.configure({ attachFirst: false }); page.runtime.configure({ attachFirst: true }); }
    };
    await assert.rejects(upload.start(controller, 'composer-1'), /首条|内容已变化|设置已变化|切换/);
    assert.equal(page.calls.length, 0); assert.equal(page.document.querySelector('textarea').value, action === 'draft' ? '用户的新提问' : '保留我的提问');
    assert.equal(controller.uploadOperation, null); assert.equal(controller.handwritingRequest, null);
  }
});

test('脑图附带图片检查整批附件容量；过多图片或现有附件不够放时不会只添加一部分', async t => {
  for (const count of [2, 5]) {
    const { page, h, selected, upload, controller } = questionConversation(t); linkDrawing(selected); attachFirst(h, page);
    selected.fixture.parts = parts => {
      for (let i = 0; i < count; i++) { const contentId = 'first-' + i; selected.fixture.images.set(contentId, PNG); parts.push({ kind: 'image', index: 1, contentId, renderable: true }); }
    };
    if (count === 2) for (let i = 0; i < 3; i++) {
      const item = page.document.createElement('div'); item.className = 'assistant-attachment-item is-uploaded'; page.document.querySelector('form').appendChild(item);
    }
    await assert.rejects(upload.start(controller, 'composer-1'), /超过 5 个/);
    assert.equal(page.calls.length, 0); assert.equal(page.document.querySelector('textarea').value, '保留我的提问');
  }
});

test('首条图片在读取期间改变，即使媒体标识不变也不上传旧图', async t => {
  const { page, h, selected, upload, controller } = questionConversation(t); linkDrawing(selected); attachFirst(h, page);
  selected.fixture.images.set('first', PNG);
  selected.fixture.parts = parts => parts.push({ kind: 'image', index: 1, contentId: 'first', renderable: true });
  selected.fixture.beforeImage = () => { if (selected.fixture.lastKind === 'first') selected.fixture.images.set('first', Buffer.concat([PNG, Buffer.from('changed')])); };
  await assert.rejects(upload.start(controller, 'composer-1'), /首条图片已变化/);
  assert.equal(page.calls.length, 0);
});

test('文字先于图片加入草稿，网站失败仍保留文字，上传期间续写不会被覆盖', async t => {
  for (const action of ['failed', 'draft']) {
    const page = review(t, action === 'failed' ? 'failed' : 'uploaded'), h = nativeHost(), selected = selectedDrawing(h);
    const { upload, controller } = connect(h, page); attachFirst(h, page);
    if (action === 'draft') page.document.querySelector('textarea').addEventListener('paste', () => { page.document.querySelector('textarea').value = '图片上传时继续写的内容'; });
    if (action === 'failed') await assert.rejects(upload.start(controller, 'composer-1'), /登录已失效/);
    else assert.equal(await upload.start(controller, 'composer-1'), true);
    assert.equal(page.calls.length, 1); assert.equal(page.document.querySelector('textarea').value, action === 'draft' ? '图片上传时继续写的内容' : '保留我的提问\n\n题干');
    assert.equal(page.sends(), 0);
  }
});

test('复盘和解题可按题号上传独立脑图手写，未选或选中其他卡均不改变来源，保留草稿且不发送', async t => {
  for (const mode of ['review', 'solve']) for (const selection of ['none', 'other']) {
    const { page, h, selected, upload, controller } = questionConversation(t, mode);
    linkDrawing(selected); useMindmap(h, page);
    const data = Buffer.concat([PNG, Buffer.from('mindmap-only')]); selected.fixture.mindmapPNG = data;
    const other = h.database.createNoteWithTitleTopicid('其他卡片', 'book-1');
    const nodes = selection === 'none' ? [] : [{ note: other }]; h.notebookController.mindmapView.selViewLst = nodes;
    h.notebookController.focusNote = other;
    assert.match(page.document.querySelector('.jfjc-upload-content').title, /已保存的脑图手写/);
    await upload.start(controller, 'composer-1');
    assert.deepEqual(selected.reads, ['mindmap', 'mindmap']); 
    assert.equal(page.calls.length, 1); assert.match(page.calls[0].name, /^脑图手写-/);
    assert.deepEqual(Buffer.from(await page.calls[0].arrayBuffer()), data);
    assert.equal(h.notebookController.mindmapView.selViewLst, nodes); assert.equal(h.notebookController.focusNote, other);
    assert.equal(page.document.querySelector('textarea').value, '保留我的提问'); assert.equal(page.sends(), 0);
    assert.ok(selected.fixture.panels[0].closed); assert.equal(controller.handwritingRequest, null);
  }
});

test('没有卡片手写评论时仍可上传脑图手写；找不到题卡和普通对话可使用单张选中卡', async t => {
  for (const mode of ['review', 'ordinary']) {
    const setup = mode === 'review' ? questionConversation(t) : (() => {
      const page = review(t, 'uploaded', '/assistant/conversations/42'), h = nativeHost(), selected = selectedDrawing(h);
      page.document.querySelector('.review-chat-pane').className = 'ordinary-chat';
      return { page, h, selected, ...connect(h, page) };
    })();
    const { page, h, selected, upload, controller } = setup; useMindmap(h, page);
    selected.note.comments = [{ text: '仅有脑图手写，没有 PaintNote 评论' }];
    await upload.start(controller, 'composer-1');
    assert.equal(page.calls.length, 1); assert.match(h.hud[0], /使用当前选中卡片/);
    assert.deepEqual(selected.reads, ['mindmap', 'mindmap']);
  }
});

test('没有脑图手写、来源不唯一、归属不符、未保存或只有留白笔迹时明确失败，不借用卡片手写', async t => {
  for (const condition of ['missing', 'duplicate', 'owner', 'unsaved', 'blank']) {
    const { page, h, selected, upload, controller } = questionConversation(t); linkDrawing(selected); useMindmap(h, page);
    if (condition === 'missing') selected.fixture.mindmapMissing = true;
    else selected.fixture.parts = parts => {
      const part = parts.find(p => p.source === 'mindmap');
      if (condition === 'duplicate') parts.push({ ...part });
      if (condition === 'owner') part.noteid = 'other-card';
      if (condition === 'unsaved') part.renderable = false;
      if (condition === 'blank') part.source = 'blank';
    };
    await assert.rejects(upload.start(controller, 'composer-1'), /没有可读取的脑图手写或来源不唯一/);
    assert.equal(page.calls.length, 0); assert.deepEqual(selected.reads, []);
    assert.equal(controller.uploadOperation, null); assert.ok(selected.fixture.panels.every(p => p.closed));
  }
});

test('脑图媒体标识不变但 PNG 内容变化时拒绝旧图片，比较实际字节而非仅长度', async t => {
  const { page, h, selected, upload, controller } = questionConversation(t); linkDrawing(selected); useMindmap(h, page);
  selected.fixture.mindmapPNG = Buffer.concat([PNG, Buffer.from([1, 2])]);
  selected.fixture.beforeImage = () => { selected.fixture.mindmapPNG = Buffer.concat([PNG, Buffer.from([1, 3])]); };
  await assert.rejects(upload.start(controller, 'composer-1'), /脑图手写已变化/);
  assert.deepEqual(selected.reads, ['mindmap', 'mindmap']); assert.equal(page.calls.length, 0);
  assert.equal(controller.handwritingRequest, null); assert.ok(selected.fixture.panels[0].closed);
});

test('脑图读取期间切题、改身份、删卡、移动、切学习集、切来源或关闭面板时不上传', async t => {
  for (const action of ['question', 'identity', 'deleted', 'moved', 'notebook', 'source', 'close']) {
    const { page, h, selected, upload, controller } = questionConversation(t, 'solve'); linkDrawing(selected); useMindmap(h, page);
    selected.fixture.beforeImage = () => {
      if (action === 'question') page.document.querySelector('.solve-thread-title').textContent = '正在讨论：#5685';
      if (action === 'identity') linkDrawing(selected, 5685);
      if (action === 'deleted') h.notes.delete(selected.note.noteId);
      if (action === 'moved') selected.note.notebookId = 'book-2';
      if (action === 'notebook') h.switchNotebook('book-2');
      if (action === 'source') { page.runtime.configure({ source: 'handwriting' }); page.runtime.configure({ source: 'mindmap' }); }
      if (action === 'close') upload.cancel(controller);
    };
    await assert.rejects(upload.start(controller, 'composer-1'), /切换|来源|删除|移动|取消|学习集/);
    assert.equal(page.calls.length, 0); assert.equal(controller.uploadOperation, null);
  }
});

test('脑图来源遇到多张匹配题卡不回退选中卡；读取单选备用来源时改选会停止', async t => {
  for (const action of ['duplicate', 'selection']) {
    const { page, h, selected, upload, controller } = questionConversation(t); useMindmap(h, page);
    if (action === 'duplicate') {
      linkDrawing(selected);
      const other = h.database.createNoteWithTitleTopicid('同题', 'book-1'); other.comments = [{ text: '<!-- JFJC_QUESTION:237:5684 -->' }];
    } else selected.fixture.beforeImage = () => { h.notebookController.mindmapView.selViewLst = []; };
    await assert.rejects(upload.start(controller, 'composer-1'), /多张同题题卡|只选中一张/);
    assert.equal(page.calls.length, 0);
  }
});

test('脑图手写与卡片手写不会互相替代；同一个按钮切换来源后读取对应图片', async t => {
  const page = review(t), h = nativeHost(), selected = selectedDrawing(h), { upload, controller } = connect(h, page);
  const data = Buffer.concat([PNG, Buffer.from('brain')]); selected.fixture.mindmapPNG = data;
  useMindmap(h, page); await upload.start(controller, 'composer-1');
  h.native.savePreference('ai-tools.upload-source', 'handwriting'); page.runtime.configure({ source: 'handwriting' });
  await upload.start(controller, 'composer-1');
  assert.deepEqual(selected.reads, ['mindmap', 'mindmap', 'last']);
  assert.deepEqual(Buffer.from(await page.calls[0].arrayBuffer()), data);
  assert.deepEqual(Buffer.from(await page.calls[1].arrayBuffer()), PNG);
  assert.equal(page.document.querySelectorAll('.jfjc-upload-content').length, 1); assert.equal(page.sends(), 0);
});

test('新版复盘上传读取期间井号题号变化时停止，不添加旧题图片', async t => {
  const { page, selected, upload, controller } = questionConversation(t, 'review', 5684, 'hash');
  linkDrawing(selected);
  selected.fixture.beforeImage = () => {
    const number = page.document.querySelector('.review-question-source span[aria-label]');
    number.textContent = '#5685'; number.setAttribute('aria-label', '#5685');
  };
  await assert.rejects(upload.start(controller, 'composer-1'), /切换|结束/);
  assert.equal(page.calls.length, 0); assert.equal(page.sends(), 0);
});

test('真实复盘和解题按题号读取最后手写；未选、多选和选中别卡均不改变来源或焦点', async t => {
  for (const mode of ['review', 'solve']) for (const selection of ['none', 'multiple', 'other']) {
    const { page, h, selected, upload, controller } = questionConversation(t, mode);
    linkDrawing(selected);
    const other = h.database.createNoteWithTitleTopicid('其他题', 'book-1');
    h.notebookController.focusNote = other;
    const nodes = selection === 'none' ? [] : selection === 'multiple' ? [{ note: other }, { note: selected.note }] : [{ note: other }];
    h.notebookController.mindmapView.selViewLst = nodes;
    const target = page.runtime.context('composer-1');
    assert.equal(target.question.questionId, 5684); assert.notEqual(target.question.questionId, Number(target.item));
    assert.equal(page.window.__JFJC_QUESTION_TOOLS__.matches(target.question), false);
    h.host.MNUtil.focusNoteInMindMapById = () => { throw new Error('上传不能定位或改选'); };
    assert.equal(await upload.start(controller, 'composer-1'), true);
    assert.deepEqual(selected.reads, ['last']); assert.equal(page.calls.length, 1); 
    assert.equal(h.notebookController.focusNote, other); assert.equal(h.notebookController.mindmapView.selViewLst, nodes);
    assert.equal(page.sends(), 0); assert.equal(page.document.querySelector('textarea').value, '保留我的提问');
    assert.equal(h.hud.some(text => /使用当前选中/.test(text)), false);
  }
});

test('找不到对应题卡才使用点击时的单张选中卡，并提示来源；无选中或多选明确失败', async t => {
  for (const selection of ['single', 'none', 'multiple']) {
    const { page, h, selected, upload, controller } = questionConversation(t);
    if (selection === 'none') h.notebookController.mindmapView.selViewLst = [];
    if (selection === 'multiple') h.notebookController.mindmapView.selViewLst.push({ note: selected.note });
    if (selection === 'single') {
      await upload.start(controller, 'composer-1');
      assert.match(h.hud[0], /未找到对应题卡，使用当前选中卡片/); assert.equal(page.calls.length, 1);
    } else {
      await assert.rejects(upload.start(controller, 'composer-1'), /只选中一张/);
      assert.equal(selected.reads.length, 0); assert.equal(page.calls.length, 0);
    }
  }
});

test('对应卡无手写或同题多卡则停止；身份冲突的卡不参与匹配，按未找到处理', async t => {
  for (const condition of ['no-ink', 'duplicate', 'conflict']) {
    const { page, h, selected, upload, controller } = questionConversation(t);
    const matched = h.database.createNoteWithTitleTopicid('对应题卡', 'book-1');
    matched.comments = [{ text: '<!-- JFJC_QUESTION:237:5684 -->' }];
    if (condition === 'duplicate') linkDrawing(selected);
    if (condition === 'conflict') matched.comments.push({ text: '<!-- JFJC_QUESTION:237:5685 -->' });
    if (condition === 'conflict') {
      await upload.start(controller, 'composer-1');
      assert.match(h.hud[0], /未找到对应题卡/); assert.equal(page.calls.length, 1);
    } else {
      await assert.rejects(upload.start(controller, 'composer-1'), condition === 'duplicate' ? /多张同题题卡/ : /没有可读取的手写/);
      assert.equal(page.calls.length, 0); assert.equal(selected.reads.length, 0);
    }
  }
});

test('当前学习集优先；其他学习集有唯一题卡时读取其手写，不切换学习集', async t => {
  for (const local of [true, false]) {
    const { page, h, selected, upload, controller } = questionConversation(t);
    linkDrawing(selected);
    const remote = h.database.createNoteWithTitleTopicid('其他学习集同题卡', 'book-1');
    remote.notebookId = 'book-2'; remote.comments = [{ text: '<!-- JFJC_QUESTION:237:5684 -->' }];
    if (!local) {
      selected.note.notebookId = 'book-2'; remote.comments = [];
      h.notebookController.mindmapView.selViewLst = [];
    }
    const book = { topicId: 'book-2', title: '其他学习集', notes: [remote, ...(local ? [] : [selected.note])] };
    h.notebook.notes = [...h.notes.values()].filter(note => note.notebookId === 'book-1');
    h.database.allNotebooks = () => [h.notebook, book];
    h.database.getNotebookById = id => id === 'book-1' ? h.notebook : id === 'book-2' ? book : null;
    await upload.start(controller, 'composer-1');
    assert.equal(page.calls.length, 1); assert.equal(h.notebookController.notebookId, 'book-1');
    assert.deepEqual(selected.reads, ['last']); assert.equal(controller.addon.__jfjcCardLocation, undefined);
  }
});

test('自动匹配来源后改选不影响上传，删卡、移动、改身份和改笔迹则停止', async t => {
  for (const action of ['selection', 'deleted', 'moved', 'identity', 'drawing']) {
    const { page, h, selected, upload, controller } = questionConversation(t, 'solve'); linkDrawing(selected);
    selected.fixture.beforeImage = () => {
      if (action === 'selection') h.notebookController.mindmapView.selViewLst = [];
      if (action === 'deleted') h.notes.delete(selected.note.noteId);
      if (action === 'moved') selected.note.notebookId = 'book-2';
      if (action === 'identity') linkDrawing(selected, 5685);
      if (action === 'drawing') selected.note.comments.push({ type: 'PaintNote', drawing: 'new' });
    };
    if (action === 'selection') { await upload.start(controller, 'composer-1'); assert.equal(page.calls.length, 1); }
    else {
      await assert.rejects(upload.start(controller, 'composer-1'), /不存在|删除|移动|来源已变化|批注已变化/);
      assert.equal(page.calls.length, 0);
    }
  }
});

test('真实题号变更但复盘记录编号不变或解题标题换题时，不上传旧手写', async t => {
  for (const mode of ['review', 'solve']) {
    const { page, selected, upload, controller } = questionConversation(t, mode); linkDrawing(selected);
    selected.fixture.beforeImage = () => {
      if (mode === 'solve') page.document.querySelector('.solve-thread-title').textContent = '正在讨论：#5685';
      else {
        const source = page.document.querySelector('.review-question-source');
        source.textContent = '题号：5685'; source.setAttribute('aria-label', '题号 5685');
      }
    };
    await assert.rejects(upload.start(controller, 'composer-1'), /切换|结束/); assert.equal(page.calls.length, 0);
  }
});

test('查找期间取消、切题或改选备用卡不会沿用旧请求；分批扫描给主线程响应机会', async t => {
  for (const action of ['cancel', 'question', 'selection']) {
    const { page, h, upload, controller, selected } = questionConversation(t);
    for (let i = 0; i < 151; i++) h.database.createNoteWithTitleTopicid('无关卡片', 'book-1');
    const timer = h.host.NSTimer.scheduledTimerWithTimeInterval;
    let yielded = false;
    h.host.NSTimer.scheduledTimerWithTimeInterval = (seconds, repeats, callback) => {
      if (seconds === 0.001 && !yielded) {
        yielded = true;
        if (action === 'cancel') upload.cancel(controller);
        if (action === 'question') page.document.querySelector('small').textContent = '题目上下文 #5520';
        if (action === 'selection') h.notebookController.mindmapView.selViewLst = [];
      }
      return timer(seconds, repeats, callback);
    };
    await assert.rejects(upload.start(controller, 'composer-1'), /取消|切换|只选中/);
    assert.equal(yielded, true); assert.equal(page.calls.length, 0); assert.equal(selected.reads.length, 0);
    assert.equal(controller.uploadOperation, null);
  }
});

test('所有带上传控件的 AI 对话都能上传卡片手写，保留草稿且不发送', async t => {
  for (const suffix of ['', '/solve', '/search', '/review']) {
    const page = review(t, 'uploaded', '/assistant/conversations/42' + suffix), h = nativeHost();
    if (suffix !== '/review') page.document.querySelector('.review-chat-pane').className = 'solve-pane';
    selectedDrawing(h); const connected = connect(h, page);
    assert.equal(page.document.querySelector('.jfjc-upload-content').disabled, false, suffix || '普通对话');
    await connected.upload.start(connected.controller, 'composer-1');
    assert.equal(page.calls.length, 1); assert.equal(page.calls[0].type, 'image/png');
    assert.equal(page.document.querySelector('textarea').value, '保留我的提问'); assert.equal(page.sends(), 0);
  }
});

test('官方媒体面板需要挂载学习窗口时，仍能完成读取而不超时', async t => {
  const page = review(t), h = nativeHost(), selected = selectedDrawing(h), connected = connect(h, page);
  selected.fixture.requirePresentation = true;
  const nativeTimer = h.host.NSTimer.scheduledTimerWithTimeInterval;
  h.host.NSTimer.scheduledTimerWithTimeInterval = (seconds, repeats, callback) => nativeTimer(seconds === 30 ? 0.01 : seconds, repeats, callback);
  await connected.upload.start(connected.controller, 'composer-1');
  assert.equal(page.calls.length, 1); assert.equal(selected.fixture.panels[0].shown, true);
});

test('官方读取超时显示停留阶段，关闭读取浮层立即取消并清理', async () => {
  for (const phase of ['loading', 'ready', 'media', 'background', 'close']) {
    const h = nativeHost(), selected = selectedDrawing(h); selected.fixture.paused = true;
    let timeout;
    h.host.NSTimer.scheduledTimerWithTimeInterval = (seconds, repeats, callback) => { timeout = callback; return { invalidate() {} }; };
    const owner = {}, pending = selected.api.capture({ window: {} }).content(owner), request = owner.handwritingRequest;
    const send = payload => request.panel.onMessage('receiveHandwriting', { token: request.token, ...payload });
    if (phase !== 'loading') send({ phase: 'ready' });
    if (phase === 'media' || phase === 'background') send({ phase: 'progress', stage: phase });
    const labels = { loading: /官方媒体页面加载超时/, ready: /官方卡片信息读取超时/, media: /官方手写图片读取超时/, background: /手写图片背景处理超时/, close: /已取消/ };
    const rejected = assert.rejects(pending, labels[phase]);
    if (phase === 'close') request.panel.onMessage('__closed__', {}); else timeout();
    await rejected; assert.equal(owner.handwritingRequest, null); assert.equal(request.panel.hidden, true);
  }
});

test('官方接口只读取最后一条手写 PNG，排除较早笔迹及脑图手写', async t => {
  const page = review(t), h = nativeHost(), selected = selectedDrawing(h), connected = connect(h, page);
  officialPNG(page);
  assert.equal(await connected.upload.start(connected.controller, 'composer-1'), true);
  assert.deepEqual(selected.reads, ['last']); 
  assert.equal(page.calls.length, 1); assert.equal(page.calls[0].type, 'image/png');
  assert.match(page.calls[0].name, /^卡片手写-.*\.png$/);
  assert.deepEqual(selected.fixture.painted, [['white', 0, 0, 1024, 787], ['image', 0, 0]]);
  assert.deepEqual(selected.fixture.revoked, ['blob:official-ink']);
  assert.equal(selected.fixture.panels[0].closed, true);
  assert.deepEqual(selected.fixture.calls.map(c => c.route), ['/notes/batch-get', '/notes/batch-get']);
  assert.equal(page.document.querySelector('textarea').value, '保留我的提问'); assert.equal(page.sends(), 0);
  assert.equal(connected.controller.uploadOperation, null); assert.match(h.hud.at(-1), /上传内容已添加.*点击发送/);
});

test('无选中、多选或只有普通图片时拒绝；不借用旧焦点或其他卡片', () => {
  const h = nativeHost(), selected = selectedDrawing(h);
  h.notebookController.focusNote = selected.note;
  h.notebookController.mindmapView.selViewLst = [];
  assert.throws(() => selected.api.capture({ window: {} }), /只选中一张/);
  h.notebookController.mindmapView.selViewLst = [{ note: selected.note }, { note: selected.note }];
  assert.throws(() => selected.api.capture({ window: {} }), /只选中一张/);
  h.notebookController.mindmapView.selViewLst = [{ note: selected.note }];
  selected.note.comments = [{ type: 'PaintNote', paint: 'image' }];
  assert.throws(() => selected.api.capture({ window: {} }), /没有可读取的手写/);
  assert.deepEqual(selected.reads, []);
});

test('官方接口不可用、媒体未保存或响应错误时明确失败，不回退到旧笔迹', async t => {
  for (const kind of ['api', 'missing', 'invalid-reference', 'mime', 'status', 'unsupported']) {
    const page = review(t), h = nativeHost(), selected = selectedDrawing(h), connected = connect(h, page);
    if (kind === 'api') selected.fixture.apiError = '官方接口不可用';
    if (kind === 'missing') selected.fixture.parts = parts => { parts.find(p => p.index === 3).renderable = false; };
    if (kind === 'invalid-reference') selected.note.comments[2].drawing = {};
    if (kind === 'mime') selected.fixture.responseType = 'application/json';
    if (kind === 'status') selected.fixture.status = 404;
    if (kind === 'unsupported') delete h.host.AddonWebPanel;
    await assert.rejects(connected.upload.start(connected.controller, 'composer-1'), /不可用|尚未保存|引用格式|未返回手写 PNG|缺少官方/);
    assert.equal(page.calls.length, 0); assert.ok(!connected.controller.uploadOperation);
    assert.ok(selected.fixture.panels.every(panel => panel.closed));
  }
});

test('传输时切卡、删卡、切学习集或新增最后一条笔迹，旧手写不上传', async t => {
  for (const action of ['selection', 'deleted', 'notebook', 'drawing']) {
    const page = review(t), h = nativeHost(), selected = selectedDrawing(h), connected = connect(h, page);
    officialPNG(page);
    const execute = connected.controller.webView.evaluateJavaScript;
    connected.controller.webView.evaluateJavaScript = (code, callback) => {
      if (code.includes('.append(')) {
        if (action === 'selection') h.notebookController.mindmapView.selViewLst = [];
        if (action === 'deleted') h.database.deleteBookNoteTree(selected.note.noteId);
        if (action === 'notebook') h.switchNotebook('other');
        if (action === 'drawing') selected.note.comments.push({ type: 'PaintNote', drawing: 'new' });
      }
      execute(code, callback);
    };
    await assert.rejects(connected.upload.start(connected.controller, 'composer-1'), /选中|学习集|变化/);
    assert.equal(page.calls.length, 0); assert.equal(connected.controller.uploadOperation, null);
  }
});

test('官方 PNG 读取后重新检查来源，笔迹变化时不派发网站 paste', async t => {
  const page = review(t), h = nativeHost(), selected = selectedDrawing(h), connected = connect(h, page);
  officialPNG(page, () => selected.note.comments.push({ type: 'PaintNote', drawing: 'new' }));
  await assert.rejects(connected.upload.start(connected.controller, 'composer-1'), /批注已变化/);
  assert.equal(page.calls.length, 0);
});

test('复盘切题、替换输入框或关闭面板后，迟到的 PNG 不上传', async t => {
  for (const action of ['question', 'editor', 'close']) {
    const page = review(t), h = nativeHost(); selectedDrawing(h); const connected = connect(h, page);
    officialPNG(page, () => {
      if (action === 'question') page.document.querySelector('small').textContent = '题目上下文 #9999';
      if (action === 'editor') page.document.querySelector('textarea').replaceWith(page.document.createElement('textarea'));
      if (action === 'close') connected.upload.cancel(connected.controller);
    });
    await assert.rejects(connected.upload.start(connected.controller, 'composer-1'), /切换|取消|结束/);
    assert.equal(page.calls.length, 0);
  }
});

test('手写遇到忙碌、附件满额和重复点击不会读取媒体；网站失败不误报成功', async t => {
  for (const kind of ['busy', 'full', 'failed']) {
    const page = review(t, kind === 'failed' ? 'failed' : 'uploaded'), h = nativeHost(), selected = selectedDrawing(h), connected = connect(h, page);
    officialPNG(page);
    if (kind === 'busy') page.document.querySelector('textarea').disabled = true;
    if (kind === 'full') for (let i = 0; i < 5; i++) { const item = page.document.createElement('div'); item.className = 'assistant-attachment-item'; page.document.querySelector('form').appendChild(item); }
    await assert.rejects(connected.upload.start(connected.controller, 'composer-1'), /正在处理|满 5|登录已失效/);
    assert.equal(h.hud.some(text => /已上传/.test(text)), false);
    if (kind !== 'failed') { assert.equal(h.hud.length, 0); assert.equal(selected.reads.length, 0); }
  }
  const page = review(t), h = nativeHost(); selectedDrawing(h); const connected = connect(h, page); officialPNG(page);
  const running = connected.upload.start(connected.controller, 'composer-1');
  await assert.rejects(connected.upload.start(connected.controller, 'composer-1'), /上一次上传/);
  await running; assert.equal(page.calls.length, 1);
});

test('关闭上传禁止读取手写，重新开启后复盘和解题都能上传', async t => {
  const page = review(t), h = nativeHost(), selected = selectedDrawing(h), connected = connect(h, page);
  h.native.savePreference('ai-tools.show-paste', false); page.runtime.configure({ enabled: false }); officialPNG(page);
  await assert.rejects(connected.upload.start(connected.controller, 'composer-1'), /上传已在设置中关闭/);
  assert.equal(page.calls.length, 0); assert.equal(selected.reads.length, 0);
  h.native.savePreference('ai-tools.show-paste', true); page.runtime.configure({ enabled: true });
  await connected.upload.start(connected.controller, 'composer-1');
  assert.equal(page.calls.length, 1); 
  page.location.pathname = '/assistant/conversations/42/solve'; page.document.querySelector('.review-chat-pane').className = 'solve-pane';
  const count = selected.reads.length;
  await connected.upload.start(connected.controller, 'composer-1');
  assert.equal(selected.reads.length, count + 1); assert.equal(page.calls.length, 2);
});

test('官方媒体读取独立于 MN Utils 媒体封装，不解码 drawing', async t => {
  const page = review(t), h = nativeHost(); selectedDrawing(h); const connected = connect(h, page);
  h.host.MNUtil.getMediaByHash = () => { throw new Error('不应调用外部媒体封装'); };
  await connected.upload.start(connected.controller, 'composer-1');
  assert.equal(page.calls[0].type, 'image/png'); 
});

test('官方 PNG 经多段传输保持完整且只上传一次', async t => {
  const data = Buffer.concat([PNG, Buffer.alloc(100000, 97)]);
  const page = review(t), h = nativeHost(), selected = selectedDrawing(h, data), connected = connect(h, page);
  await connected.upload.start(connected.controller, 'composer-1');
  assert.deepEqual(Buffer.from(await page.calls[0].arrayBuffer()), data);
  assert.equal(page.calls.length, 1); assert.equal(page.sends(), 0);
  assert.equal(connected.controller.handwritingRequest, null); assert.ok(selected.fixture.panels[0].closed);
});

test('官方图片分块拒绝来源串用、缺块和非 PNG，不留下挂起的读取', async () => {
  for (const kind of ['offset', 'missing', 'signature', 'length']) {
    const h = nativeHost(), selected = selectedDrawing(h); selected.fixture.paused = true;
    const owner = {}, capture = selected.api.capture({ window: {} }), pending = capture.content(owner);
    const request = owner.handwritingRequest, panel = request.panel, base64 = PNG.toString('base64');
    const send = payload => panel.onMessage('receiveHandwriting', { token: request.token, ...payload });
    assert.throws(() => selected.api.receive(owner, { token: request.token }, {}), /来源不符/);
    assert.throws(() => panel.onMessage('receiveHandwriting', { token: 'other' }), /来源不符/);
    const rejected = assert.rejects(pending, /大小或来源无效|分块无效|PNG 不完整/);
    assert.throws(() => {
      send({ phase: 'begin', noteId: request.noteId, index: request.index, bytes: PNG.length, length: kind === 'length' ? 4 : base64.length });
      send({ phase: 'chunk', offset: kind === 'offset' ? 1 : 0, text: kind === 'missing' ? base64.slice(0, -4) : kind === 'signature' ? base64.replace('iVBOR', 'abcde') : base64 });
      send({ phase: 'finish' });
    }, /大小或来源无效|分块无效|PNG 不完整/);
    await rejected; assert.equal(owner.handwritingRequest, null); assert.equal(panel.closed, true);
  }
});

test('官方面板超时或用户取消会释放读取，迟到分块不能复用', async () => {
  for (const action of ['timeout', 'cancel']) {
    const h = nativeHost(), selected = selectedDrawing(h); selected.fixture.paused = true;
    let timeout, invalidated = false;
    h.host.NSTimer.scheduledTimerWithTimeInterval = (seconds, repeats, callback) => { assert.equal(seconds, 30); timeout = callback; return { invalidate() { invalidated = true; } }; };
    const owner = {}, capture = selected.api.capture({ window: {} }), pending = capture.content(owner), request = owner.handwritingRequest;
    const rejected = assert.rejects(pending, /超时|取消/);
    if (action === 'timeout') timeout(); else capture.cancel();
    await rejected; assert.equal(owner.handwritingRequest, null); assert.equal(request.panel.closed, true); assert.equal(invalidated, true);
    assert.throws(() => request.panel.onMessage('receiveHandwriting', { token: request.token, phase: 'finish' }), /取消或来源不符/);
  }
});

test('卡片图文回传拒绝错误格式、假字节数、缺块和过多文件并释放面板', async () => {
  for (const kind of ['format', 'bytes', 'file-bytes', 'missing', 'files']) {
    const h = nativeHost(), selected = selectedDrawing(h); selected.fixture.paused = true;
    const owner = {}, capture = selected.api.capture({ window: {} }, null, null, 'mindmap'), pending = capture.content(owner, true);
    const request = owner.handwritingRequest, panel = request.panel;
    const file = { base64: PNG.toString('base64'), bytes: PNG.length + (kind === 'file-bytes' ? 1 : 0) };
    const payload = JSON.stringify({ text: '题干', files: Array.from({ length: kind === 'files' ? 6 : 1 }, () => file) });
    const send = data => panel.onMessage('receiveHandwriting', { token: request.token, ...data });
    const rejected = assert.rejects(pending, /无效|不完整/);
    assert.throws(() => {
      send({ phase: 'begin', noteId: request.noteId, index: request.index, bytes: PNG.length + (kind === 'bytes' ? 1 : 0), length: payload.length, format: kind === 'format' ? 'png' : 'bundle' });
      send({ phase: 'chunk', offset: 0, text: kind === 'missing' ? payload.slice(0, -1) : payload });
      send({ phase: 'finish' });
    }, /无效|不完整/);
    await rejected; assert.equal(owner.handwritingRequest, null); assert.equal(panel.closed, true);
  }
});

test('官方 PNG 解码、补白底失败或输出超限时不生成附件，释放面板和对象 URL', async t => {
  for (const kind of ['canvasError', 'blobError', 'oversize', 'decodeError']) {
    const page = review(t), h = nativeHost(), selected = selectedDrawing(h), connected = connect(h, page);
    selected.fixture[kind] = true;
    await assert.rejects(connected.upload.start(connected.controller, 'composer-1'), /无法处理|生成失败|超过网站 10|无法解码/);
    assert.equal(page.calls.length, 0); assert.ok(!connected.controller.uploadOperation);
    assert.ok(selected.fixture.panels.every(panel => panel.closed));
    assert.deepEqual(selected.fixture.revoked, ['blob:official-ink']);
  }
});

test('官方图片读取期间切换来源再切回来，也不能恢复旧请求', async t => {
  const page = review(t), h = nativeHost(); selectedDrawing(h); const connected = connect(h, page);
  officialPNG(page, () => { page.runtime.configure({ source: 'none' }); page.runtime.configure({ source: 'handwriting' }); });
  await assert.rejects(connected.upload.start(connected.controller, 'composer-1'), /切换/);
  assert.equal(page.calls.length, 0);
});

test('其他窗口改变来源或关闭上传后，原生守卫禁止迟到的图片提交', async t => {
  for (const action of ['source', 'disabled']) {
    const h = nativeHost(), page = review(t); selectedDrawing(h); const connected = connect(h, page);
    officialPNG(page, () => h.native.savePreference(action === 'source' ? 'ai-tools.upload-source' : 'ai-tools.show-paste', action === 'source' ? 'none' : false));
    await assert.rejects(connected.upload.start(connected.controller, 'composer-1'), /设置已切换|已取消/);
    assert.equal(page.calls.length, 0); assert.equal(connected.controller.uploadOperation, null);
  }
});
