import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { nativeHost, source } from './helpers.mjs';
import { pageScriptSource } from '../scripts/web-bundle.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4XsAAAAASUVORK5CYII=', 'base64');
function review(t, state = 'uploaded', pathname = '/assistant/conversations/42/review', injection = source('web/src/BBKaoyanReview.js')) {
  const parsed = parseHTML('<html><head></head><body><section class="review-chat-pane"><div class="review-chat-heading"><span>本题对话</span><small>题目上下文 #5519</small></div><form class="assistant-composer"><textarea>保留我的提问</textarea><div class="assistant-composer-actions"><label class="assistant-upload-button">上传<input type="file"></label><button type="button" class="assistant-pro-toggle">Pro</button><div class="assistant-composer-hint-wrapper">Enter 发送</div><button type="submit">发送</button></div></form></section></body></html>');
  const document = parsed.document, timers = new Set(), calls = [];
  let sends = 0;
  document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); sends++; });
  const location = { origin: 'https://bbkaoyan.cn', pathname, search: '' };
  const window = { document, location, atob: value => Buffer.from(value, 'base64').toString('binary'), addEventListener() {}, setTimeout(work, ms) { const timer = setTimeout(() => { timers.delete(timer); work(); }, ms); timers.add(timer); return timer; } };
  const context = vm.createContext({ window, document, MutationObserver: parsed.window.MutationObserver, File, Event: parsed.window.Event, Uint8Array, Number, Date, Math });
  const editor = document.querySelector('textarea');
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
  return { document, location, window, context, calls, sends: () => sends, runtime: window.__JFJC_REVIEW__ };
}
function connect(h, page, image = PNG) {
  let reads = 0;
  h.host.UIPasteboard = { generalPasteboard() { reads++; return { image: image && { pngData: () => ({ length: image.length, base64Encoding: image.toString('base64') }) } }; } };
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
  assert.equal(page.document.querySelector('#jfjc-toolbar').hidden, true);
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
  await assert.rejects(connection.clipboard.start(connection.controller, 'composer-1'), /没有图片/);
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
test('忙碌和附件满额提示具体原因，恢复后可粘贴，拒绝时不读取剪贴板', async t => {
  const page = review(t), h = nativeHost(), connected = connect(h, page);
  const textarea = page.document.querySelector('textarea'), upload = page.document.querySelector('input');
  textarea.disabled = true; page.runtime.install();
  assert.equal(page.document.querySelector('.jfjc-paste-record').disabled, true);
  await assert.rejects(connected.clipboard.start(connected.controller, 'composer-1'), /正在处理/);
  textarea.disabled = false; upload.disabled = true;
  for (let i = 0; i < 5; i++) { const node = page.document.createElement('div'); node.className = 'assistant-attachment-item'; page.document.querySelector('form').appendChild(node); }
  await assert.rejects(connected.clipboard.start(connected.controller, 'composer-1'), /已满 5 个/);
  assert.equal(connected.reads(), 0);
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
