import MNBridge from './lib/mnBridge.js';

(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { kind: 'official', papers: [], expanded: new Set(), paper: null, entries: [], selected: new Set(), types: new Set(['choice', 'blank', 'solution']), content: 'questionAnswer', busy: false, importing: false, failed: [] };
  const subjects = { math1: '数学一', math2: '数学二', math3: '数学三' };
  const types = { choice: '选择题', blank: '填空题', solution: '解答题' };
  function element(tag, text, className) { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; }
  function imported(entry) { return state.content === 'question' ? entry.imported : entry.complete; }
  function visible() { return state.entries.filter(entry => state.types.has(entry.type)); }
  function error(value) { $('error').hidden = !value; $('error').textContent = value || ''; }
  function lock() {
    document.querySelectorAll('button,input,select').forEach(node => { node.disabled = state.busy; });
    $('stop').hidden = !state.importing; $('stop').disabled = !state.importing;
    $('refresh-status').disabled = state.busy || !state.paper;
    $('select-all').disabled = state.busy || !state.paper; $('select-none').disabled = state.busy || !state.paper;
    document.querySelectorAll('[data-question]').forEach(node => { const entry = state.entries.find(row => row.id === Number(node.dataset.question)); node.disabled = state.busy || imported(entry); });
    $('import').disabled = state.busy || !state.selected.size;
    $('import').textContent = state.importing ? '正在导入…' : '导入 ' + state.selected.size + ' 道题';
  }
  function count() { $('selection-count').textContent = state.paper ? '匹配 ' + visible().length + ' 道，已选 ' + state.selected.size + ' 道' : '请在左侧选择一份试卷'; lock(); }
  function clearResult() { state.failed = []; $('result').hidden = true; $('result').textContent = ''; $('retry').hidden = true; $('progress').textContent = '等待导入'; }
  const volumeNames = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  function volume(paper) {
    if (Number.isSafeInteger(paper.setNumber) && paper.setNumber > 0) return { order: paper.setNumber, title: '卷' + (volumeNames[paper.setNumber] || paper.setNumber) };
    const match = /卷\s*([一二三四五六七八九十\d]+)\s*$/.exec(paper.title || '');
    if (match) return { order: /^\d+$/.test(match[1]) ? Number(match[1]) : volumeNames.indexOf(match[1]) > 0 ? volumeNames.indexOf(match[1]) : Infinity, title: '卷' + match[1] };
    return { order: Infinity, title: paper.title };
  }
  function mockSeries(paper) {
    const name = String(paper.series && paper.series.name || '').trim();
    let provider = String(paper.provider || '').trim();
    // 旧数据缺作者字段时，只从完整标题中提取明确位于“几套卷”前的文字。
    if (!provider && /^[一二三四五六七八九十\d]+套卷$/.test(name)) {
      let title = String(paper.title || '').trim();
      if (Number.isSafeInteger(paper.year)) title = title.replace(new RegExp('^(?:' + paper.year + '|' + String(paper.year).slice(-2) + ')(?:\\s*[年版])?\\s*'), '');
      const position = title.indexOf(name), prefix = position > 0 ? title.slice(0, position).replace(/[\s·・—-]+$/, '').trim() : '';
      if (/^[\u3400-\u9fffA-Za-z·\s]{1,24}$/.test(prefix)) provider = prefix;
    }
    let title = name || provider || paper.title || '其他模拟卷';
    if (provider && name) {
      const suffix = name.startsWith(provider) ? name.slice(provider.length).replace(/^[\s·・—-]+/, '') : name;
      title = suffix ? provider + ' · ' + suffix : provider;
    } else if (!provider && /^[一二三四五六七八九十\d]+套卷$/.test(name)) title = paper.title || name;
    // 作者参与身份区分，同名系列或共用系列 ID 的不同作者也不会混合。
    const key = paper.series ? 'series:' + (paper.series.id == null ? name : paper.series.id) + '/provider:' + provider : provider ? 'provider:' + provider : 'paper:' + paper.id;
    return { key: key, title: title };
  }
  function renderPapers() {
    $('papers').textContent = '';
    const papers = state.papers;
    $('catalog-title').textContent = state.kind === 'mock' ? '模拟卷' : '历年真题';
    $('catalog-status').textContent = papers.length ? papers.length + ' 份试卷' : '当前筛选下暂无试卷';
    function branch(parent, key, title, render, amount) {
      const group = element('div', null, 'paper-group'), button = element('button', null, 'paper-disclosure');
      button.title = title;
      button.dataset.branch = key; button.setAttribute('aria-expanded', String(state.expanded.has(key)));
      button.appendChild(element('span', state.expanded.has(key) ? '⌄' : '›', 'paper-chevron'));
      button.appendChild(element('span', title, 'paper-node-title'));
      if (!amount) button.appendChild(element('small', '暂无试卷'));
      const children = element('div', null, 'paper-children'); children.hidden = !state.expanded.has(key); render(children);
      button.addEventListener('click', () => {
        if (state.busy) return;
        if (state.expanded.has(key)) state.expanded.delete(key); else state.expanded.add(key);
        const open = state.expanded.has(key); children.hidden = !open; button.setAttribute('aria-expanded', String(open)); button.firstElementChild.textContent = open ? '⌄' : '›';
      });
      group.appendChild(button); group.appendChild(children); parent.appendChild(group);
    }
    function leaf(parent, paper, displayTitle) {
      const active = !!state.paper && paper.id === state.paper.id;
      const row = element('div', null, 'paper-leaf' + (active ? ' active' : ''));
      const button = element('button', null, 'paper-leaf-button'); button.dataset.paper = paper.id; button.setAttribute('aria-pressed', String(active));
      const title = displayTitle || paper.title;
      button.appendChild(element('span', title)); button.title = paper.title;
      button.appendChild(element('small', paper.questionCount == null ? '题数未标注' : paper.questionCount + ' 道题'));
      const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.checked = active; checkbox.dataset.paperCheck = paper.id; checkbox.setAttribute('aria-label', '选择试卷：' + paper.title);
      button.addEventListener('click', () => loadPaper(paper.id));
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) loadPaper(paper.id);
        else if (active && !state.busy) { state.paper = null; state.entries = []; state.selected.clear(); clearResult(); $('target').textContent = ''; renderQuestions(); renderPapers(); }
      });
      row.appendChild(button); row.appendChild(checkbox); parent.appendChild(row);
    }
    Object.entries(subjects).forEach(([subject, title]) => {
      const rows = papers.filter(paper => paper.subject === subject);
      branch($('papers'), subject, title, parent => {
        const years = [...new Set(rows.map(paper => paper.year || null))].sort((a, b) => (b || 0) - (a || 0));
        years.forEach(year => {
          const yearRows = rows.filter(paper => (paper.year || null) === year);
          // 一年只有一份真题时，年份本身就是试卷入口，不再套一层目录。
          if (state.kind !== 'mock' && year && yearRows.length === 1) { leaf(parent, yearRows[0], year + ' 年'); return; }
          branch(parent, subject + '/' + year, year ? year + '年' : '年份未标注', yearParent => {
            if (state.kind !== 'mock') { yearRows.forEach(paper => leaf(yearParent, paper)); return; }
            const series = new Map();
            yearRows.forEach(paper => {
              const group = mockSeries(paper);
              if (!series.has(group.key)) series.set(group.key, { title: group.title, papers: [] });
              series.get(group.key).papers.push(paper);
            });
            series.forEach((group, key) => branch(yearParent, subject + '/' + year + '/' + key, group.title, seriesParent => group.papers.slice().sort((a, b) => volume(a).order - volume(b).order).forEach(paper => leaf(seriesParent, paper, volume(paper).title)), group.papers.length));
          }, yearRows.length);
        });
      }, rows.length);
    }); lock();
  }
  function renderQuestions() {
    $('questions').textContent = ''; $('paper-title').textContent = state.paper ? state.paper.title : '具体题目';
    const rows = visible(); $('empty').hidden = !!rows.length;
    $('empty').textContent = state.paper ? '当前题型下没有题目' : '选择试卷后，勾选需要导入的题目';
    rows.forEach(entry => {
      const card = element('article', null, 'question-card' + (imported(entry) ? ' imported' : '') + (state.selected.has(entry.id) ? ' selected' : ''));
      const label = element('label', null, 'question-select'), input = element('input'); input.type = 'checkbox'; input.dataset.question = entry.id; input.checked = state.selected.has(entry.id);
      input.setAttribute('aria-label', '选择第 ' + entry.number + ' 题'); label.appendChild(input);
      const heading = element('span'); heading.appendChild(element('strong', '第 ' + entry.number + ' 题')); heading.appendChild(element('small', entry.section + ' · ' + (types[entry.type] || ''))); label.appendChild(heading);
      if (imported(entry)) label.appendChild(element('em', state.content === 'question' ? '已导入' : '已含答案'));
      else if (entry.imported) label.appendChild(element('em', '待补答案', 'pending'));
      card.appendChild(label);
      const text = entry.stem + Object.entries(entry.options).filter(([, value]) => value).map(([key, value]) => '\n' + key + '. ' + value).join('');
      // 预览只显示原始文字，避免解释网站 HTML；完整公式和图片仍交由已有导入流程处理。
      card.appendChild(element('p', text, 'question-text'));
      if (entry.assets.length) card.appendChild(element('p', '含 ' + entry.assets.length + ' 张题目/解析图片，导入时保存', 'question-assets'));
      input.addEventListener('change', () => { if (input.checked) state.selected.add(entry.id); else state.selected.delete(entry.id); card.classList.toggle('selected', input.checked); count(); });
      $('questions').appendChild(card);
    }); count();
  }
  function chooseAll() { state.selected = new Set(visible().filter(entry => !imported(entry)).map(entry => entry.id)); }
  function applyStatus(value, selectAll) {
    state.paper = value.paper; state.entries = value.entries; $('target').textContent = '目标学习集：' + value.target;
    if (selectAll) chooseAll(); else state.selected = new Set([...state.selected].filter(id => state.entries.some(entry => entry.id === id && !imported(entry))));
    renderQuestions(); renderPapers();
  }
  async function operation(work, importing) {
    if (state.busy) return;
    state.busy = true; state.importing = Boolean(importing); error(''); lock();
    try { await work(); } catch (e) { error(e.message || String(e)); }
    finally { state.busy = false; state.importing = false; lock(); }
  }
  async function loadCatalog() {
    return operation(async () => {
      state.paper = null; state.entries = []; state.selected.clear(); state.papers = []; clearResult(); renderQuestions(); renderPapers(); $('target').textContent = '';
      $('catalog-status').textContent = '正在读取试卷…';
      const papers = [];
      // 逐科目读取同源目录，避免并发覆盖网站的分块任务。
      for (const subject of Object.keys(subjects)) {
        const value = await MNBridge.send('loadCatalog', { subject: subject, kind: state.kind });
        papers.push(...value.papers.map(paper => ({ ...paper, subject: subject })));
      }
      state.papers = papers;
      if (!state.expanded.size) {
        state.expanded.add('math1');
        const latest = Math.max(...papers.filter(paper => paper.subject === 'math1').map(paper => paper.year || 0));
        if (latest > 0) state.expanded.add('math1/' + latest);
      }
      renderPapers();
    }).then(() => { if (!state.papers.length && !$('error').hidden) $('catalog-status').textContent = '读取失败，请刷新重试'; });
  }
  async function loadPaper(id) {
    return operation(async () => {
      state.paper = null; state.entries = []; state.selected.clear(); clearResult(); renderQuestions(); renderPapers(); $('target').textContent = ''; $('empty').textContent = '正在读取题目…';
      applyStatus(await MNBridge.send('loadPaper', { paperId: id }), true);
    });
  }
  async function runImport(retry) {
    const ids = retry ? state.failed : [...state.selected]; if (!ids.length || state.busy || !state.paper) return;
    return operation(async () => {
      clearResult(); $('progress').textContent = '正在准备导入…';
      const response = await MNBridge.send('importQuestions', { paperId: state.paper.id, ids: ids, content: state.content });
      const result = response.result; if (response.status) applyStatus(response.status, false); state.failed = [...new Set(result.failed.map(entry => entry.id))];
      $('result').hidden = false; $('result').appendChild(element('p', '新建 ' + result.created + '，跳过 ' + result.skipped + '，补答案解析 ' + result.answerAdded + '，未完成 ' + state.failed.length));
      if (result.error) $('result').appendChild(element('p', result.error));
      if (result.failed.length) { const list = element('ul'); result.failed.forEach(entry => list.appendChild(element('li', '第 ' + entry.number + ' 题：' + entry.reason))); $('result').appendChild(list); }
      $('retry').hidden = !state.failed.length; $('progress').textContent = result.cancelled ? '导入已停止，可重试未完成题目' : result.error ? '导入中断' : '导入已结束';
    }, true);
  }
  function segments(id, attribute, apply) {
    $(id).addEventListener('click', event => { const button = event.target.closest('[' + attribute + ']'); if (!button || state.busy) return; $(id).querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed', String(node === button))); apply(button.getAttribute(attribute)); });
  }
  segments('kinds', 'data-kind', kind => { state.kind = kind; state.expanded.clear(); loadCatalog(); });
  segments('contents', 'data-content', content => { state.content = content; clearResult(); chooseAll(); renderQuestions(); });
  document.querySelectorAll('[data-type]').forEach(input => input.addEventListener('change', () => { if (input.checked) state.types.add(input.dataset.type); else state.types.delete(input.dataset.type); chooseAll(); renderQuestions(); }));
  $('refresh-catalog').addEventListener('click', loadCatalog);
  $('refresh-status').addEventListener('click', () => operation(async () => applyStatus(await MNBridge.send('refreshImportedStatus'), false)));
  $('select-all').addEventListener('click', () => { chooseAll(); renderQuestions(); }); $('select-none').addEventListener('click', () => { state.selected.clear(); renderQuestions(); });
  $('import').addEventListener('click', () => runImport(false)); $('retry').addEventListener('click', () => runImport(true));
  $('stop').addEventListener('click', async () => { $('stop').disabled = true; try { await MNBridge.send('cancelImport'); $('progress').textContent = '正在停止导入…'; } catch (e) { error(e.message); $('stop').disabled = false; } });
  window.__JFJC_IMPORT_PAGE__ = { progress: value => { $('progress').textContent = value.message || ''; }, activate: () => { if (!state.busy && state.paper) operation(async () => applyStatus(await MNBridge.send('refreshImportedStatus'), false)); } };
  async function start() {
    try { const preferences = await MNBridge.send('getImportPreferences'); state.content = preferences.content === 'question' ? 'question' : 'questionAnswer'; $('contents').querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.content === state.content))); } catch (e) { error(e.message); }
    loadCatalog();
  }
  start();
})();
