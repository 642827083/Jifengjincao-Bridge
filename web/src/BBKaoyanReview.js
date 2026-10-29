(function () {
  'use strict';
  if (window.location.origin !== 'https://bbkaoyan.cn') return;
  if (window.__JFJC_REVIEW__) { window.__JFJC_REVIEW__.install(); return; }
  const MAX = 10 * 1024 * 1024, MAX_TEXT = 1024 * 1024, CHUNK = 65536;
  let transfer = null, scheduled = false, nextComposer = 0, enabled = true, uploadSource = 'clipboard', uploadRevision = 0;
  let selections = new WeakMap();
  const keys = new WeakMap();
  function forms() {
    return Array.from(document.querySelectorAll('form.assistant-composer')).filter(function (form) {
      return form.querySelector('textarea') && form.querySelector('input[type="file"]') && form.querySelector('.assistant-composer-actions');
    });
  }
  function key(form) {
    const editor = form.querySelector('textarea'), old = keys.get(form);
    if (!old || old.editor !== editor) keys.set(form, { editor: editor, id: 'composer-' + (++nextComposer) });
    return keys.get(form).id;
  }
  function find(scope) { return forms().find(function (form) { return !scope || key(form) === scope; }); }
  function context(scope) {
    const form = find(scope); if (!form) return null;
    const pane = form.closest('.review-chat-pane'), heading = pane && pane.querySelector('.review-chat-heading');
    const id = heading && /题目上下文\s*#([1-9]\d*)/.exec(heading.textContent || '');
    if (pane && (!id || !Number.isSafeInteger(Number(id[1])))) return null;
    if (/\/review\/?$/.test(window.location.pathname) && !pane) return null;
    return { item: id ? id[1] : '', composer: key(form), route: window.location.pathname + window.location.search, uploadRevision: uploadRevision };
  }
  function same(expected) {
    const actual = context(expected.composer);
    return window.location.origin === 'https://bbkaoyan.cn' && actual && actual.composer === expected.composer && actual.item === expected.item && actual.route === expected.route && actual.uploadRevision === expected.uploadRevision;
  }
  function reason(target, type, handwriting) {
    if (!enabled) return '上传已在设置中关闭';
    if (!target || !same(target)) return '当前对话或题目已切换，请重新点击上传';
    if (handwriting === undefined) handwriting = uploadSource === 'handwriting';
    if (handwriting) type = 'image/png';
    const form = find(target.composer), input = form.querySelector('textarea'), upload = form.querySelector('input[type="file"]');
    if (input.disabled || input.readOnly) return '当前对话正在处理，请稍候再上传';
    if (/^image\//.test(type || '') && (upload.disabled || form.querySelectorAll('.assistant-attachment-item').length >= 5)) return form.querySelectorAll('.assistant-attachment-item').length >= 5 ? '本次附件已满 5 个，请先移除一个附件' : '当前对话暂时无法添加附件，请稍候再试';
    return '';
  }
  function available(target, type, handwriting) { return !reason(target, type, handwriting); }
  function busy() { return transfer && /^(receiving|uploading|pasting)$/.test(transfer.status); }
  function selection(target) {
    const editor = find(target.composer).querySelector('textarea'), value = editor.value;
    const start = Number.isInteger(editor.selectionStart) ? editor.selectionStart : value.length;
    const end = Number.isInteger(editor.selectionEnd) ? editor.selectionEnd : start;
    return { target: target, editor: editor, value: value, start: Math.max(0, Math.min(start, value.length)), end: Math.max(start, Math.min(end, value.length)) };
  }
  function capture(form) {
    const target = context(key(form)); if (target) selections.set(form, selection(target));
  }
  function finish(status, error) {
    if (!transfer) return;
    transfer.status = status; transfer.error = error || ''; transfer.chunks = [];
    install();
  }
  function install() {
    // 合并插件的粘贴和手写入口，统一插入网站附件操作栏。
    document.querySelectorAll('.jfjc-paste-record,.jfjc-upload-handwriting').forEach(function (button) { button.remove(); });
    document.querySelectorAll('.review-chat-heading .jfjc-upload-content').forEach(function (button) { button.remove(); });
    if (!enabled) document.querySelectorAll('.jfjc-upload-content').forEach(function (button) { button.remove(); });
    forms().forEach(function (form) {
      const target = context(key(form)); if (!target) return;
      const actions = form.querySelector('.assistant-composer-actions');
      if (!enabled) return;
      let button = actions.querySelector('.jfjc-upload-content');
      if (!button) {
        button = document.createElement('button'); button.id = key(form) === 'composer-1' ? 'jfjc-upload-content' : 'jfjc-upload-content-' + key(form); button.type = 'button';
        button.className = 'assistant-pro-toggle jfjc-upload-content';
        // 在按钮获得焦点前保存文字选区，兼容触摸、鼠标和键盘激活。
        ['pointerdown', 'mousedown', 'touchstart'].forEach(function (name) { button.addEventListener(name, function () { capture(form); }); });
        ['pointercancel', 'touchcancel'].forEach(function (name) { button.addEventListener(name, function () { selections.delete(form); }); });
        button.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') capture(form); });
        button.addEventListener('click', function () {
          const current = context(key(form)); if (!current || !available(current) || busy()) return;
          if (!selections.has(form)) capture(form);
          button.disabled = true;
          const frame = document.createElement('iframe'); frame.hidden = true;
          frame.src = 'jifengjincaobridge://upload-content?token=&scope=' + encodeURIComponent(current.composer);
          document.body.appendChild(frame); window.setTimeout(function () { frame.remove(); install(); }, 800);
        });
      }
      const pro = Array.from(actions.querySelectorAll('.assistant-pro-toggle')).find(function (node) { return node !== button; });
      const upload = Array.from(actions.querySelectorAll('.assistant-upload-button, .assistant-upload-trigger')).find(function (node) { return !node.hidden; });
      const previous = pro || upload;
      if (previous && previous.nextElementSibling !== button) actions.insertBefore(button, previous.nextSibling);
      else if (!previous && button.parentNode !== actions) actions.prepend(button);
      const active = busy(), problem = reason(target);
      const label = active && transfer.target.composer === target.composer ? '上传中…' : '上传', disabled = Boolean(active || problem);
      if (button.textContent !== label) button.textContent = label;
      if (button.disabled !== disabled) button.disabled = disabled;
      const title = problem || (uploadSource === 'handwriting' ? '上传所选卡片的最后一条手写批注；不会自动发送' : '读取剪贴板，文字粘贴到输入框，图片添加为附件；不会自动发送');
      if (button.title !== title) button.title = title;
    });
    if (!document.getElementById('jfjc-review-style')) {
      const style = document.createElement('style'); style.id = 'jfjc-review-style';
      style.textContent = '.assistant-composer-actions>.jfjc-upload-content{font:inherit;font-size:12px;line-height:1.3;min-height:32px;padding:5px 10px;flex:0 0 auto;white-space:nowrap;border:1px solid #d9e2e4;border-radius:999px;background:#fff;color:#35616a;cursor:pointer}.jfjc-upload-content:disabled{opacity:.55;cursor:default}.jfjc-upload-content:focus-visible{outline:2px solid #35616a;outline-offset:2px}@media(max-width:600px){.assistant-composer-actions:has(>.jfjc-upload-content) .assistant-composer-hint{display:none}.review-chat-pane .assistant-composer-actions{flex-wrap:wrap;gap:6px}}';
      document.head.appendChild(style);
    }
  }
  function prepare(target, token, type, name, length, handwriting) {
    handwriting = handwriting === true;
    if (!same(target) || !available(target, type, handwriting) || busy()) return false;
    const text = type === 'text/plain';
    if (handwriting && text) return false;
    if (!token || !(text || /^image\/(png|jpeg)$/.test(type)) || !name || !Number.isSafeInteger(length) || length < (text ? 1 : 4) || length > (text ? MAX_TEXT : Math.ceil(MAX / 3) * 4)) return false;
    const form = find(target.composer), saved = text ? selections.get(form) || selection(target) : null;
    selections.delete(form);
    transfer = { target: target, token: token, type: type, name: name, length: length, offset: 0, chunks: [], status: 'receiving', started: Date.now(), selection: saved, handwriting: handwriting };
    if (saved && (!same(saved.target) || saved.editor !== form.querySelector('textarea') || saved.value !== saved.editor.value)) { finish('error', '输入框内容已变化，请重新点击上传'); return false; }
    install(); return true;
  }
  function append(token, offset, chunk) {
    if (!transfer || transfer.token !== token || transfer.status !== 'receiving' || !same(transfer.target)) return false;
    if (offset !== transfer.offset || typeof chunk !== 'string' || !chunk.length || chunk.length > CHUNK || transfer.offset + chunk.length > transfer.length || /^(?:image\/png|image\/jpeg)$/.test(transfer.type) && !/^[A-Za-z0-9+/=]+$/.test(chunk)) return false;
    transfer.chunks.push(chunk); transfer.offset += chunk.length; return true;
  }
  function commit(token) {
    if (!transfer || transfer.token !== token || transfer.status !== 'receiving' || transfer.offset !== transfer.length || !same(transfer.target) || !available(transfer.target, transfer.type, transfer.handwriting)) return false;
    const current = transfer;
    try {
      if (current.type === 'text/plain') {
        const saved = current.selection, editor = find(current.target.composer).querySelector('textarea');
        if (editor !== saved.editor || editor.value !== saved.value) throw new Error('输入框内容已变化，请重新点击上传');
        const setter = window.HTMLTextAreaElement && Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
        if (!setter || typeof setter.set !== 'function') throw new Error('当前网页无法接收文字，请刷新后重试');
        const text = current.chunks.join('').replace(/\r\n?/g, '\n');
        const value = saved.value.slice(0, saved.start) + text + saved.value.slice(saved.end), caret = saved.start + text.length;
        current.chunks = []; current.status = 'pasting';
        // 使用浏览器原生 setter 绕过 React 的值跟踪，再派发 input 更新网站草稿状态。
        editor.focus({ preventScroll: true }); setter.set.call(editor, value); editor.setSelectionRange(caret, caret);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        window.setTimeout(function () {
          if (transfer !== current || current.status !== 'pasting') return;
          if (!same(current.target) || find(current.target.composer).querySelector('textarea') !== editor) { finish('error', '对话或题目已切换，请检查原输入框'); return; }
          if (editor.value !== value) { finish('error', '输入框内容已变化，请检查文字后再重试'); return; }
          editor.setSelectionRange(caret, caret); finish('pasted');
        }, 0);
        install(); return true;
      }
      const binary = window.atob(current.chunks.join(''));
      if (!binary.length || binary.length > MAX) throw new Error('图片超过网站 10 MiB 限制');
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], current.name, { type: current.type });
      current.chunks = []; current.status = 'uploading';
      // 沿用网站自己的 React 粘贴、校验和上传流程；保留输入草稿，发送由用户决定。
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { files: [file], items: [{ kind: 'file', type: file.type, getAsFile: function () { return file; } }], getData: function () { return ''; } } });
      find(current.target.composer).querySelector('textarea').dispatchEvent(event);
      function watch() {
        if (transfer !== current || current.status !== 'uploading') return;
        if (!same(current.target)) { finish('error', '对话或题目已切换，请检查原对话附件'); return; }
        const items = find(current.target.composer).querySelectorAll('.assistant-attachment-item');
        const item = Array.from(items).find(function (node) { const name = node.querySelector('.assistant-attachment-copy a, .assistant-attachment-copy strong'); return name && name.textContent === current.name; });
        if (item && item.classList.contains('is-failed')) { const detail = item.querySelector('em'); finish('error', detail && detail.textContent || '网站图片上传失败，请重试'); return; }
        if (item && item.classList.contains('is-uploaded')) { finish('uploaded'); return; }
        if (Date.now() - current.started > 60000) { finish('error', '尚未确认图片上传，请检查当前对话附件后再重试'); return; }
        window.setTimeout(watch, 200);
      }
      watch(); install(); return true;
    } catch (error) { finish('error', String(error.message || error)); return false; }
  }
  function read(token) {
    if (!transfer || transfer.token !== token) return { status: 'cancelled', error: '粘贴已结束' };
    if (busy() && !same(transfer.target)) finish('error', '对话或题目已切换，内容未继续添加');
    return { status: transfer.status, error: transfer.error || '' };
  }
  function cancel(token) { if (transfer && token && transfer.token !== token) return false; selections = new WeakMap(); transfer = null; install(); return true; }
  function configure(options) {
    const previous = uploadSource, previouslyEnabled = enabled;
    enabled = !options || options.enabled !== false;
    if (options && options.source !== undefined) uploadSource = options.source === 'handwriting' ? 'handwriting' : 'clipboard';
    if (previous !== uploadSource || previouslyEnabled !== enabled) uploadRevision++;
    if (!enabled || previous !== uploadSource) cancel(); else install();
  }
  window.__JFJC_REVIEW__ = { context: context, reason: reason, install: install, prepare: prepare, append: append, commit: commit, read: read, cancel: cancel, configure: configure };
  new MutationObserver(function () {
    if (!scheduled) { scheduled = true; window.setTimeout(function () { scheduled = false; if (transfer) read(transfer.token); install(); }, 80); }
  }).observe(document.documentElement, { childList: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'class'], subtree: true });
  window.addEventListener('popstate', function () { cancel(); install(); }); install();
})();
