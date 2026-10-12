import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { nativeHost, source, tick } from './helpers.mjs';
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
    const file = event.clipboardData.items[0].getAsFile(); calls.push(file);
    const item = document.createElement('div'); item.className = 'assistant-attachment-item is-' + state;
    const copy = document.createElement('span'); copy.className = 'assistant-attachment-copy';
    const name = document.createElement('strong'); name.textContent = file.name; copy.appendChild(name); item.appendChild(copy);
    if (state === 'failed') { const error = document.createElement('em'); error.textContent = '登录已失效'; item.appendChild(error); }
    document.querySelector('form').appendChild(item);
  });
  vm.runInContext(injection, context);
  t.after(() => { timers.forEach(clearTimeout); window.__JFJC_REVIEW__.cancel(); });
  return { document, location, window, context, calls, sends: () => sends, inputs: () => inputs, draft: () => draft, rerender: () => { editor.value = draft; }, runtime: window.__JFJC_REVIEW__ };
}
function connect(h, page, image = PNG, text = null) {
  let reads = 0;
  h.host.UIPasteboard = { generalPasteboard() { reads++; return { string: text, image: image && { pngData: () => ({ length: image.length, base64Encoding: image.toString('base64') }) } }; } };
  const controller = { addon: { window: {} }, webView: { evaluateJavaScript(code, callback) { try { callback(vm.runInContext(code, page.context), null); } catch (error) { callback(null, error); } } } };
  return { controller, reads: () => reads, clipboard: h.context.__JFJC_CLIPBOARD__ };
}

test('操作栏只添加一个粘贴按钮，位于上传和 Pro 右边，普通页面不显示', t => {
  const page = review(t);
  vm.runInContext(source('web/src/BBKaoyanReview.js'), page.context);
  assert.equal(page.document.querySelectorAll('#jfjc-paste-record').length, 1);
  const button = page.document.querySelector('#jfjc-paste-record');
  assert.equal(button.textContent, '粘贴');
  assert.equal(button.previousElementSibling.textContent, 'Pro');
  assert.equal(button.nextElementSibling.className, 'assistant-composer-hint-wrapper');
  assert.equal(page.document.querySelector('.review-chat-heading .jfjc-paste-record'), null);
  page.document.querySelector('#jfjc-paste-record').click();
  assert.equal(page.document.querySelector('iframe').src, 'jifengjincaobridge://paste-record?token=&scope=composer-1');
  page.location.pathname = '/papers/237'; assert.equal(page.runtime.context(), null);
});
test('网站实际 /review 复盘地址显示粘贴按钮，并能上传当前题目附件', async t => {
  const page = review(t, 'uploaded', '/assistant/conversations/42/review');
  assert.equal(page.document.querySelectorAll('#jfjc-paste-record').length, 1);
  assert.equal(page.runtime.context().item, '5519');
  const h = nativeHost(), connected = connect(h, page);
  assert.equal(await connected.clipboard.start(connected.controller, 'composer-1'), true);
  assert.equal(page.calls.length, 1);
  assert.equal(page.sends(), 0);
});
test('粘贴适配会话、复盘、解题、找题地址，但不识别其他页面', t => {
  for (const route of ['/assistant/conversations/42/review/', '/assistant/conversations/42', '/assistant/conversations/42/solve', '/assistant/conversations/42/search']) {
    const page = review(t, 'uploaded', route);
    assert.equal(page.document.querySelectorAll('#jfjc-paste-record').length, 1, route);
  }
  for (const route of ['/assistant/conversations/42/review/other', '/papers/237']) {
    const page = review(t, 'uploaded', route);
    assert.equal(page.document.querySelectorAll('#jfjc-paste-record').length, 0, route);
    assert.equal(page.runtime.context(), null);
  }
});
test('完整网页脚本共同注入真实复盘地址，延迟加载题目后也只显示一个按钮', async t => {
  const script = pageScriptSource();
  const page = review(t, 'uploaded', '/assistant/conversations/42/review', '(function(){' + script + ';return "injected";})()');
  assert.equal(page.document.querySelectorAll('#jfjc-paste-record').length, 1);
  const pane = page.document.querySelector('.review-chat-pane');
  pane.remove();
  vm.runInContext('(function(){' + script + ';return "injected";})()', page.context);
  assert.equal(page.document.querySelectorAll('#jfjc-paste-record').length, 0);
  pane.querySelector('#jfjc-paste-record').remove();
  page.document.body.appendChild(pane);
  await new Promise(resolve => setTimeout(resolve, 130));
  assert.equal(page.document.querySelectorAll('#jfjc-paste-record').length, 1);
  assert.equal(page.document.querySelector('#jfjc-toolbar'), null);
  const header = page.document.createElement('header'); header.className = 'topbar';
  header.innerHTML = '<div class="topbar-actions"><nav class="primary-nav"><button>AI 组件</button></nav></div>';
  page.document.body.appendChild(header);
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(page.document.querySelector('#jfjc-toolbar').hidden, false);
  assert.equal(page.document.querySelector('#jfjc-toolbar button').disabled, true);
});
test('原生剪贴板经分块与网页粘贴交给网站附件，确认上传后提示，保留草稿且不发送', async t => {
  const payload = Buffer.concat([PNG, Buffer.alloc(60000)]);
  const page = review(t), h = nativeHost(), connected = connect(h, page, payload);
  assert.equal(await connected.clipboard.start(connected.controller, 'composer-1'), true);
  assert.equal(connected.reads(), 1); assert.equal(page.calls.length, 1);
  assert.deepEqual(Buffer.from(await page.calls[0].arrayBuffer()), payload);
  assert.equal(page.calls[0].type, 'image/png');
  assert.equal(page.document.querySelector('textarea').value, '保留我的提问');
  assert.equal(page.sends(), 0);
  assert.equal(connected.controller.clipboardOperation, null);
  assert.match(h.hud.at(-1), /已上传.*请点击发送/);
});
test('WebView 将布尔 true 桥接为数字 1 时仍能完成图片粘贴', async t => {
  const page = review(t), h = nativeHost(), connected = connect(h, page);
  connected.controller.webView.evaluateJavaScript = function (code, callback) {
    try { const result = vm.runInContext(code, page.context); callback(typeof result === 'boolean' ? Number(result) : result, null); }
    catch (error) { callback(null, error); }
  };
  assert.equal(await connected.clipboard.start(connected.controller, 'composer-1'), true);
  assert.equal(page.calls.length, 1);
});
test('无图片、过大图片和错误题目均明确失败，网页目标不符时不读剪贴板', async t => {
  const page = review(t), h = nativeHost();
  let connection = connect(h, page, null);
  await assert.rejects(connection.clipboard.start(connection.controller, 'composer-1'), /没有图片或文字/);
  connection = connect(h, page);
  await assert.rejects(connection.clipboard.start(connection.controller, 'composer-99'), /目标输入框/);
  assert.equal(connection.reads(), 0);
  h.host.UIPasteboard = { generalPasteboard: () => ({ image: { pngData: () => ({ length: 11 * 1024 * 1024 }), jpegData: () => ({ length: 11 * 1024 * 1024 }) } }) };
  assert.throws(() => connection.clipboard.clipboardImage(), /10 MiB/);
  assert.equal(page.calls.length, 0);
});
test('传输缺块或切题时不粘贴到新题；网站上传失败不误报成功', async t => {
  const page = review(t, 'failed'), target = page.runtime.context();
  assert.equal(page.runtime.prepare(target, 'old', 'image/png', 'old.png', PNG.toString('base64').length), true);
  assert.equal(page.runtime.commit('old'), false);
  assert.equal(page.runtime.append('old', 1, 'aA=='), false);
  page.document.querySelector('small').textContent = '题目上下文 #5520';
  assert.equal(page.runtime.append('old', 0, PNG.toString('base64')), false);
  assert.equal(page.runtime.read('old').status, 'error'); page.runtime.cancel();
  const h = nativeHost(), connection = connect(h, page);
  await assert.rejects(connection.clipboard.start(connection.controller, 'composer-1'), /登录已失效/);
  assert.equal(h.hud.length, 0);
});
test('重复操作与取消不会继续读取或粘贴图片，站外调用被拒绝', async t => {
  const page = review(t), h = nativeHost(), connection = connect(h, page);
  connection.controller.clipboardOperation = { token: 'existing' };
  await assert.rejects(connection.clipboard.start(connection.controller, 'composer-1'), /仍在添加/);
  assert.equal(connection.reads(), 0); connection.clipboard.cancel(connection.controller);
  page.location.origin = 'https://example.com';
  await assert.rejects(connection.clipboard.start(connection.controller, 'composer-1'), /网站已切换/);
  assert.equal(connection.reads(), 0);
});
test('解题和找题没有复盘标题也能粘贴，沿用各自附件输入框', async t => {
  for (const mode of ['solve', 'search']) {
    const page = review(t, 'uploaded', '/assistant/conversations/42/' + mode);
    const pane = page.document.querySelector('.review-chat-pane'); pane.className = 'assistant-' + mode;
    pane.querySelector('.review-chat-heading').remove();
    if (mode === 'solve') {
      const upload = page.document.querySelector('.assistant-upload-button'); upload.hidden = true;
      const trigger = page.document.createElement('button'); trigger.type = 'button'; trigger.className = 'assistant-upload-trigger'; trigger.textContent = '上传';
      upload.parentNode.prepend(trigger);
    } else page.document.querySelector('.assistant-pro-toggle:not(.jfjc-paste-record)').remove();
    page.runtime.install();
    const button = page.document.querySelector('.jfjc-paste-record');
    assert.equal(button.previousElementSibling.textContent, mode === 'solve' ? 'Pro' : '上传');
    assert.equal(page.runtime.context().item, '');
    const h = nativeHost(), connected = connect(h, page);
    assert.equal(await connected.clipboard.start(connected.controller, 'composer-1'), true);
    assert.equal(page.calls.length, 1); assert.equal(page.sends(), 0);
    assert.equal(page.document.querySelector('textarea').value, '保留我的提问');
  }
});
test('忙碌时不读取剪贴板；附件满额仍可点击粘贴，但图片提示原因', async t => {
  const page = review(t), h = nativeHost(), connected = connect(h, page);
  const textarea = page.document.querySelector('textarea'), upload = page.document.querySelector('input');
  textarea.disabled = true; page.runtime.install();
  assert.equal(page.document.querySelector('.jfjc-paste-record').disabled, true);
  await assert.rejects(connected.clipboard.start(connected.controller, 'composer-1'), /正在处理/);
  assert.equal(connected.reads(), 0);
  textarea.disabled = false; upload.disabled = true;
  for (let i = 0; i < 5; i++) { const node = page.document.createElement('div'); node.className = 'assistant-attachment-item'; page.document.querySelector('form').appendChild(node); }
  page.runtime.install(); assert.equal(page.document.querySelector('.jfjc-paste-record').disabled, false);
  await assert.rejects(connected.clipboard.start(connected.controller, 'composer-1'), /已满 5 个/);
  assert.equal(connected.reads(), 1);
  upload.disabled = false; page.runtime.install();
  assert.equal(page.document.querySelector('.jfjc-paste-record').disabled, false);
  assert.equal(await connected.clipboard.start(connected.controller, 'composer-1'), true);
});
test('网页真正拒绝接收时不会把 false 当作上传成功', async t => {
  const page = review(t), h = nativeHost(), connected = connect(h, page);
  page.runtime.prepare = () => false;
  await assert.rejects(connected.clipboard.start(connected.controller, 'composer-1'), /暂时无法接收/);
  assert.equal(page.calls.length, 0); assert.equal(h.hud.length, 0);
});
test('切换对话或替换输入框时不把正在传输的图片粘贴到新对话', t => {
  const page = review(t), target = page.runtime.context(), encoded = PNG.toString('base64');
  assert.equal(page.runtime.prepare(target, 'route', 'image/png', 'route.png', encoded.length), true);
  assert.equal(page.runtime.append('route', 0, encoded), true);
  page.location.pathname = '/assistant/conversations/43/review';
  assert.equal(page.runtime.commit('route'), false); assert.equal(page.calls.length, 0);
  page.runtime.cancel(); page.location.pathname = '/assistant/conversations/42/review';
  assert.equal(page.runtime.prepare(target, 'replace', 'image/png', 'replace.png', encoded.length), true);
  const form = page.document.querySelector('form'), replacement = form.cloneNode(true);
  form.replaceWith(replacement);
  assert.equal(page.runtime.append('replace', 0, encoded), false);
  assert.equal(page.runtime.read('replace').status, 'error');
  page.runtime.cancel(); replacement.querySelector('.jfjc-paste-record').remove(); page.runtime.install();
  assert.equal(page.runtime.context().composer, 'composer-2');
});
test('同页多个输入框的附件只加入点击的输入框，旧标题入口被移除', async t => {
  const page = review(t), pane = page.document.querySelector('.review-chat-pane');
  const old = page.document.createElement('button'); old.className = 'jfjc-paste-record'; pane.querySelector('.review-chat-heading').appendChild(old);
  const extra = page.document.querySelector('form').cloneNode(true); extra.querySelector('.jfjc-paste-record').remove(); pane.appendChild(extra);
  let files = 0;
  extra.querySelector('textarea').addEventListener('paste', event => {
    files++; const item = page.document.createElement('div'); item.className = 'assistant-attachment-item is-uploaded';
    const copy = page.document.createElement('span'); copy.className = 'assistant-attachment-copy';
    const name = page.document.createElement('strong'); name.textContent = event.clipboardData.items[0].getAsFile().name; copy.appendChild(name); item.appendChild(copy); extra.appendChild(item);
  });
  page.runtime.install(); page.runtime.install();
  assert.equal(page.document.querySelectorAll('.jfjc-paste-record').length, 2);
  assert.equal(page.document.querySelector('.review-chat-heading .jfjc-paste-record'), null);
  const h = nativeHost(), connected = connect(h, page);
  assert.equal(await connected.clipboard.start(connected.controller, 'composer-2'), true);
  assert.equal(files, 1); assert.equal(page.calls.length, 0);
});

test('所有 AI 对话可粘贴中文、换行和公式；选区替换保留前后草稿并同步输入状态，不自动发送', async t => {
  const text = '复制的文字\n$\\frac{1}{2}$ "引号" <标签> 😀';
  for (const route of ['', '/review', '/solve', '/search']) {
    const page = review(t, 'uploaded', '/assistant/conversations/42' + route);
    const editor = page.document.querySelector('textarea'); editor.setSelectionRange(2, 4);
    const h = nativeHost(), connected = connect(h, page, null, text);
    assert.equal(await connected.clipboard.start(connected.controller, 'composer-1'), true);
    const expected = '保留' + text + '提问';
    assert.equal(editor.value, expected); assert.equal(page.draft(), expected); assert.equal(page.inputs(), 1);
    page.rerender(); assert.equal(editor.value, expected);
    assert.equal(editor.selectionStart, 2 + text.length); assert.equal(editor.selectionEnd, 2 + text.length);
    assert.equal(page.calls.length, 0); assert.equal(page.sends(), 0); assert.match(h.hud.at(-1), /文字已粘贴/);
    assert.equal(connected.reads(), 1); assert.equal(connected.controller.clipboardOperation, null);
  }
});
test('触摸按钮前保存选区；无选区插入光标处，空草稿也可粘贴', async t => {
  const page = review(t), editor = page.document.querySelector('textarea'), button = page.document.querySelector('.jfjc-paste-record');
  editor.setSelectionRange(2, 4); button.dispatchEvent(new page.context.Event('touchstart'));
  editor.setSelectionRange(editor.value.length, editor.value.length); button.click();
  const h = nativeHost(), connected = connect(h, page, null, '新内容');
  await connected.clipboard.start(connected.controller, 'composer-1');
  assert.equal(editor.value, '保留新内容提问');
  editor.setSelectionRange(1, 1); await connected.clipboard.start(connected.controller, 'composer-1');
  assert.equal(editor.value, '保新内容留新内容提问');
  editor.value = ''; editor.setSelectionRange(0, 0);
  await connected.clipboard.start(connected.controller, 'composer-1');
  assert.equal(editor.value, '新内容'); assert.equal(page.sends(), 0);
});
test('文字分块支持超过 64K 的 Unicode 内容和 CRLF 换行，附件满额不阻止文字', async t => {
  const text = '😀'.repeat(32767) + '界😀\r\n第二行\r第三行';
  const page = review(t), editor = page.document.querySelector('textarea'); editor.value = ''; editor.setSelectionRange(0, 0);
  page.document.querySelector('input').disabled = true;
  const h = nativeHost(), connected = connect(h, page, null, text);
  assert.equal(await connected.clipboard.start(connected.controller, 'composer-1'), true);
  assert.equal(editor.value, text.replace(/\r\n?/g, '\n'));
  assert.equal(page.draft(), editor.value); assert.equal(page.calls.length, 0); assert.equal(page.sends(), 0);
});
test('图片和文字同时存在时只添加图片，空剪贴板和过长文字明确拒绝', async t => {
  const page = review(t), h = nativeHost();
  let connected = connect(h, page, PNG, '图片附带的文字');
  await connected.clipboard.start(connected.controller, 'composer-1');
  assert.equal(page.calls.length, 1); assert.equal(page.inputs(), 0); assert.equal(page.document.querySelector('textarea').value, '保留我的提问');
  connected = connect(h, page, null, 'x'.repeat(1024 * 1024 + 1));
  await assert.rejects(connected.clipboard.start(connected.controller, 'composer-1'), /文字过长/);
  connected = connect(h, page, null, '');
  await assert.rejects(connected.clipboard.start(connected.controller, 'composer-1'), /没有图片或文字/);
});
test('文字传输期间编辑草稿、替换输入框或切换题目/对话，均不覆盖或误粘贴', t => {
  for (const action of ['draft', 'editor', 'question', 'route']) {
    const page = review(t), target = page.runtime.context(), editor = page.document.querySelector('textarea');
    assert.equal(page.runtime.prepare(target, action, 'text/plain', '文字', 2), true);
    assert.equal(page.runtime.append(action, 1, '错位'), false);
    assert.equal(page.runtime.commit(action), false);
    assert.equal(page.runtime.append(action, 0, '复制'), true);
    if (action === 'draft') editor.value += '新输入';
    if (action === 'editor') editor.replaceWith(editor.cloneNode(true));
    if (action === 'question') page.document.querySelector('small').textContent = '题目上下文 #5520';
    if (action === 'route') page.location.pathname = '/assistant/conversations/43/review';
    assert.equal(page.runtime.commit(action), false);
    assert.equal(page.inputs(), 0); assert.equal(page.sends(), 0); assert.equal(page.calls.length, 0);
    assert.doesNotMatch(page.document.querySelector('textarea').value, /复制/);
  }
});
test('点击后读取文字之前草稿发生变化会拒绝；取消后选区不会残留', t => {
  const page = review(t), editor = page.document.querySelector('textarea'), button = page.document.querySelector('.jfjc-paste-record');
  editor.setSelectionRange(0, 2); button.dispatchEvent(new page.context.Event('pointerdown'));
  editor.value += '新输入';
  assert.equal(page.runtime.prepare(page.runtime.context(), 'stale', 'text/plain', '文字', 2), false);
  assert.match(page.runtime.read('stale').error, /内容已变化/);
  page.runtime.cancel(); editor.setSelectionRange(editor.value.length, editor.value.length);
  assert.equal(page.runtime.prepare(page.runtime.context(), 'new', 'text/plain', '文字', 2), true);
  page.runtime.cancel('new'); assert.equal(page.runtime.append('new', 0, '复制'), false);
  assert.equal(page.runtime.commit('new'), false); assert.equal(page.inputs(), 0);
});
test('同页多输入框文字只粘贴到点击的输入框，仍不添加附件或发送', async t => {
  const page = review(t), extra = page.document.querySelector('form').cloneNode(true);
  extra.querySelector('.jfjc-paste-record').remove(); page.document.querySelector('.review-chat-pane').appendChild(extra);
  const editor = extra.querySelector('textarea'); editor.setSelectionRange = function (start, end) { this.selectionStart = start; this.selectionEnd = end; };
  editor.setSelectionRange(0, 0); page.runtime.install();
  const h = nativeHost(), connected = connect(h, page, null, '第二个输入框：');
  await connected.clipboard.start(connected.controller, 'composer-2');
  assert.equal(editor.value, '第二个输入框：保留我的提问');
  assert.equal(page.document.querySelector('textarea').value, '保留我的提问');
  assert.equal(page.sends(), 0); assert.equal(page.calls.length, 0);
});
test('取消触摸后通过键盘激活粘贴，不沿用取消手势的旧选区', async t => {
  const page = review(t), editor = page.document.querySelector('textarea'), button = page.document.querySelector('.jfjc-paste-record');
  editor.setSelectionRange(0, 2); button.dispatchEvent(new page.context.Event('touchstart'));
  button.dispatchEvent(new page.context.Event('touchcancel')); editor.setSelectionRange(4, 4);
  const event = new page.context.Event('keydown'); Object.defineProperty(event, 'key', { value: 'Enter' });
  button.dispatchEvent(event); button.click();
  const h = nativeHost(), connected = connect(h, page, null, '复制');
  await connected.clipboard.start(connected.controller, 'composer-1');
  assert.equal(editor.value, '保留我的复制提问'); assert.equal(page.sends(), 0);
});

function withPanel(h) {
  const classes = {};
  h.context.JSB = { defineClass(name, methods) { classes[name] = methods; return {}; } };
  vm.runInContext(source('src/WebPanelController.js'), h.context);
  return { panel: h.context.__JFJC_PANEL__, methods: classes['JifengjincaoBridgePanelController : UIViewController <UIWebViewDelegate>'] };
}
test('所有 AI 页面通过原生显示粘贴开关移除/恢复按钮，重复注入和异步输入框不绕过关闭状态', async t => {
  for (const route of ['', '/review', '/solve', '/search']) {
    const page = review(t, 'uploaded', '/assistant/conversations/42' + route), h = nativeHost();
    withPanel(h); const connected = connect(h, page), settings = h.context.__JFJC_SETTINGS__;
    assert.equal(settings.showPaste(), true);
    settings.togglePaste(connected.controller, { on: false }); await tick();
    assert.equal(page.document.querySelectorAll('.jfjc-paste-record').length, 0);
    vm.runInContext(source('web/src/BBKaoyanReview.js'), page.context);
    const extra = page.document.querySelector('form').cloneNode(true); page.document.querySelector('.review-chat-pane').appendChild(extra);
    await new Promise(resolve => setTimeout(resolve, 110));
    assert.equal(page.document.querySelectorAll('.jfjc-paste-record').length, 0);
    assert.equal(page.document.querySelector('textarea').value, '保留我的提问');
    settings.togglePaste(connected.controller, { on: true }); await tick(); page.runtime.install();
    assert.equal(page.document.querySelectorAll('.jfjc-paste-record').length, 2);
    assert.equal(page.document.querySelector('.jfjc-paste-record').previousElementSibling.textContent, 'Pro');
    assert.equal(await connected.clipboard.start(connected.controller, 'composer-1'), true);
    assert.equal(page.calls.length, 1); assert.equal(page.sends(), 0);
  }
});
test('关闭粘贴后不读取剪贴板，保留旧按钮引用或直接调用网页也不能添加内容', async t => {
  const page = review(t), h = nativeHost(); withPanel(h);
  const connected = connect(h, page, null, '文字'), target = page.runtime.context(), old = page.document.querySelector('.jfjc-paste-record');
  h.context.__JFJC_SETTINGS__.togglePaste(connected.controller, { on: false }); await tick();
  await assert.rejects(connected.clipboard.start(connected.controller, 'composer-1'), /设置中关闭/);
  assert.equal(connected.reads(), 0);
  old.click(); assert.equal(page.document.querySelector('iframe'), null);
  assert.equal(page.runtime.prepare(target, 'off', 'text/plain', '文字', 2), false);
  assert.equal(page.runtime.prepare(target, 'off', 'image/png', '图片', PNG.toString('base64').length), false);
  assert.equal(page.inputs(), 0); assert.equal(page.calls.length, 0); assert.equal(page.sends(), 0);
});
test('关闭显示粘贴取消尚未提交的传输，重新开启后文字仍可正常插入', async t => {
  const page = review(t), h = nativeHost(); withPanel(h);
  const connected = connect(h, page, null, '文字'), target = page.runtime.context();
  assert.equal(page.runtime.prepare(target, 'pending', 'text/plain', '文字', 2), true);
  assert.equal(page.runtime.append('pending', 0, '文'), true);
  connected.controller.clipboardOperation = { token: 'pending' };
  h.context.__JFJC_SETTINGS__.togglePaste(connected.controller, { on: false }); await tick();
  assert.equal(connected.controller.clipboardOperation, null); assert.equal(page.runtime.read('pending').status, 'cancelled');
  assert.equal(page.runtime.append('pending', 1, '字'), false); assert.equal(page.runtime.commit('pending'), false);
  assert.equal(page.document.querySelector('textarea').value, '保留我的提问');
  h.context.__JFJC_SETTINGS__.togglePaste(connected.controller, { on: true }); await tick();
  assert.equal(await connected.clipboard.start(connected.controller, 'composer-1'), true);
  assert.equal(page.document.querySelector('textarea').value, '保留我的提问文字'); assert.equal(page.sends(), 0);
});
test('网页加载完成与重新打开时按保存的关闭状态注入，返回数学页会同步其他窗口的更新', async t => {
  const h = nativeHost(), bridge = withPanel(h), page = review(t), connected = connect(h, page);
  h.native.savePreference('ai-tools.show-paste', false);
  h.context.__JFJC_PAGE_SCRIPT__ = source('web/src/BBKaoyanReview.js');
  h.context.__JFJC_TRANSPORT__.waitReady = async () => {};
  page.window.__JFJC_QUESTION_TOOLS__ = { configure() {} };
  const controller = connected.controller; h.context.self = controller;
  bridge.methods.webViewDidFinishLoad(controller.webView); await tick();
  assert.equal(page.document.querySelector('.jfjc-paste-record'), null);
  controller.activePage = 'settings'; controller.webView.hidden = true;
  h.native.savePreference('ai-tools.show-paste', true);
  assert.equal(bridge.panel.setPage(controller, 'math'), true); await tick();
  assert.equal(page.document.querySelectorAll('.jfjc-paste-record').length, 1);
});
