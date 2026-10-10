(function () {
  'use strict';
  if (window.location.origin !== 'https://bbkaoyan.cn') return;
  if (window.__JFJC_REVIEW__) { window.__JFJC_REVIEW__.install(); return; }
  const MAX = 10 * 1024 * 1024, CHUNK = 65536;
  let transfer = null, scheduled = false, nextComposer = 0;
  const keys = new WeakMap();
  function forms() {
    if (!/^\/assistant\/conversations\/[A-Za-z0-9_-]+(?:\/(?:review|solve|search))?\/?$/.test(window.location.pathname)) return [];
    return Array.from(document.querySelectorAll('form.assistant-composer')).filter(function (form) {
      return form.querySelector('textarea') && form.querySelector('input[type="file"]') && form.querySelector('.assistant-composer-actions');
    });
  }
  function key(form) { if (!keys.has(form)) keys.set(form, 'composer-' + (++nextComposer)); return keys.get(form); }
  function find(scope) { return forms().find(function (form) { return !scope || key(form) === scope; }); }
  function context(scope) {
    const form = find(scope); if (!form) return null;
    const pane = form.closest('.review-chat-pane'), heading = pane && pane.querySelector('.review-chat-heading');
    const id = heading && /题目上下文\s*#([1-9]\d*)/.exec(heading.textContent || '');
    if (pane && (!id || !Number.isSafeInteger(Number(id[1])))) return null;
    if (/\/review\/?$/.test(window.location.pathname) && !pane) return null;
    return { item: id ? id[1] : '', composer: key(form), route: window.location.pathname + window.location.search };
  }
  function same(expected) {
    const actual = context(expected.composer);
    return window.location.origin === 'https://bbkaoyan.cn' && actual && actual.composer === expected.composer && actual.item === expected.item && actual.route === expected.route;
  }
  function reason(target) {
    if (!target || !same(target)) return '当前对话或题目已切换，请重新点击粘贴';
    const form = find(target.composer), input = form.querySelector('textarea'), upload = form.querySelector('input[type="file"]');
    if (input.disabled) return '当前对话正在处理，请稍候再粘贴';
    if (upload.disabled) return form.querySelectorAll('.assistant-attachment-item').length >= 5 ? '本次附件已满 5 个，请先移除一个附件' : '当前对话暂时无法添加附件，请稍候再试';
    return '';
  }
  function available(target) { return !reason(target); }
  function finish(status, error) {
    if (!transfer) return;
    transfer.status = status; transfer.error = error || ''; transfer.chunks = [];
    install();
  }
  function install() {
    // 统一插入网站共用的附件操作栏，保持上传、Pro、粘贴的顺序。
    document.querySelectorAll('.review-chat-heading .jfjc-paste-record').forEach(function (button) { button.remove(); });
    forms().forEach(function (form) {
      const target = context(key(form)); if (!target) return;
      const actions = form.querySelector('.assistant-composer-actions');
      let button = actions.querySelector('.jfjc-paste-record');
      if (!button) {
        button = document.createElement('button'); button.id = key(form) === 'composer-1' ? 'jfjc-paste-record' : 'jfjc-paste-record-' + key(form); button.type = 'button';
        button.className = 'assistant-pro-toggle jfjc-paste-record';
        button.addEventListener('click', function () {
          const current = context(key(form)); if (!current || !available(current) || transfer && /^(receiving|uploading)$/.test(transfer.status)) return;
          button.disabled = true;
          const frame = document.createElement('iframe'); frame.hidden = true;
          frame.src = 'jifengjincaobridge://paste-record?token=&scope=' + encodeURIComponent(current.composer);
          document.body.appendChild(frame); window.setTimeout(function () { frame.remove(); install(); }, 800);
        });
      }
      const pro = Array.from(actions.querySelectorAll('.assistant-pro-toggle')).find(function (node) { return node !== button; });
      const upload = Array.from(actions.querySelectorAll('.assistant-upload-button, .assistant-upload-trigger')).find(function (node) { return !node.hidden; });
      const previous = pro || upload;
      if (previous && previous.nextElementSibling !== button) actions.insertBefore(button, previous.nextSibling);
      else if (!previous && button.parentNode !== actions) actions.prepend(button);
      const busy = transfer && /^(receiving|uploading)$/.test(transfer.status), problem = reason(target);
      const label = busy && transfer.target.composer === target.composer ? '粘贴中…' : '粘贴', disabled = Boolean(busy || problem);
      if (button.textContent !== label) button.textContent = label;
      if (button.disabled !== disabled) button.disabled = disabled;
      const title = problem || '将剪贴板图片添加到当前对话附件，再点击发送';
      if (button.title !== title) button.title = title;
    });
    if (!document.getElementById('jfjc-review-style')) {
      const style = document.createElement('style'); style.id = 'jfjc-review-style';
      style.textContent = '.assistant-composer-actions>.jfjc-paste-record{font:inherit;font-size:12px;line-height:1.3;min-height:32px;padding:5px 10px;flex:0 0 auto;white-space:nowrap;border:1px solid #d9e2e4;border-radius:999px;background:#fff;color:#35616a;cursor:pointer}.jfjc-paste-record:disabled{opacity:.55;cursor:default}.jfjc-paste-record:focus-visible{outline:2px solid #35616a;outline-offset:2px}@media(max-width:600px){.assistant-composer-actions:has(>.jfjc-paste-record) .assistant-composer-hint{display:none}}';
      document.head.appendChild(style);
    }
  }
  function prepare(target, token, type, name, length) {
    if (!same(target) || !available(target) || transfer && /^(receiving|uploading)$/.test(transfer.status)) return false;
    if (!token || !/^image\/(png|jpeg)$/.test(type) || !name || !Number.isSafeInteger(length) || length < 4 || length > Math.ceil(MAX / 3) * 4) return false;
    transfer = { target: target, token: token, type: type, name: name, length: length, offset: 0, chunks: [], status: 'receiving', started: Date.now() };
    install(); return true;
  }
  function append(token, offset, chunk) {
    if (!transfer || transfer.token !== token || transfer.status !== 'receiving' || !same(transfer.target)) return false;
    if (offset !== transfer.offset || typeof chunk !== 'string' || !chunk.length || chunk.length > CHUNK || transfer.offset + chunk.length > transfer.length || !/^[A-Za-z0-9+/=]+$/.test(chunk)) return false;
    transfer.chunks.push(chunk); transfer.offset += chunk.length; return true;
  }
  function commit(token) {
    if (!transfer || transfer.token !== token || transfer.status !== 'receiving' || transfer.offset !== transfer.length || !same(transfer.target) || !available(transfer.target)) return false;
    const current = transfer;
    try {
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
    if (!transfer || transfer.token !== token) return { status: 'cancelled', error: '图片添加已结束' };
    if (/^(receiving|uploading)$/.test(transfer.status) && !same(transfer.target)) finish('error', '对话或题目已切换，图片未继续添加');
    return { status: transfer.status, error: transfer.error || '' };
  }
  function cancel(token) { if (!transfer || token && transfer.token !== token) return false; transfer = null; install(); return true; }
  window.__JFJC_REVIEW__ = { context: context, reason: reason, install: install, prepare: prepare, append: append, commit: commit, read: read, cancel: cancel };
  new MutationObserver(function () {
    if (!scheduled) { scheduled = true; window.setTimeout(function () { scheduled = false; if (transfer) read(transfer.token); install(); }, 80); }
  }).observe(document.documentElement, { childList: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'class'], subtree: true });
  window.addEventListener('popstate', function () { cancel(); install(); }); install();
})();
