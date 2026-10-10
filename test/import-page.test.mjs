import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { nativeHost, browserHost, envelope, tick } from './helpers.mjs';
import { importPageHTML } from '../scripts/web-bundle.mjs';

function connected(responseFor) {
  const native = nativeHost(), browser = browserHost(envelope(), responseFor);
  const controller = { addon: { window: {} }, activePage: 'import', webView: {
    evaluateJavaScript(code, callback) { try { callback(vm.runInContext(code, browser.context), null); } catch (e) { callback(null, e); } }
  } };
  native.context.__JFJC_PAGE_SCRIPT__ = '';
  const send = (command, payload) => native.context.__JFJC_WEB_COMMANDS__.dispatch(controller, command, payload);
  return { native, browser, controller, send };
}

test('独立导入页复用网站同源会话，分块建卡、保守去重、补答案及刷新撤销状态', async () => {
  const h = connected(url => url.includes('/api/papers?') ? new Response(JSON.stringify({ items: [{ id: 237, subject: 'math1', kind: 'official', year: 2026, title: '真题', question_count: 2 }], total: 1 })) : null);
  const catalog = await h.send('loadCatalog', { subject: 'math1', kind: 'official' }); assert.equal(catalog.papers.length, 1);
  const paper = await h.send('loadPaper', { paperId: 237 }); assert.equal(paper.entries[0].id, 5074); assert.equal(paper.entries[0].imported, false);
  const first = await h.send('importQuestions', { paperId: 237, ids: [5074], content: 'question' }); assert.equal(first.result.created, 1); assert.equal(first.status.entries[0].imported, true); assert.equal(first.status.entries[0].complete, false);
  const second = await h.send('importQuestions', { paperId: 237, ids: [5074], content: 'questionAnswer' }); assert.equal(second.result.created, 0); assert.equal(second.result.answerAdded, 1); assert.equal(second.status.entries[0].complete, true);
  const third = await h.send('importQuestions', { paperId: 237, ids: [5074], content: 'questionAnswer' }); assert.equal(third.result.skipped, 1);
  h.native.undo();
  const refreshed = await h.send('refreshImportedStatus'); assert.equal(refreshed.entries[0].imported, true); assert.equal(refreshed.entries[0].complete, false);
  h.native.undo(); assert.equal((await h.send('refreshImportedStatus')).entries[0].imported, false);
  assert.ok(h.browser.calls.every(call => call.options.credentials === 'include'));
  assert.equal(h.browser.document.getElementById('jfjc-dialog').hidden, true);
});

test('独立导入页拒绝越界选择与隐藏网页命令，取消后可以重新读取并重试', async () => {
  const h = connected();
  await assert.rejects(h.send('loadCatalog', { subject: 'math9', kind: 'official' }), /科目/);
  await h.send('loadPaper', { paperId: 237 });
  await assert.rejects(h.send('importQuestions', { paperId: 238, ids: [5074], content: 'question' }), /失效/);
  await assert.rejects(h.send('importQuestions', { paperId: 237, ids: [999], content: 'question' }), /不属于/);
  await h.send('cancelImport');
  const retry = await h.send('importQuestions', { paperId: 237, ids: [5074], content: 'question' }); assert.equal(retry.result.created, 1);
  h.controller.activePage = 'settings'; await assert.rejects(h.send('importQuestions', {}), /打开导入/);
  h.controller.activePage = 'import'; await assert.rejects(h.send('__proto__', {}), /未知/);
});

test('目录分页、权限错误和网页切换不会产生错误试卷或建卡', async () => {
  const pages = connected(url => {
    if (!url.includes('/api/papers?')) return null;
    const page = Number(new URL(url).searchParams.get('page'));
    return new Response(JSON.stringify({ items: [{ id: page, subject: 'math1', kind: 'official', title: '卷' + page, year: 2026 }], total: 2 }));
  });
  assert.equal((await pages.send('loadCatalog', { subject: 'math1', kind: 'official' })).papers.length, 2);
  const denied = connected(() => new Response('', { status: 403 })); await assert.rejects(denied.send('loadPaper', { paperId: 237 }), /权限/); assert.equal(denied.controller.panelModel, null);
  const changed = connected(); await changed.send('loadPaper', { paperId: 237 }); changed.browser.location.pathname = '/papers/238';
  await assert.rejects(changed.send('importQuestions', { paperId: 237, ids: [5074], content: 'question' }), /切换/); assert.equal(changed.native.notes.size, 0);
});

test('导入中的目录刷新被拒绝，停止会终止图片准备，失败题可重试且不会重复建卡', async () => {
  let release, entered, block = true;
  const downloading = new Promise(resolve => { entered = resolve; });
  const h = connected(async url => {
    if (url.includes('/question-assets/') && block) { block = false; entered(); await new Promise(resolve => { release = resolve; }); }
    return null;
  });
  await h.send('loadPaper', { paperId: 237 });
  const running = h.send('importQuestions', { paperId: 237, ids: [5074, 5075], content: 'questionAnswer' });
  await downloading;
  await assert.rejects(h.send('loadCatalog', { subject: 'math2', kind: 'official' }), /等待/);
  await h.send('cancelImport'); release();
  const stopped = await running; assert.equal(stopped.result.cancelled, true); assert.equal(stopped.result.failed.length, 2); assert.equal(h.native.notes.size, 0);
  const retry = await h.send('importQuestions', { paperId: 237, ids: stopped.result.failed.map(entry => entry.id), content: 'questionAnswer' });
  assert.equal(retry.result.created, 2); assert.equal(retry.result.failed.length, 0);
});

async function localPage(send) {
  const html = importPageHTML(), { document, window: dom } = parseHTML(html);
  const calls = [], timers = new Set();
  const window = { document, setTimeout(work, ms) { const timer = setTimeout(work, ms); timers.add(timer); return timer; }, clearTimeout(timer) { clearTimeout(timer); timers.delete(timer); } };
  const append = document.body.appendChild.bind(document.body);
  document.body.appendChild = node => {
    if (node.tagName === 'IFRAME') {
      const request = JSON.parse(decodeURIComponent(node.src.split('payload=')[1])); calls.push(request);
      Promise.resolve().then(() => send(request.command, request.payload)).then(payload => window.__JFJC_BRIDGE_RECEIVE__({ requestId: request.requestId, payload }), error => window.__JFJC_BRIDGE_RECEIVE__({ requestId: request.requestId, error: { message: error.message } }));
    }
    return append(node);
  };
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1]; vm.runInNewContext(script, { window, document, console });
  for (let i = 0; i < 5; i++) await tick();
  return { document, window, calls, Event: dom.Event, close() { timers.forEach(clearTimeout); } };
}

test('实际页面筛选勾选、原文安全显示、待补答案标记与原生反馈连成闭环', async () => {
  const h = connected(url => url.includes('/api/papers?') ? new Response(JSON.stringify(new URL(url).searchParams.get('subject') === 'math1' ? { items: [{ id: 237, subject: 'math1', kind: 'official', year: 2026, title: '测试 <img onerror=evil()>', question_count: 2 }], total: 1 } : { items: [], total: 0 })) : null);
  const page = await localPage(h.send); h.controller.importWebView = { evaluateJavaScript(code, callback) { try { vm.runInNewContext(code, { window: page.window }); callback('ok', null); } catch (e) { callback(null, e); } } };
  try {
    page.document.querySelector('[data-paper]').click(); for (let i = 0; i < 10; i++) await tick();
    assert.equal(page.document.querySelectorAll('[data-question]').length, 2); assert.match(page.document.getElementById('import').textContent, /2/); assert.equal(page.document.querySelector('img'), null);
    page.document.getElementById('select-none').click(); assert.equal(page.document.getElementById('import').disabled, true);
    page.document.getElementById('select-all').click(); page.document.querySelector('[data-content="question"]').click(); page.document.getElementById('import').click();
    for (let i = 0; i < 80 && page.document.getElementById('result').hidden; i++) await tick();
    assert.equal(page.document.querySelectorAll('.question-card.imported').length, 2);
    page.document.querySelector('[data-content="questionAnswer"]').click(); assert.equal(page.document.querySelectorAll('em.pending').length, 2);
    assert.match(page.document.getElementById('import').textContent, /2/);
    assert.equal(page.calls.find(call => call.command === 'importQuestions').payload.content, 'question');
  } finally { page.close(); }
});

test('卷子分类按科目、年份、系列展开，系列身份独立，选择一卷后支持取消选择', async () => {
  const page = await localPage(async (command, payload) => {
    if (command === 'getImportPreferences') return { content: 'question' };
    if (command === 'loadCatalog') return { papers: payload.subject === 'math2' ? [
      { id: 1, title: '模拟卷一', year: 2026, series: { id: 10, name: '六套卷' }, questionCount: 22 },
      { id: 2, title: '模拟卷二', year: 2026, series: { id: 11, name: '六套卷' }, questionCount: 22 },
      { id: 3, title: '未标年份的试卷', series: null, provider: '测试作者' }
    ] : [] };
    if (command === 'loadPaper') return { paper: { id: payload.paperId, title: '模拟卷一' }, target: '测试学习集', entries: [] };
    throw new Error('未知测试命令');
  });
  try {
    page.document.querySelector('[data-kind="mock"]').click(); for (let i = 0; i < 12; i++) await tick();
    const root = page.document.querySelector('[data-branch="math2"]'); assert.equal(root.getAttribute('aria-expanded'), 'false'); root.click();
    assert.equal(root.getAttribute('aria-expanded'), 'true');
    const year = page.document.querySelector('[data-branch="math2/2026"]'); year.click(); assert.equal(year.nextElementSibling.hidden, false);
    const series = page.document.querySelectorAll('[data-branch^="math2/2026/series:"]'); assert.equal(series.length, 2); series[0].click();
    assert.match(page.document.querySelector('[data-branch="math2/null"]').textContent, /年份未标注/);
    page.document.querySelector('[data-paper="1"]').click(); for (let i = 0; i < 8; i++) await tick();
    assert.equal(page.document.querySelectorAll('.paper-leaf.active').length, 1);
    const checkbox = page.document.querySelector('[data-paper-check="1"]'); assert.equal(checkbox.checked, true); checkbox.checked = false; checkbox.dispatchEvent(new page.Event('change'));
    assert.equal(page.document.querySelectorAll('.paper-leaf.active').length, 0);
    assert.equal(page.document.getElementById('import').disabled, true);
    assert.equal(page.document.querySelector('.action-bar').closest('.right-pane') !== null, true);
  } finally { page.close(); }
});

test('同年单份真题直接按年份选择，多份或缺年份时保留完整标题', async () => {
  const page = await localPage(async (command, payload) => {
    if (command === 'getImportPreferences') return { content: 'question' };
    if (command === 'loadCatalog') return { papers: payload.subject === 'math2' ? [
      { id: 1, title: '2026 年考研数学二真题', year: 2026, questionCount: 22 },
      { id: 2, title: '2025 年考研数学二真题 A', year: 2025 },
      { id: 3, title: '2025 年考研数学二真题 B', year: 2025 },
      { id: 4, title: '未知年份的真题' }
    ] : [] };
    if (command === 'loadPaper') return { paper: { id: payload.paperId, title: '2026 年考研数学二真题' }, target: '测试学习集', entries: [] };
    throw new Error('未知命令');
  });
  try {
    assert.equal(page.document.querySelector('[data-branch="math2/2026"]'), null);
    const year = page.document.querySelector('[data-paper="1"]');
    assert.equal(year.firstElementChild.textContent, '2026 年'); assert.equal(year.title, '2026 年考研数学二真题');
    assert.equal(year.closest('.paper-children').previousElementSibling.dataset.branch, 'math2');
    assert.ok(page.document.querySelector('[data-branch="math2/2025"]'));
    assert.equal(page.document.querySelector('[data-paper="4"]').firstElementChild.textContent, '未知年份的真题');
    page.document.querySelector('[data-branch="math2"]').click(); year.click(); for (let i = 0; i < 8; i++) await tick();
    assert.equal(page.calls.find(call => call.command === 'loadPaper').payload.paperId, 1);
    assert.equal(page.document.querySelector('[data-paper-check="1"]').checked, true);
  } finally { page.close(); }
});

test('目录保留网站对象形式作者及字符串兼容，不再丢失作者名称', async () => {
  const providers = [{ name: '李艳芳', id: 9 }, '张宇', null];
  const h = connected(url => url.includes('/api/papers?') ? new Response(JSON.stringify({ total: 3, items: providers.map((provider, i) => ({ id: i + 1, title: '模拟卷', subject: 'math2', kind: 'mock', year: 2027, provider, provider_name: i === 2 ? '李林' : '', series: { id: 10, name: '三套卷' }, set_number: i + 1 })) })) : null);
  const value = await h.send('loadCatalog', { subject: 'math2', kind: 'mock' });
  assert.deepEqual(Array.from(value.papers, paper => paper.provider), ['李艳芳', '张宇', '李林']);
  assert.equal(value.papers[0].series.id, 10); assert.equal(value.papers[0].setNumber, 1);
});

test('模拟卷显示作者和系列，共用系列 ID 的作者独立，卷号精简并按序选择', async () => {
  const page = await localPage(async (command, payload) => {
    if (command === 'getImportPreferences') return { content: 'question' };
    if (command === 'loadCatalog') return { papers: payload.subject === 'math2' ? [
      { id: 2, title: '27李艳芳三套卷 数二 卷二', year: 2027, provider: '李艳芳', series: { id: 10, name: '三套卷' }, setNumber: 2 },
      { id: 1, title: '27李艳芳三套卷 数二 卷一', year: 2027, provider: '李艳芳', series: { id: 10, name: '三套卷' }, setNumber: 1 },
      { id: 3, title: '张宇卷一', year: 2027, provider: '张宇', series: { id: 10, name: '三套卷' }, setNumber: 1 },
      { id: 4, title: '李林卷一', year: 2027, provider: '李林', series: { id: 11, name: '李林六套卷' }, setNumber: 1 }
    ] : [] };
    if (command === 'loadPaper') return { paper: { id: payload.paperId, title: '27李艳芳三套卷 数二 卷二' }, target: '测试学习集', entries: [] };
    throw new Error('未知命令');
  });
  try {
    page.document.querySelector('[data-kind="mock"]').click(); for (let i = 0; i < 12; i++) await tick();
    const groups = page.document.querySelectorAll('[data-branch^="math2/2027/series:"]');
    assert.deepEqual(Array.from(groups, node => node.querySelector('.paper-node-title').textContent), ['李艳芳 · 三套卷', '张宇 · 三套卷', '李林 · 六套卷']);
    const papers = groups[0].nextElementSibling.querySelectorAll('[data-paper]');
    assert.deepEqual(Array.from(papers, node => node.firstElementChild.textContent), ['卷一', '卷二']);
    assert.equal(papers[1].title, '27李艳芳三套卷 数二 卷二');
    papers[1].click(); for (let i = 0; i < 8; i++) await tick();
    assert.equal(page.calls.find(call => call.command === 'loadPaper').payload.paperId, 2);
    assert.equal(page.document.getElementById('paper-title').textContent, '27李艳芳三套卷 数二 卷二');
  } finally { page.close(); }
});

test('模拟卷缺少作者时兼容截图完整标题，缺卷号保留原文，名称按文字安全显示', async () => {
  const page = await localPage(async (command, payload) => {
    if (command === 'getImportPreferences') return { content: 'question' };
    if (command === 'loadCatalog') return { papers: payload.subject === 'math2' ? [
      { id: 1, title: '27李艳芳三套卷 数二 卷一', year: 2027, series: { id: 10, name: '三套卷' } },
      { id: 2, title: '作者未标注的完整试卷', year: 2027, series: { id: 11, name: '三套卷' } },
      { id: 3, title: '未知卷号', year: 2027, provider: '<img onerror=evil()>', series: { id: 12, name: '六套卷' } }
    ] : [] };
    throw new Error('未知命令');
  });
  try {
    page.document.querySelector('[data-kind="mock"]').click(); for (let i = 0; i < 12; i++) await tick();
    const groups = page.document.querySelectorAll('[data-branch^="math2/2027/series:"]');
    assert.equal(groups[0].querySelector('.paper-node-title').textContent, '李艳芳 · 三套卷');
    assert.equal(page.document.querySelector('[data-paper="1"]').firstElementChild.textContent, '卷一');
    assert.equal(groups[1].querySelector('.paper-node-title').textContent, '作者未标注的完整试卷');
    assert.equal(page.document.querySelector('[data-paper="2"]').firstElementChild.textContent, '作者未标注的完整试卷');
    assert.equal(page.document.querySelector('[data-paper="3"]').firstElementChild.textContent, '未知卷号');
    assert.equal(page.document.querySelector('img'), null);
  } finally { page.close(); }
});
