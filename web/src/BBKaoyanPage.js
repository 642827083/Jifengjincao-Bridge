(function () {
  'use strict';
  if (window.location.origin !== 'https://bbkaoyan.cn') return;
  if (window.__JFJC_LAYOUT__) window.__JFJC_LAYOUT__.install();
  if (window.__JFJC_PAGE__) { window.__JFJC_PAGE__.refresh(); return; }
  const CHUNK = 65536, MAX_PAYLOAD = 24 * 1024 * 1024, MAX_IMAGE = 6 * 1024 * 1024;
  const state = { session: null, preview: null, cancelled: false, operation: null, selected: {}, lastRoute: '', busy: false };
  function route() { return window.location.pathname + window.location.search; }
  function context() {
    const paper = /^\/papers\/([1-9]\d*)\/?$/.exec(window.location.pathname);
    const question = /^\/questions\/([1-9]\d*)\/?$/.exec(window.location.pathname);
    return paper ? { paperId: Number(paper[1]) } : question ? { questionId: Number(question[1]) } : null;
  }
  function focusSource() {
    const hash = String(window.location.hash || ''), match = /^#question-([1-9]\d*)$/.exec(hash), ctx = context();
    if (!match || !ctx || !ctx.paperId || state.focusedSource === route() + hash) return;
    const card = document.getElementById('question-' + match[1]);
    if (!card || typeof card.scrollIntoView !== 'function') return;
    const header = document.querySelector('.topbar'), top = header ? Math.max(0, header.getBoundingClientRect().bottom) + 16 : 112;
    card.style.scrollMarginTop = top + 'px'; card.scrollIntoView({ block: 'start', behavior: 'auto' });
    state.focusedSource = route() + hash;
  }
  function message(error) { return error && error.message || String(error); }
  function stop(message) { const error = new Error(message); error.stopImport = true; throw error; }
  function ensure(session) {
    if (state.cancelled || !state.session || (session && session !== state.session) || state.session.route !== route()) throw new Error('导入已取消或页面已切换');
  }
  function wait(ms) { return new Promise(function (resolve) { window.setTimeout(resolve, ms); }); }
  function assetURL(raw) {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== 'https://bbkaoyan.cn' || !/^\/api\/question-assets\/[1-9]\d*$/.test(url.pathname)) throw new Error('图片地址不在网站题目资源范围内');
    return url.href;
  }
  async function request(path, binary, captured) {
    const session = captured || state.session;
    const url = binary ? assetURL(path) : new URL(path, window.location.origin).href;
    for (let attempt = 0; attempt < 3; attempt++) {
      ensure(session);
      const abort = new AbortController();
      state.abort = abort;
      const timer = window.setTimeout(function () { abort.abort(); }, 30000);
      try {
        const response = await window.fetch(url, { credentials: 'include', signal: abort.signal, headers: { Accept: binary ? 'image/*' : 'application/json' } });
        ensure(session);
        if (response.status === 429) {
          if (attempt === 2) throw new Error('访问较频繁，请稍后重试');
          const header = response.headers.get('Retry-After');
          const seconds = /^\d+$/.test(header || '') ? Number(header) : header ? Math.ceil((Date.parse(header) - Date.now()) / 1000) : 5;
          if (!Number.isFinite(seconds) || seconds > 60) throw new Error('网站要求稍后重试，请等待 ' + (Number.isFinite(seconds) ? seconds + ' 秒' : '一段时间'));
          status('网站限流，等待 ' + Math.max(1, seconds) + ' 秒后重试…');
          await wait(Math.max(1, seconds) * 1000); continue;
        }
        if (response.status === 401) stop('登录已失效，请在网站重新登录后重试');
        if (response.status === 403) stop('当前账号没有读取这些题目或答案的权限');
        if (response.status === 428) stop('请先在网站完成访问验证，再重试导入');
        if (!response.ok) throw new Error('网站读取失败（' + response.status + '）');
        if (!binary) {
          const value = await response.json(); ensure(session); return value;
        }
        const blob = await response.blob();
        if (!/^image\/(png|jpeg|gif|webp)$/.test(blob.type) || !blob.size || blob.size > MAX_IMAGE) throw new Error('图片格式不支持或超过 6 MB');
        return await new Promise(function (resolve, reject) {
          const reader = new FileReader();
          reader.onload = function () { try { ensure(session); resolve(reader.result); } catch (e) { reject(e); } };
          reader.onerror = function () { reject(new Error('图片转换失败')); };
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        ensure(session);
        if (!(error instanceof TypeError || error.name === 'AbortError') || attempt === 2) throw error;
        await wait(500 * (attempt + 1));
      } finally { window.clearTimeout(timer); if (state.abort === abort) state.abort = null; }
    }
  }
  function launch(token, work) {
    if (!state.session || token !== state.session.token) return 'rejected';
    const session = state.session;
    const op = { token: token, status: 'pending', payload: '', error: '' };
    state.operation = op;
    Promise.resolve().then(function () { ensure(session); return work(session); }).then(function (result) {
      ensure(session);
      const payload = JSON.stringify(result);
      if (payload.length > MAX_PAYLOAD) throw new Error('本题图文内容过大，请单独处理');
      if (state.operation === op) { op.payload = payload; op.status = 'ready'; }
    }).catch(function (error) { if (state.operation === op) { op.error = message(error); op.stopImport = Boolean(error.stopImport); op.status = 'error'; } });
    return 'accepted';
  }
  function read(token) {
    if (!state.operation || state.operation.token !== token) return JSON.stringify({ status: 'error', error: '页面任务不存在' });
    return JSON.stringify({ status: state.operation.status, error: state.operation.error, stopImport: Boolean(state.operation.stopImport), length: state.operation.payload.length });
  }
  function chunk(token, offset) {
    if (!state.operation || state.operation.token !== token || state.operation.status !== 'ready' || !Number.isSafeInteger(offset) || offset < 0) return '';
    return state.operation.payload.slice(offset, offset + CHUNK);
  }
  function release(token) { if (state.operation && state.operation.token === token) state.operation = null; return 'released'; }
  function cancel() {
    state.cancelled = true;
    if (state.abort) state.abort.abort();
    if (state.operation) { state.operation.status = 'error'; state.operation.error = '导入已取消'; state.operation.payload = ''; }
    return 'cancelled';
  }
  function native(command, token, scope) {
    const link = document.createElement('iframe');
    link.style.display = 'none';
    link.src = 'jifengjincaobridge://' + command + '?token=' + encodeURIComponent(token || '') + '&scope=' + encodeURIComponent(scope || '');
    document.body.appendChild(link); window.setTimeout(function () { link.remove(); }, 1000);
  }
  function status(text) {
    const element = document.getElementById('jfjc-status');
    if (element) { element.textContent = text; element.title = text; }
  }
  function escape(text) { return String(text || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function currentQuestion() {
    const ctx = context(); if (ctx && ctx.questionId) return ctx.questionId;
    const nodes = Array.from(document.querySelectorAll('[id^="question-"]')).filter(function (node) { return /^question-[1-9]\d*$/.test(node.id); });
    const visible = nodes.filter(function (node) { const b = node.getBoundingClientRect(); return b.bottom > 80 && b.top < window.innerHeight; });
    visible.sort(function (a, b) { return Math.abs(a.getBoundingClientRect().top - 100) - Math.abs(b.getBoundingClientRect().top - 100); });
    return visible.length ? Number(visible[0].id.slice(9)) : 0;
  }
  async function envelope(ctx, session) {
    if (ctx.paperId) return request('/api/papers/' + ctx.paperId + '/questions', false, session);
    const q = await request('/api/questions/' + ctx.questionId, false, session);
    const papers = (q.papers || []).filter(function (p) { return Number.isSafeInteger(Number(p.id)) && Number(p.id) > 0; });
    if (papers.length) return request('/api/papers/' + Number(papers[0].id) + '/questions', false, session);
    return { paper: { id: 0, title: '单题收集', subject: q.subject }, questions: [{ question: q, question_number: String(q.id), display_order: 1 }] };
  }
  function renderPreview(data, scope, targetId) {
    const host = document.getElementById('jfjc-dialog');
    const entries = data.questions || [];
    if (!data.paper || !entries.length) throw new Error('当前试卷暂无可导入的题目');
    if (entries.length > 500) throw new Error('单次最多导入 500 道题目');
    if (targetId && !entries.some(function (r) { return r.question && r.question.id === targetId; })) throw new Error('当前题目不在这份试卷中');
    state.preview = data; state.scope = scope;
    state.selected = {};
    entries.forEach(function (r) { if (scope !== 'single' || r.question.id === targetId) state.selected[r.question.id] = true; });
    const content = state.session.content === 'question' ? 'question' : 'questionAnswer';
    const visible = entries.map(function (row, index) { return { row: row, index: index }; }).sort(function (a, b) {
      const x = Number(a.row.display_order), y = Number(b.row.display_order);
      return (Number.isFinite(x) ? x : a.index) - (Number.isFinite(y) ? y : b.index) || a.index - b.index;
    }).map(function (item) { return item.row; }).filter(function (row) { return scope !== 'single' || row.question.id === targetId; });
    const types = { choice: '选择题', blank: '填空题', solution: '解答题' };
    host.innerHTML = '<div class="jfjc-sheet' + (scope === 'single' ? ' jfjc-single' : '') + '" role="dialog" aria-modal="true" aria-labelledby="jfjc-title"><header class="jfjc-header"><strong id="jfjc-title">导入题目</strong><button data-action="close" aria-label="关闭导入">×</button></header>' +
      '<div class="jfjc-meta"><div class="jfjc-source"><span>来源</span><b title="' + escape(data.paper.title) + '">' + escape(data.paper.title) + '</b></div><div class="jfjc-target"><span>目标学习集</span><b title="' + escape(state.session.target) + '">' + escape(state.session.target) + '</b></div>' +
      (scope === 'single' ? '' : '<div class="jfjc-select"><button data-action="select-all">全选</button><button data-action="select-none">清空</button></div>') + '</div>' +
      '<div class="jfjc-scroll"><div class="jfjc-list">' + visible.map(function (r) {
        const q = r.question || {};
        const id = Number(q.id), number = escape(r.question_number), type = escape(types[q.question_type] || r.section_title || '');
        // 摘要仅显示转义后的文本；完整 Markdown、LaTeX 和图片仍走原有导入流程。
        const excerpt = escape(String(q.stem_latex || q.stem || '题干见原题').replace(/\s+/g, ' ').slice(0, 180));
        return '<div class="jfjc-row"><label class="jfjc-check"><input type="checkbox" id="jfjc-check-' + id + '" data-id="' + id + '" aria-label="选择第 ' + number + ' 题"' + (state.selected[id] ? ' checked' : '') + '></label><div class="jfjc-rowbody"><label for="jfjc-check-' + id + '" class="jfjc-rowtitle"><b>第 ' + number + ' 题</b><span>' + type + '</span></label><div class="jfjc-excerpt" id="jfjc-excerpt-' + id + '">' + excerpt + '</div></div></div>';
      }).join('') + '</div><div class="jfjc-result" id="jfjc-result" hidden></div></div>' +
      '<footer><div class="jfjc-footer-status"><span id="jfjc-count" aria-live="polite"></span><span id="jfjc-status" role="status" aria-live="polite"></span></div><div class="jfjc-footer-actions"><div class="jfjc-mode"><span>导入内容</span><input type="hidden" id="jfjc-content" value="' + content + '"><div class="jfjc-segments" role="group" aria-label="导入内容"><button data-action="content" data-content="question" aria-pressed="' + (content === 'question') + '">题目</button><button data-action="content" data-content="questionAnswer" aria-pressed="' + (content === 'questionAnswer') + '">题目＋答案</button></div></div><button data-action="retry" id="jfjc-retry" hidden>重试失败题</button><button data-action="commit" id="jfjc-commit">导入</button></div></footer></div>';
    host.querySelectorAll('input[data-id]').forEach(function (input) { input.checked = Boolean(state.selected[input.dataset.id]); });
    host.hidden = false; viewport(); count();
    (scope === 'selected' ? host.querySelector('[data-action="select-all"]') : document.getElementById('jfjc-commit')).focus();
  }
  function count() {
    const el = document.getElementById('jfjc-count'), amount = Object.keys(state.selected).length;
    if (el) el.textContent = '已选 ' + amount + ' / ' + (state.scope === 'single' ? 1 : state.preview.questions.length) + ' 题';
    const button = document.getElementById('jfjc-commit');
    if (button) { button.disabled = state.busy || !amount; button.textContent = state.busy ? '导入中…' : '导入 ' + amount + ' 题'; }
    document.querySelectorAll('#jfjc-dialog input[data-id]').forEach(function (input) { input.closest('.jfjc-row').classList.toggle('is-selected', Boolean(state.selected[input.dataset.id])); });
  }
  function controls(busy) {
    const host = document.getElementById('jfjc-dialog');
    host.querySelectorAll('input,[data-action="content"],[data-action="select-all"],[data-action="select-none"],[data-action="retry"]').forEach(function (e) { e.disabled = busy; });
    // 顶部关闭按钮兼作停止入口，任务结束前仍保持导入控件锁定。
    const closeButton = host.querySelector('.jfjc-header [data-action="close"]');
    if (closeButton) { closeButton.setAttribute('aria-label', busy ? '停止导入' : '关闭导入'); closeButton.title = busy ? '停止导入' : '关闭导入'; }
    count();
  }
  function viewport() {
    const host = document.getElementById('jfjc-dialog'); if (!host) return;
    const v = window.visualViewport;
    const height = v ? v.height : window.innerHeight;
    host.style.height = height + 'px'; host.style.top = (v ? v.offsetTop : 0) + 'px';
    host.classList.toggle('is-short', height < 440);
  }
  function scrollLock(locked) {
    if (locked && !state.scrollLocked) { state.bodyOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; state.scrollLocked = true; }
    if (!locked && state.scrollLocked) { document.body.style.overflow = state.bodyOverflow || ''; state.scrollLocked = false; }
  }
  function close() {
    if (state.session) native('cancel', state.session.token);
    cancel(); state.busy = false; state.preview = null; state.operation = null; state.session = null;
    const el = document.getElementById('jfjc-dialog'); if (el) el.hidden = true;
    scrollLock(false);
  }
  async function open(scope, options) {
    if (state.busy) return 'busy';
    cancel();
    const ctx = context(); if (!ctx) throw new Error('请先打开一份试卷或题目详情');
    state.cancelled = false;
    state.session = { token: options.token, route: route(), target: options.target, content: options.content };
    const session = state.session;
    state.preview = null; state.importRequest = null; state.retryIds = [];
    const target = scope === 'single' ? currentQuestion() : ctx.questionId || 0;
    if (scope === 'single' && !target) throw new Error('没有识别到当前题目，请使用“选题导入”');
    const el = document.getElementById('jfjc-dialog'); el.hidden = false;
    scrollLock(true); viewport(); el.innerHTML = '<div class="jfjc-sheet jfjc-state"><p role="status">正在读取题目…</p><button data-action="close">取消</button></div>';
    try { const data = await envelope(ctx, session); ensure(session); renderPreview(data, scope, target); }
    catch (error) { if (!state.cancelled && state.session === session) { el.innerHTML = '<div class="jfjc-sheet jfjc-state"><p role="alert">' + escape(message(error)) + '</p><button data-action="close">关闭</button></div>'; } }
    return 'opened';
  }
  function commit(retry) {
    if (state.busy || !state.preview) return;
    const ids = retry ? state.retryIds : Object.keys(state.selected).map(Number);
    if (!ids || !ids.length) { status('请至少选择一道题。'); return; }
    state.cancelled = false; ensure(); state.busy = true; controls(true);
    document.getElementById('jfjc-result').hidden = true;
    document.getElementById('jfjc-retry').hidden = true;
    state.importRequest = { envelope: state.preview, ids: ids, content: document.getElementById('jfjc-content').value, route: state.session.route };
    native('import', state.session.token); status('正在准备导入…');
  }
  function begin(token) { return launch(token, function () { ensure(); if (!state.importRequest) throw new Error('尚未确认导入'); return state.importRequest; }); }
  function panelSession(token) {
    if (state.busy) return false;
    cancel(); state.cancelled = false;
    state.session = { token: token, route: route(), panel: true };
    state.preview = null; state.importRequest = null;
    return true;
  }
  function catalog(token, subject, kind) {
    if (!['math1', 'math2', 'math3'].includes(subject) || !['official', 'mock'].includes(kind) || !panelSession(token)) return 'rejected';
    return launch(token, async function (session) {
      const items = [], seen = new Set();
      for (let page = 1; page <= 20; page++) {
        const data = await request('/api/papers?subject=' + subject + '&kind=' + kind + '&page_size=100&page=' + page, false, session);
        if (!Array.isArray(data.items) || !Number.isSafeInteger(data.total) || data.total < 0) throw new Error('网站试卷目录格式已变化');
        data.items.forEach(function (paper) {
          if (!Number.isSafeInteger(paper.id) || paper.id < 1 || paper.subject !== subject || paper.kind !== kind || seen.has(paper.id)) throw new Error('网站试卷目录包含无效数据');
          seen.add(paper.id);
          items.push({ id: paper.id, title: paper.title, subject: paper.subject, year: paper.year, questionCount: paper.question_count,
            series: paper.series && typeof paper.series.name === 'string' ? { id: paper.series.id, name: paper.series.name } : null,
            provider: typeof paper.provider === 'string' ? paper.provider : paper.provider && typeof paper.provider.name === 'string' ? paper.provider.name : typeof paper.provider_name === 'string' ? paper.provider_name : '', setNumber: paper.set_number });
        });
        if (items.length >= data.total) return { papers: items };
        if (!data.items.length) throw new Error('网站试卷目录分页不完整');
      }
      throw new Error('试卷目录过大，请在数学页面选择试卷导入');
    });
  }
  function panelPaper(token, id) {
    if (!Number.isSafeInteger(id) || id < 1 || !panelSession(token)) return 'rejected';
    return launch(token, async function (session) {
      const data = await request('/api/papers/' + id + '/questions', false, session);
      if (!data.paper || data.paper.id !== id || !Array.isArray(data.questions)) throw new Error('网站返回了其他试卷或无效题目');
      state.preview = data; return data;
    });
  }
  function panelCommit(token, ids, content) {
    if (!state.session || !state.session.panel || state.session.token !== token || !state.preview || state.busy) return 'rejected';
    ensure();
    if (!['question', 'questionAnswer'].includes(content) || !Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(function (id) { return !state.preview.questions.some(function (r) { return r.question && r.question.id === id; }); })) return 'rejected';
    state.importRequest = { envelope: state.preview, ids: ids, content: content, route: state.session.route };
    state.busy = true; return 'accepted';
  }
  function prepare(token, id, needQuestion, needAnswer) {
    return launch(token, async function (session) {
      ensure(session); const row = state.preview.questions.find(function (r) { return r.question && r.question.id === id; });
      if (!row || !state.importRequest.ids.includes(id)) throw new Error('题目不属于本次选择');
      const q = row.question, images = {}, inlineImages = {};
      let total = 0, imageCount = 0;
      async function image(url) {
        if (++imageCount > 32) throw new Error('本题图片数量超过单题处理上限');
        const result = await request(url, true, session); total += result.length;
        if (total > 16 * 1024 * 1024) throw new Error('本题图片总量过大，请单独处理');
        return result;
      }
      for (const asset of q.assets || []) {
        if (asset.asset_type !== 'image') throw new Error('存在暂不支持的附件');
        const needed = ['stem', 'option'].includes(asset.usage) ? needQuestion : needAnswer;
        if (needed) { images[asset.id] = await image(asset.url); ensure(session); }
      }
      const texts = [];
      if (needQuestion) {
        texts.push(q.stem_latex || q.stem || '');
        'ABCD'.split('').forEach(function (key) { texts.push((q.options || {})[key] || (q.option_text || {})[key] || ''); });
      }
      if (needAnswer) texts.push(q.correct_answer_latex || q.correct_answer || '', q.explanation_latex || q.answer_explanation || '');
      const urls = [];
      texts.forEach(function (text) { const regex = /!\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g; let match; while ((match = regex.exec(text))) { if (!urls.includes(match[1])) urls.push(match[1]); } });
      for (const url of urls) { inlineImages[url] = await image(url); ensure(session); }
      return { questionId: id, images: images, inlineImages: inlineImages };
    });
  }
  function feedback(token, value) {
    if (!state.session || token !== state.session.token) return 'stale';
    if (state.session.panel) { if (value.done) state.busy = false; return 'updated'; }
    status(value.message || '');
    if (state.busy && !value.done && value.message) document.getElementById('jfjc-count').textContent = String(value.message).split('：')[0];
    if (value.done) {
      state.busy = false; controls(false);
      state.retryIds = value.retryIds || [];
      document.getElementById('jfjc-retry').hidden = !state.retryIds.length;
      document.getElementById('jfjc-commit').hidden = Boolean(state.retryIds.length);
      const result = document.getElementById('jfjc-result'); result.innerHTML = ''; result.hidden = false;
      const summary = document.createElement('p'); summary.textContent = value.message || '导入已结束'; result.appendChild(summary);
      if (value.details && value.details.length) {
        const details = document.createElement('details'), heading = document.createElement('summary'); heading.textContent = '查看 ' + value.details.length + ' 条未完成原因'; details.appendChild(heading);
        const list = document.createElement('ul'); list.className = 'jfjc-errors';
        value.details.forEach(function (text) { const li = document.createElement('li'); li.textContent = text; list.appendChild(li); });
        details.appendChild(list); result.appendChild(details);
      }
    }
    return 'updated';
  }
  function mount() {
    if (!document.body || document.getElementById('jfjc-toolbar')) return;
    if (!document.getElementById('jfjc-style')) {
      const style = document.createElement('style'); style.id = 'jfjc-style';
      style.textContent = window.__JFJC_DIALOG_CSS__ || ''; document.head.appendChild(style);
    }
    const toolbar = document.createElement('div'); toolbar.id = 'jfjc-toolbar'; toolbar.setAttribute('aria-label', 'Jifengjincao Bridge');
    toolbar.innerHTML = '<button data-scope="selected">选题导入</button>';
    toolbar.addEventListener('click', function (event) { const button = event.target.closest('[data-scope]'); if (button) native('preview', '', button.dataset.scope); });
    document.body.appendChild(toolbar);
    const dialog = document.createElement('div'); dialog.id = 'jfjc-dialog'; dialog.hidden = true;
    dialog.addEventListener('click', function (event) {
      const button = event.target.closest('[data-action]'); if (!button) return;
      const action = button.dataset.action;
      if (action === 'close') { if (state.busy) { native('cancel', state.session.token); cancel(); status('正在停止导入…'); } else close(); }
      if (action === 'commit') commit(false);
      if (action === 'retry') commit(true);
      if (action === 'content' && !state.busy) {
        document.getElementById('jfjc-content').value = button.dataset.content;
        dialog.querySelectorAll('[data-action="content"]').forEach(function (item) { item.setAttribute('aria-pressed', String(item === button)); });
      }
      if ((action === 'select-all' || action === 'select-none') && !state.busy) {
        state.selected = {}; dialog.querySelectorAll('input[data-id]').forEach(function (input) { input.checked = action === 'select-all'; if (input.checked) state.selected[input.dataset.id] = true; }); count();
      }
    });
    dialog.addEventListener('change', function (event) { if (!state.busy && event.target.dataset.id) { const id = event.target.dataset.id; if (event.target.checked) state.selected[id] = true; else delete state.selected[id]; count(); } });
    document.body.appendChild(dialog);
    viewport(); window.addEventListener('resize', viewport);
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', viewport); window.visualViewport.addEventListener('scroll', viewport); }
  }
  function refresh() {
    if (window.__JFJC_LAYOUT__) window.__JFJC_LAYOUT__.refresh();
    mount(); const current = route();
    if (state.lastRoute && state.lastRoute !== current) { close(); state.session = null; }
    state.lastRoute = current;
    const toolbar = document.getElementById('jfjc-toolbar'); if (toolbar) toolbar.hidden = !context();
    focusSource();
  }
  let scheduled = false;
  const observer = new MutationObserver(function () {
    // React 题目异步出现后再定位；已定位的题目不因导入弹窗或后续渲染重复滚动。
    if (!scheduled) { scheduled = true; window.setTimeout(function () { scheduled = false; if (route() !== state.lastRoute) refresh(); else focusSource(); }, 50); }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true });
  window.addEventListener('popstate', refresh);
  window.addEventListener('hashchange', function () { state.focusedSource = ''; refresh(); });
  window.__JFJC_PAGE__ = { open: open, begin: begin, prepare: prepare, read: read, chunk: chunk, release: release, cancel: cancel, dismiss: close, feedback: feedback, refresh: refresh, context: context,
    catalog: catalog, panelPaper: panelPaper, panelCommit: panelCommit };
  refresh();
})();
