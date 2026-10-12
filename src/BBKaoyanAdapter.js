var __JFJC_ADAPTER__ = (function () {
  const SUBJECTS = { math1: '数学一', math2: '数学二', math3: '数学三' };
  const TYPES = { choice: '选择题', blank: '填空题', solution: '解答题' };
  function integer(value, label, allowZero) {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < (allowZero ? 0 : 1)) throw new Error(label + '无效');
    return n;
  }
  function text(value) { return typeof value === 'string' ? value.trim() : ''; }
  function prefer(a, b) { return text(a) || text(b); }
  function normalize(envelope) {
    if (!envelope || !envelope.paper || !Array.isArray(envelope.questions)) throw new Error('网站试卷数据格式已变化');
    const source = envelope.paper;
    const paper = { id: integer(source.id, '试卷 ID', true), title: text(source.title), subject: source.subject, year: source.year || null };
    if (!paper.title || !SUBJECTS[paper.subject]) throw new Error('试卷名称或科目缺失');
    if (!envelope.questions.length || envelope.questions.length > 500) throw new Error('请选择包含 1 至 500 道题目的试卷');
    const seen = {};
    const collection = envelope.collection === 'ai-search' || envelope.collection === 'basket';
    const entries = envelope.questions.map(function (row, index) {
      const q = row && row.question;
      const sourcePaper = collection ? row.sourcePaper : source;
      if (!sourcePaper || !q || !TYPES[q.question_type] || !SUBJECTS[sourcePaper.subject] || q.subject !== sourcePaper.subject) throw new Error('题目类型或科目与试卷不符');
      const entryPaper = { id: integer(sourcePaper.id, '来源试卷 ID', true), title: text(sourcePaper.title), subject: sourcePaper.subject, year: sourcePaper.year || null };
      if (!entryPaper.title) throw new Error('来源试卷名称缺失');
      const id = integer(q.id, '题目 ID');
      if (seen[id]) throw new Error('试卷包含重复题目 ID');
      seen[id] = true;
      const stem = prefer(q.stem_latex, q.stem);
      const assets = (Array.isArray(q.assets) ? q.assets : []).map(function (a) {
        if (!a || a.asset_type !== 'image') throw new Error('题目含暂不支持的附件');
        if (['stem', 'option', 'answer', 'explanation'].indexOf(a.usage) < 0) throw new Error('题目图片用途无法识别');
        return { id: integer(a.id, '图片 ID'), usage: a.usage, url: text(a.url), order: Number(a.sort_order) || 0, alt: text(a.alt_text) };
      }).sort(function (a, b) { return a.order - b.order || a.id - b.id; });
      if (!stem && !assets.some(function (a) { return a.usage === 'stem'; })) throw new Error('第 ' + (index + 1) + ' 题缺少题干');
      const options = {};
      'ABCD'.split('').forEach(function (key) { options[key] = prefer(q.option_text && q.option_text[key], q.options && q.options[key]); });
      const originalNumber = Number(row.question_number);
      const order = collection && Number.isFinite(originalNumber) && originalNumber > 0 ? originalNumber : Number(row.display_order);
      return { id: id, paper: collection ? entryPaper : undefined, number: text(String(row.question_number || index + 1)), order: Number.isFinite(order) ? order : index + 1,
        section: text(row.section_title) || TYPES[q.question_type], type: q.question_type, stem: stem, options: options,
        answer: prefer(q.correct_answer_latex, q.correct_answer), explanation: prefer(q.explanation_latex, q.answer_explanation),
        assets: assets, source: text(q.source), updatedAt: text(q.updated_at),
        topics: (Array.isArray(q.chapter_topics) ? q.chapter_topics : []).map(function (t) {
          return [text(t.chapter_name), text(t.topic_name)].filter(Boolean).join(' / ');
        }).filter(Boolean) };
    }).sort(function (a, b) { return a.order - b.order || a.id - b.id; });
    return { paper: paper, entries: entries };
  }
  function selection(model, ids) {
    if (!Array.isArray(ids) || !ids.length) throw new Error('请至少选择一道题');
    const wanted = {};
    ids.forEach(function (id) { id = integer(id, '题目 ID'); if (wanted[id]) throw new Error('所选题目重复'); wanted[id] = true; });
    const entries = model.entries.filter(function (entry) { return wanted[entry.id]; });
    if (entries.length !== ids.length) throw new Error('所选题目不属于当前试卷');
    return entries;
  }
  function key(paperId, questionId) { return integer(paperId, '试卷 ID', true) + ':' + integer(questionId, '题目 ID'); }
  function hasAnswer(entry) { return Boolean(entry.answer || entry.explanation || entry.assets.some(function (a) { return a.usage === 'answer' || a.usage === 'explanation'; })); }
  return { normalize: normalize, selection: selection, key: key, hasAnswer: hasAnswer, integer: integer, subjects: SUBJECTS };
})();
