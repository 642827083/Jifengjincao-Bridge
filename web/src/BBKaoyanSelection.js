(function () {
  if (window.location.origin !== 'https://bbkaoyan.cn' || window.__JFJC_SELECTION__) return;
  const snapshots = new WeakMap(); let sequence = 0;
  function searchPage() { return /^\/assistant\/conversations\/[A-Za-z0-9_-]+\/search\/?$/.test(window.location.pathname); }
  function basketPage() { return /^\/(?:baskets|public-baskets)\/[A-Za-z0-9_-]+\/?$/.test(window.location.pathname); }
  function latest() {
    if (basketPage()) return document.querySelector('.basket-detail-page,.shared-basket-page');
    if (!searchPage()) return null;
    const nodes = document.querySelectorAll('.search-message-snapshot');
    return nodes.length ? nodes[nodes.length - 1] : null;
  }
  function key(node) { if (!snapshots.has(node)) snapshots.set(node, (basketPage() ? 'basket-' : 'search-') + (++sequence)); return snapshots.get(node); }
  function entries() {
    const node = latest(), result = [], seen = new Set();
    if (!node) return result;
    if (basketPage()) {
      node.querySelectorAll('article.basket-detail-question-card[id^="basket-question-"]').forEach(function (card) {
        const match = /^basket-question-([1-9]\d*)$/.exec(card.id), id = match && Number(match[1]);
        const host = card.querySelector('.question-card-meta-line');
        if (!Number.isSafeInteger(id) || id < 1 || !host || seen.has(id)) return;
        seen.add(id); result.push({ id: id, host: host, card: card, snapshot: key(node) });
      });
      return result;
    }
    node.querySelectorAll('.search-snapshot-question').forEach(function (card) {
      const host = card.querySelector('.search-snapshot-question-select');
      const number = host && Array.from(host.querySelectorAll('span')).map(function (span) { return /^题目\s+([1-9]\d*)$/.exec(span.textContent.trim()); }).find(Boolean);
      const id = number && Number(number[1]);
      if (!Number.isSafeInteger(id) || id < 1 || seen.has(id) || card.querySelector('.search-snapshot-question-missing')) return;
      seen.add(id); result.push({ id: id, host: host, card: card, snapshot: key(node) });
    });
    return result;
  }
  function capture() { const node = latest(); return node ? { node: node, key: key(node), ids: entries().map(function (entry) { return entry.id; }) } : null; }
  function same(snapshot) {
    const current = capture();
    return Boolean(snapshot && current && snapshot.node === current.node && snapshot.key === current.key && snapshot.ids.join(',') === current.ids.join(','));
  }
  function row(question, order, requestedPaper) {
    if (!question || !Number.isSafeInteger(question.id) || ['math1', 'math2', 'math3'].indexOf(question.subject) < 0) throw new Error('网站题目身份或科目无效');
    const papers = (Array.isArray(question.papers) ? question.papers : []).filter(function (paper) { return Number.isSafeInteger(paper.id) && paper.id > 0 && typeof paper.title === 'string' && paper.title.trim(); });
    const source = papers.find(function (paper) { return paper.id === requestedPaper; }) || papers[0];
    if (requestedPaper > 0 && (!source || source.id !== requestedPaper)) throw new Error('网站题目不属于当前试卷，请刷新后重试');
    const paper = source ? { id: source.id, title: source.title, subject: question.subject, kind: source.kind, year: source.year || null } : { id: 0, title: String(question.source || '').trim() || '单题收集', subject: question.subject };
    const number = source && String(source.question_number || '').trim() || String(question.id);
    return { sourcePaper: paper, question: question, question_number: number, display_order: order,
      section_title: { choice: '一、选择题', blank: '二、填空题', solution: '三、解答题' }[question.question_type] || '' };
  }
  window.__JFJC_SELECTION__ = { searchPage: searchPage, basketPage: basketPage, entries: entries, capture: capture, same: same, row: row };
})();
