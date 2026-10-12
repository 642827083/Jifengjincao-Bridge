(function () {
  if (window.location.origin !== 'https://bbkaoyan.cn') return;
  if (window.__JFJC_QUESTION_TOOLS__) { window.__JFJC_QUESTION_TOOLS__.refresh(); return; }
  let enabled = false, importEnabled = false, pending = null, timer = null, expiry = null, sequence = 0;
  function positive(value) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : 0; }
  function route() { return window.location.pathname + window.location.search; }
  function entries() {
    const path = window.location.pathname, result = [];
    const paper = /^\/papers\/([1-9]\d*)\/?$/.exec(path), detail = /^\/questions\/([1-9]\d*)\/?$/.exec(path);
    if (paper || detail) {
      const detailCard = detail && (document.getElementById('question-' + detail[1]) || document.querySelector('article.question-card'));
      const cards = detail ? (detailCard ? [detailCard] : []) : document.querySelectorAll('article[id^="question-"]');
      cards.forEach(function (card) {
        const id = /^question-([1-9]\d*)$/.exec(card.id || '');
        const questionId = detail ? positive(detail[1]) : id && positive(id[1]);
        const paperId = paper ? positive(paper[1]) : 0;
        const host = card.querySelector('.question-card-meta-line') || card.querySelector('.question-card-head');
        if (questionId && (!paper || paperId) && host) result.push({ host: host, target: { paperId: paperId, questionId: questionId, route: route() } });
      });
    } else if (/^\/assistant\/conversations\/[^/]+\/review\/?$/.test(path)) {
      document.querySelectorAll('.review-chat-heading').forEach(function (host) {
        const match = /题目上下文\s*#([1-9]\d*)/.exec(host.textContent || '');
        if (match && positive(match[1])) result.push({ host: host, target: { paperId: 0, questionId: positive(match[1]), route: route() } });
      });
    } else if (window.__JFJC_SELECTION__.searchPage() || window.__JFJC_SELECTION__.basketPage()) {
      window.__JFJC_SELECTION__.entries().forEach(function (entry) {
        result.push({ host: entry.host, label: '定位题目', target: { paperId: 0, questionId: entry.id, route: route(), snapshot: entry.snapshot } });
      });
    }
    return result;
  }
  function same(a, b) { return a && b && a.paperId === b.paperId && a.questionId === b.questionId && a.route === b.route && a.snapshot === b.snapshot; }
  function native(command, token, target) {
    const frame = document.createElement('iframe'); frame.hidden = true;
    frame.src = 'jifengjincaobridge://' + command + '?token=' + encodeURIComponent(token) + '&scope=' + encodeURIComponent(target ? JSON.stringify(target) : '');
    document.body.appendChild(frame); window.setTimeout(function () { frame.remove(); }, 800);
  }
  function matches(target) { return enabled && window.location.origin === 'https://bbkaoyan.cn' && entries().some(function (entry) { return same(entry.target, target); }); }
  function matchesSingle(target) { return importEnabled && window.location.origin === 'https://bbkaoyan.cn' && entries().some(function (entry) { return same(entry.target, target); }); }
  function finish(token) { if (pending && pending.token === token) { window.clearTimeout(expiry); expiry = null; pending = null; refresh(); } }
  function refresh() {
    const rows = enabled || importEnabled ? entries() : [], hosts = new Set(rows.map(function (entry) { return entry.host; }));
    if (pending && (!(pending.single ? importEnabled : enabled) || !rows.some(function (entry) { return same(entry.target, pending.target); }))) {
      const token = pending.token, command = pending.single ? 'cancel-single' : 'cancel-locate'; finish(token); native(command, token); return;
    }
    document.querySelectorAll('.jfjc-locate-card,.jfjc-import-single').forEach(function (button) {
      if (!hosts.has(button.parentNode) || (button.className === 'jfjc-import-single' ? !importEnabled : !enabled)) button.remove();
    });
    function render(entry, single) {
      if (single ? !importEnabled : !enabled) return;
      const className = single ? 'jfjc-import-single' : 'jfjc-locate-card';
      let button = entry.host.querySelector('.' + className);
      if (!button) {
        button = document.createElement('button'); button.type = 'button'; button.className = className;
        button.addEventListener('click', function (event) {
          event.preventDefault(); event.stopPropagation();
          if (pending || !button.isConnected || !(single ? matchesSingle(button.__jfjcTarget) : matches(button.__jfjcTarget))) return;
          const token = (single ? 'jfjc-single-' : 'jfjc-locate-') + Date.now().toString(36) + '-' + (++sequence);
          pending = { token: token, target: button.__jfjcTarget, single: single }; refresh();
          native(single ? 'single-import' : 'locate-card', token, pending.target);
          // 原生侧有分阶段超时；此处只处理宿主未收到命令的情况。
          expiry = window.setTimeout(function () { finish(token); }, 180000);
        });
        const number = entry.host.querySelector('.question-global-id');
        const locate = entry.host.querySelector('.jfjc-locate-card');
        const anchor = single && locate || number;
        entry.host.insertBefore(button, anchor ? anchor.nextSibling : null);
      }
      button.__jfjcTarget = entry.target;
      const text = pending && pending.single === single && same(pending.target, entry.target) ? (single ? '导入中…' : '定位中…') : (single ? '导入本题' : entry.label || '定位卡片');
      if (button.textContent !== text) button.textContent = text;
      if (button.disabled !== Boolean(pending)) button.disabled = Boolean(pending);
    }
    rows.forEach(function (entry) { render(entry, false); render(entry, true); });
    if (!document.getElementById('jfjc-question-tools-style')) {
      const style = document.createElement('style'); style.id = 'jfjc-question-tools-style';
      style.textContent = '.jfjc-locate-card,.jfjc-import-single{flex:0 0 auto;margin:0 4px;padding:5px 10px;min-height:30px;border:1px solid #cbdcde;border-radius:7px;background:#fff;color:#35616a;font:inherit;font-size:12px;line-height:1.3;white-space:nowrap;cursor:pointer}.jfjc-locate-card:disabled,.jfjc-import-single:disabled{opacity:.55;cursor:default}.jfjc-locate-card:focus-visible,.jfjc-import-single:focus-visible{outline:2px solid #35616a;outline-offset:2px}';
      document.head.appendChild(style);
    }
  }
  function configure(options) { enabled = Boolean(options && options.enabled); importEnabled = Boolean(options && options.importEnabled); refresh(); }
  function schedule() { if (timer !== null) return; timer = window.setTimeout(function () { timer = null; refresh(); }, 50); }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('popstate', schedule); window.addEventListener('hashchange', schedule);
  window.__JFJC_QUESTION_TOOLS__ = { configure: configure, refresh: refresh, matches: matches, matchesSingle: matchesSingle, finish: finish, finishSingle: finish };
})();
