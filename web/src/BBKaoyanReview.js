(function () {
  'use strict';
  if (window.location.origin !== 'https://bbkaoyan.cn') return;
  if (window.__JFJC_REVIEW__) { window.__JFJC_REVIEW__.install(); return; }
  const MAX = 10 * 1024 * 1024, MAX_TEXT = 1024 * 1024, CHUNK = 65536;
  const MAX_BUNDLE = Math.ceil(MAX / 3) * 4 + MAX_TEXT + 4096;
  let transfer = null, scheduled = false, nextComposer = 0, enabled = true, uploadSource = 'none', attachFirst = false, hasPrompt = false, uploadRevision = 0;
  let drafts = new WeakMap();
  const keys = new WeakMap(), attachmentOrders = new WeakMap();
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
  function attachmentName(item) {
    const name = item.querySelector('.assistant-attachment-copy a, .assistant-attachment-copy strong');
    return name ? name.textContent : '';
  }
  function attachmentScope(target) { return target && JSON.stringify([target.composer, target.item, target.route, target.question]); }
  function restoreOrders(state) {
    state.nodes.forEach(function (value, node) { if (node.style.order === value.applied) node.style.order = value.original; });
    state.nodes.clear();
  }
  function rememberAttachments(target, files) {
    if (!files.length) return;
    const form = find(target.composer), scope = attachmentScope(target), previous = attachmentOrders.get(form);
    const present = Array.from(form.querySelectorAll('.assistant-attachment-item')).map(attachmentName);
    const names = previous && previous.scope === scope ? previous.names.filter(function (name) { return present.indexOf(name) >= 0; }) : [];
    present.concat(files.map(function (file) { return file.name; })).forEach(function (name) { if (name && names.indexOf(name) < 0) names.push(name); });
    if (previous) restoreOrders(previous);
    attachmentOrders.set(form, { scope: scope, names: names, nodes: new Map() });
  }
  function stabilizeAttachments(form, target) {
    const state = attachmentOrders.get(form); if (!state) return;
    if (state.scope !== attachmentScope(target)) { restoreOrders(state); attachmentOrders.delete(form); return; }
    const items = Array.from(form.querySelectorAll('.assistant-attachment-item'));
    state.nodes.forEach(function (value, node) { if (items.indexOf(node) < 0) { if (node.style.order === value.applied) node.style.order = value.original; state.nodes.delete(node); } });
    items.forEach(function (item) {
      const name = attachmentName(item); if (!name) return;
      if (state.names.indexOf(name) < 0) state.names.push(name);
      const order = String(state.names.indexOf(name));
      if (!state.nodes.has(item)) state.nodes.set(item, { original: item.style.order || '', applied: order });
      state.nodes.get(item).applied = order;
      if (item.style.order !== order) item.style.order = order;
    });
  }
  function context(scope, saveDraft) {
    const form = find(scope); if (!form) return null;
    const pane = form.closest('.review-chat-pane'), heading = pane && pane.querySelector('.review-chat-heading');
    const id = heading && /题目上下文\s*#([1-9]\d*)/.exec(heading.textContent || '');
    if (pane && (!id || !Number.isSafeInteger(Number(id[1])))) return null;
    if (/\/review\/?$/.test(window.location.pathname) && !pane) return null;
    const tools = window.__JFJC_QUESTION_TOOLS__, question = tools && tools.uploadContext ? tools.uploadContext(form) : { question: null, questionPending: false };
    const target = { protocol: 2, item: id ? id[1] : '', composer: key(form), route: window.location.pathname + window.location.search, uploadRevision: uploadRevision,
      question: question.question, questionPending: question.questionPending };
    if (saveDraft && !drafts.has(form)) drafts.set(form, snapshotDraft(target));
    return target;
  }
  function same(expected) {
    const actual = context(expected.composer);
    return window.location.origin === 'https://bbkaoyan.cn' && actual && actual.composer === expected.composer && actual.item === expected.item && actual.route === expected.route && actual.uploadRevision === expected.uploadRevision
      && JSON.stringify(actual.question) === JSON.stringify(expected.question) && actual.questionPending === expected.questionPending;
  }
  function reason(target) {
    if (!enabled) return '上传已在设置中关闭';
    if (!target || !same(target)) return '当前对话或题目已切换，请重新点击上传';
    const handwriting = uploadSource !== 'none';
    if (!handwriting && !attachFirst && !hasPrompt) return '请在 AI 工具中选择上传内容或填写并开启提示词';
    if ((handwriting || attachFirst) && target.questionPending) return '正在读取当前题号，请等待题目加载完成后上传';
    const form = find(target.composer), input = form.querySelector('textarea'), upload = form.querySelector('input[type="file"]');
    if (input.disabled || input.readOnly) return '当前对话正在处理，请稍候再上传';
    if (handwriting && (upload.disabled || form.querySelectorAll('.assistant-attachment-item').length >= 5)) return form.querySelectorAll('.assistant-attachment-item').length >= 5 ? '本次附件已满 5 个，请先移除一个附件' : '当前对话暂时无法添加附件，请稍候再试';
    return '';
  }
  function available(target) { return !reason(target); }
  function busy() { return transfer && /^(receiving|uploading|pasting)$/.test(transfer.status); }
  function snapshotDraft(target) {
    const editor = find(target.composer).querySelector('textarea'), value = editor.value;
    return { target: target, editor: editor, value: value };
  }
  function capture(form) {
    const target = context(key(form)); if (target) drafts.set(form, snapshotDraft(target));
  }
  function finish(status, error) {
    if (!transfer) return;
    transfer.status = status; transfer.error = error || ''; transfer.chunks = [];
    install();
  }
  function install() {
    // 上传入口统一插入网站附件操作栏。
    document.querySelectorAll('.jfjc-paste-record,.jfjc-upload-handwriting').forEach(function (button) { button.remove(); });
    document.querySelectorAll('.review-chat-heading .jfjc-upload-content').forEach(function (button) { button.remove(); });
    if (!enabled) document.querySelectorAll('.jfjc-upload-content').forEach(function (button) { button.remove(); });
    forms().forEach(function (form) {
      const target = context(key(form)); stabilizeAttachments(form, target); if (!target) return;
      const actions = form.querySelector('.assistant-composer-actions');
      if (!enabled) return;
      let button = actions.querySelector('.jfjc-upload-content');
      if (!button) {
        button = document.createElement('button'); button.id = key(form) === 'composer-1' ? 'jfjc-upload-content' : 'jfjc-upload-content-' + key(form); button.type = 'button';
        button.className = 'assistant-pro-toggle jfjc-upload-content';
        // 在按钮获得焦点前保存提问草稿，兼容触摸、鼠标和键盘激活。
        ['pointerdown', 'mousedown', 'touchstart'].forEach(function (name) { button.addEventListener(name, function () { capture(form); }); });
        ['pointercancel', 'touchcancel'].forEach(function (name) { button.addEventListener(name, function () { drafts.delete(form); }); });
        button.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') capture(form); });
        button.addEventListener('click', function () {
          const current = context(key(form)); if (!current || !available(current) || busy()) return;
          if (!drafts.has(form)) capture(form);
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
      const title = problem || [attachFirst ? '上传来源卡片的首条图文，卡片图片在前' : '', uploadSource !== 'none' ? '按题号查找题卡，找不到时使用单张选中卡片，上传' + (uploadSource === 'mindmap' ? '已保存的脑图手写' : '最后一条手写批注') : '', hasPrompt ? '加入已保存的提示词' : '', '不会自动发送'].filter(Boolean).join('；');
      if (button.title !== title) button.title = title;
    });
    if (!document.getElementById('jfjc-review-style')) {
      const style = document.createElement('style'); style.id = 'jfjc-review-style';
      style.textContent = '.assistant-composer-actions>.jfjc-upload-content{font:inherit;font-size:12px;line-height:1.3;min-height:32px;padding:5px 10px;flex:0 0 auto;white-space:nowrap;border:1px solid #d9e2e4;border-radius:999px;background:#fff;color:#35616a;cursor:pointer}.jfjc-upload-content:disabled{opacity:.55;cursor:default}.jfjc-upload-content:focus-visible{outline:2px solid #35616a;outline-offset:2px}@media(max-width:600px){.assistant-composer-actions:has(>.jfjc-upload-content) .assistant-composer-hint{display:none}.review-chat-pane .assistant-composer-actions{flex-wrap:wrap;gap:6px}}';
      document.head.appendChild(style);
    }
  }
  function prepare(target, token, length) {
    if (!same(target) || !available(target) || busy()) return false;
    if (typeof token !== 'string' || !token || !Number.isSafeInteger(length) || length < 4 || length > MAX_BUNDLE) return false;
    const form = find(target.composer), saved = drafts.get(form) || snapshotDraft(target);
    drafts.delete(form);
    transfer = { target: target, token: token, length: length, offset: 0, chunks: [], status: 'receiving', started: Date.now(), selection: saved };
    if (!same(saved.target) || saved.editor !== form.querySelector('textarea') || saved.value !== saved.editor.value) { finish('error', '输入框内容已变化，请重新点击上传'); return false; }
    install(); return true;
  }
  function append(token, offset, chunk) {
    if (!transfer || transfer.token !== token || transfer.status !== 'receiving' || !same(transfer.target)) return false;
    if (offset !== transfer.offset || typeof chunk !== 'string' || !chunk.length || chunk.length > CHUNK || transfer.offset + chunk.length > transfer.length) return false;
    transfer.chunks.push(chunk); transfer.offset += chunk.length; return true;
  }
  function commit(token) {
    if (!transfer || transfer.token !== token || transfer.status !== 'receiving' || transfer.offset !== transfer.length || !same(transfer.target) || !available(transfer.target)) return false;
    const current = transfer;
    try {
      const payload = JSON.parse(current.chunks.join(''));
      if (!payload || typeof payload.text !== 'string' || payload.text.length > MAX_TEXT || !Array.isArray(payload.files) || (!payload.files.length && !payload.text) || payload.files.length > 5) throw new Error('上传图文数据无效，请重新上传');
      const editor = find(current.target.composer).querySelector('textarea'), saved = current.selection;
      const setter = window.HTMLTextAreaElement && Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      if (editor !== saved.editor || editor.value !== saved.value) throw new Error('输入框内容已变化，请重新点击上传');
      if (payload.text && (!setter || typeof setter.set !== 'function')) throw new Error('当前网页无法接收文字，请刷新后重试');
      let total = 0;
      const files = payload.files.map(function (part, index) {
        const type = part && part.type || 'image/png';
        if (!part || !Number.isSafeInteger(part.bytes) || part.bytes < 1 || part.bytes > MAX || typeof part.base64 !== 'string' || part.base64.length !== Math.ceil(part.bytes / 3) * 4
          || (type !== 'image/png' || !/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(part.base64))
          || part.name !== undefined && ['卡片图片', '脑图手写', '卡片手写'].indexOf(part.name) < 0) throw new Error('上传图片数据无效，请重新上传');
        const binary = window.atob(part.base64); total += binary.length;
        if (!binary.length || total > MAX || binary.length !== part.bytes) throw new Error('本次图片合计超过 10 MiB 或图片数据不完整');
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new File([bytes], (part.name || '上传图片') + '-' + current.token + '-' + (index + 1) + '.png', { type: type });
      });
      if (files.length && find(current.target.composer).querySelector('input[type="file"]').disabled) throw new Error('当前对话暂时无法添加附件，请稍候再试');
      if (find(current.target.composer).querySelectorAll('.assistant-attachment-item').length + files.length > 5) throw new Error('添加后附件将超过 5 个，请先移除部分附件');
      current.chunks = [];
      function uploadFiles() {
        if (transfer !== current) return;
        if (!same(current.target) || find(current.target.composer).querySelector('textarea') !== editor) { finish('error', '对话或题目已切换，请检查原输入框'); return; }
        current.status = 'uploading';
        // 记住本次顺序；重试后仅恢复显示次序，不移动 React 节点或重新上传成功附件。
        rememberAttachments(current.target, files);
        const event = new Event('paste', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'clipboardData', { value: { files: files, items: files.map(function (file) { return { kind: 'file', type: file.type, getAsFile: function () { return file; } }; }), getData: function () { return ''; } } });
        if (files.length) editor.dispatchEvent(event);
        watch(); install();
      }
      function watch() {
        if (transfer !== current || current.status !== 'uploading') return;
        if (!same(current.target)) { finish('error', '对话或题目已切换，请检查原对话附件'); return; }
        const items = find(current.target.composer).querySelectorAll('.assistant-attachment-item');
        const matches = files.map(function (file) { return Array.from(items).find(function (node) { const name = node.querySelector('.assistant-attachment-copy a, .assistant-attachment-copy strong'); return name && name.textContent === file.name; }); });
        const failed = matches.find(function (item) { return item && item.classList.contains('is-failed'); });
        if (failed) { const detail = failed.querySelector('em'); finish('error', detail && detail.textContent || '网站图片上传失败，请检查附件后重试'); return; }
        if (matches.every(function (item) { return item && item.classList.contains('is-uploaded'); })) {
          finish('uploaded');
          return;
        }
        if (Date.now() - current.started > 60000) { finish('error', '尚未确认图片上传，请检查当前对话附件后再重试'); return; }
        window.setTimeout(watch, 200);
      }
      if (payload.text) {
        // 文字先同步到网站草稿，之后图片失败或在网站点击重试都不会吞掉或重复追加文字。
        const value = saved.value + (saved.value ? '\n\n' : '') + payload.text.replace(/\r\n?/g, '\n');
        current.status = 'pasting';
        setter.set.call(editor, value);
        if (document.activeElement === editor) editor.setSelectionRange(value.length, value.length);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        window.setTimeout(function () {
          if (transfer !== current || current.status !== 'pasting') return;
          if (!same(current.target) || find(current.target.composer).querySelector('textarea') !== editor || editor.value !== value) { finish('error', '对话或输入框内容已变化，请检查图文后再重试'); return; }
          try { uploadFiles(); } catch (error) { finish('error', String(error.message || error)); }
        }, 0);
      } else uploadFiles();
      install(); return true;
    } catch (error) { finish('error', String(error.message || error)); return false; }
  }
  function read(token) {
    if (!transfer || transfer.token !== token) return { status: 'cancelled', error: '上传已结束' };
    if (busy() && !same(transfer.target)) finish('error', '对话或题目已切换，内容未继续添加');
    return { status: transfer.status, error: transfer.error || '' };
  }
  function cancel(token) { if (transfer && token && transfer.token !== token) return false; drafts = new WeakMap(); transfer = null; install(); return true; }
  function configure(options) {
    const previous = uploadSource, previouslyEnabled = enabled, previousFirst = attachFirst, previousPrompt = hasPrompt;
    enabled = !options || options.enabled !== false;
    if (options && options.source !== undefined) uploadSource = ['none', 'handwriting', 'mindmap'].indexOf(options.source) >= 0 ? options.source : 'none';
    if (options && options.attachFirst !== undefined) attachFirst = options.attachFirst === true;
    if (options && options.hasPrompt !== undefined) hasPrompt = options.hasPrompt === true;
    if (previous !== uploadSource || previouslyEnabled !== enabled || previousFirst !== attachFirst || previousPrompt !== hasPrompt) uploadRevision++;
    if (!enabled || previous !== uploadSource || previousFirst !== attachFirst || previousPrompt !== hasPrompt) cancel(); else install();
  }
  window.__JFJC_REVIEW__ = { context: context, reason: reason, install: install, prepare: prepare, append: append, commit: commit, read: read, cancel: cancel, configure: configure };
  new MutationObserver(function () {
    if (!scheduled) { scheduled = true; window.setTimeout(function () { scheduled = false; if (transfer) read(transfer.token); install(); }, 80); }
  }).observe(document.documentElement, { childList: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'class', 'aria-label', 'aria-busy'], subtree: true });
  window.addEventListener('popstate', function () { cancel(); install(); }); install();
})();
