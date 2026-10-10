var __JFJC_IMPORT__ = (function () {
  const N = __JFJC_NATIVE__;
  function index(context) {
    const result = {};
    N.all(context.notebook).forEach(function (note) {
      N.comments(note).forEach(function (text) {
        const match = /<!-- JFJC_QUESTION:(\d+:\d+) -->/.exec(text);
        if (match && !result[match[1]]) result[match[1]] = note;
      });
    });
    return result;
  }
  function answerStatus(note, key) {
    const answer = note && N.children(note).find(function (child) { return N.has(child, 'ANSWER:' + key); });
    return { note: answer, answer: answer && N.has(answer, 'PART:answer'), explanation: answer && N.has(answer, 'PART:explanation') };
  }
  function hash(text) { let n = 2166136261; for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619); return (n >>> 0).toString(16); }
  function pathFor(context, paper, entry, created) {
    const descriptors = [
      { title: 'Jifengjincao Bridge', marker: 'ROOT:1' },
      { title: __JFJC_ADAPTER__.subjects[paper.subject], marker: 'SUBJECT:' + paper.subject },
      { title: paper.title, marker: 'PAPER:' + paper.id },
      { title: entry.section, marker: 'SECTION:' + paper.id + ':' + hash(entry.section), order: entry.sectionOrder }
    ];
    let parent = null;
    descriptors.forEach(function (d) {
      const candidates = parent ? N.children(parent) : N.all(context.notebook);
      let note = candidates.find(function (item) { return N.has(item, d.marker); });
      if (!note) {
        note = N.create(d.title, context); created.push(note);
        N.append(note, __JFJC_FORMAT__.marker(d.marker));
        if (parent) {
          let before = null;
          if (d.order !== undefined) {
            N.append(note, __JFJC_FORMAT__.marker('SECTIONORDER:' + d.order));
            before = N.children(parent).find(function (child) {
              const match = /<!-- JFJC_SECTIONORDER:([-\d.]+) -->/.exec(N.comments(child).join('\n'));
              return match && Number(match[1]) > d.order;
            });
          }
          N.add(parent, note, before);
        }
      }
      parent = N.raw(note);
    });
    return N.wrap(parent);
  }
  function attach(parent, note, entry) {
    const before = N.children(parent).find(function (child) {
      const body = N.comments(child).join('\n');
      const order = /<!-- JFJC_ORDER:([-\d.]+) -->/.exec(body);
      return /<!-- JFJC_QUESTION:/.test(body) && order && Number(order[1]) > entry.order;
    });
    N.add(parent, note, before);
  }
  function write(context, paper, entry, prepared, existing, withAnswer) {
    const key = __JFJC_ADAPTER__.key(paper.id, entry.id), created = [];
    let note = existing, added = false, newQuestion = false;
    try {
      if (!note) {
        const parent = pathFor(context, paper, entry, created);
        note = N.create(__JFJC_FORMAT__.questionTitle(entry, paper), context); created.push(note);
        N.append(note, prepared.question);
        if (prepared.sourceLink) N.append(note, prepared.sourceLink);
        attach(parent, note, entry); newQuestion = true;
      }
      let status = answerStatus(note, key);
      if (withAnswer && ((!status.answer && prepared.answerPart) || (!status.explanation && prepared.explanationPart))) {
        let answer = status.note;
        if (!answer) {
          answer = N.create('答案与解析', context); created.push(answer);
          N.add(note, answer);
          // 折叠题卡分支，让答案子卡可在需要时展开。
          const raw = N.raw(note); raw.mindmapBranchClose = 1;
        }
        // 身份标记随首条可用正文保存，避免单独的注释评论被 MN 显示出来。
        function appendPart(text) {
          const identity = N.has(answer, 'ANSWER:' + key) ? '' : '\n\n' + __JFJC_FORMAT__.marker('ANSWER:' + key);
          N.append(answer, text + identity); added = true;
        }
        if (!status.answer && prepared.answerPart) appendPart(prepared.answerPart);
        if (!status.explanation && prepared.explanationPart) appendPart(prepared.explanationPart);
        status = answerStatus(note, key);
      }
      return { note: N.raw(note), created: newQuestion, answerAdded: added,
        missing: withAnswer && (!status.answer || !status.explanation) ? '网站暂无完整答案或解析，已保存可用内容' : '' };
    } catch (error) {
      // 新建题卡失败时清理本次节点；已有题卡补答案失败保留已成功补充部分。
      if (!existing) {
        created.slice().reverse().forEach(function (item) {
          const id = N.noteId(item), live = id && MNUtil.getNoteById(id);
          if (live) context.database.deleteBookNoteTree(id);
        });
      } else {
        created.slice().reverse().forEach(function (item) {
          const live = MNUtil.getNoteById(N.noteId(item));
          if (live && !N.has(live, 'PART:answer') && !N.has(live, 'PART:explanation')) context.database.deleteBookNoteTree(N.noteId(item));
        });
      }
      throw error;
    }
  }
  function reportText(result, total, processed) {
    const final = result.cancelled ? '已停止' : result.error ? '导入中断' : result.failed.length ? '导入结束' : '导入完成';
    return (processed === total ? final : '正在导入 ' + processed + '/' + total) + '：新建 ' + result.created + '，跳过 ' + result.skipped + '，补答案解析 ' + result.answerAdded + '，未完成 ' + result.failed.length;
  }
  async function run(controller, session) {
    const T = __JFJC_TRANSPORT__;
    if (session.running) throw new Error('当前任务仍在导入');
    session.running = true;
    let result = { created: 0, skipped: 0, answerAdded: 0, failed: [], cancelled: false }, processed = 0, entries = [], record;
    try {
      T.guard(controller, session);
      const request = await T.begin(controller, session);
      if (request.content !== 'question' && request.content !== 'questionAnswer') throw new Error('导入内容选项无效');
      const model = __JFJC_ADAPTER__.normalize(request.envelope);
      entries = __JFJC_ADAPTER__.selection(model, request.ids);
      const withAnswer = request.content === 'questionAnswer';
      // 设置由原生在打开导入框时捕获；旧调用也只在任务开始读取一次。
      const includeTopics = typeof session.includeTopics === 'boolean' ? session.includeTopics : __JFJC_SETTINGS__.importTopics();
      session.includeTopics = includeTopics;
      session.content = request.content;
      N.savePreference('content', request.content);
      record = { id: session.token, notebookId: session.context.notebookId, paperId: model.paper.id,
        title: model.paper.title, ids: request.ids, content: request.content, includeTopics: includeTopics,
        state: 'running', startedAt: new Date().toISOString(), result: result };
      __JFJC_STORE__.task(record);
      const imported = index(session.context);
      for (const entry of entries) {
        T.guard(controller, session);
        const key = __JFJC_ADAPTER__.key(model.paper.id, entry.id);
        let existing = imported[key] && MNUtil.getNoteById(N.noteId(imported[key]));
        if (existing && !N.has(existing, 'QUESTION:' + key)) existing = null;
        const status = answerStatus(existing, key);
        if (existing && (!withAnswer || (status.answer && status.explanation))) result.skipped++;
        else {
          try {
            await T.feedback(controller, session, '正在准备第 ' + entry.number + ' 题…');
            const media = await T.media(controller, session, entry.id, !existing, withAnswer);
            if (media.questionId !== entry.id) throw new Error('网站返回了其他题目的图片');
            const prepared = __JFJC_FORMAT__.format(entry, model.paper, media, !existing, withAnswer, includeTopics);
            T.guard(controller, session);
            const fresh = index(session.context)[key];
            if (Boolean(fresh) !== Boolean(existing) || (fresh && N.noteId(fresh) !== N.noteId(existing))) throw new Error('题卡在导入中被修改，请重试本题');
            let outcome;
            N.undo(session.context, function () { outcome = write(session.context, model.paper, entry, prepared, existing, withAnswer); });
            if (!outcome) throw new Error('MN 未能执行卡片写入');
            imported[key] = outcome.note;
            if (outcome.created) result.created++; if (outcome.answerAdded) result.answerAdded++;
            if (outcome.missing) result.failed.push({ id: entry.id, number: entry.number, reason: outcome.missing });
            __JFJC_STORE__.mapping(session.context.notebookId, key, outcome.note, entry);
          } catch (error) {
            if (error.stopImport || session.cancelled || controller.session !== session) throw error;
            result.failed.push({ id: entry.id, number: entry.number, reason: String(error && error.message || error) });
          }
        }
        processed++;
        record.result = result; record.processed = processed; __JFJC_STORE__.task(record);
        await T.feedback(controller, session, reportText(result, entries.length, processed));
        await N.delay(0.02);
      }
    } catch (error) {
      result.cancelled = session.cancelled || controller.session !== session;
      result.error = String(error && error.message || error);
      entries.slice(processed).forEach(function (entry) { if (!result.failed.some(function (f) { return f.id === entry.id; })) result.failed.push({ id: entry.id, number: entry.number, reason: result.cancelled ? '导入已停止' : result.error }); });
      if (!entries.length) N.show(controller.addon, result.error);
    } finally {
      session.running = false;
      if (record) {
        record.state = result.cancelled ? 'cancelled' : result.error ? 'interrupted' : result.failed.length ? 'partial' : 'complete';
        record.result = result; record.finishedAt = new Date().toISOString();
        try { __JFJC_STORE__.task(record); } catch (error) { result.error = '题卡写入结果已保留，但导入记录未保存：' + String(error.message || error); }
      }
      controller.lastResult = result;
      const ids = result.failed.map(function (f) { return f.id; }).filter(function (id, i, a) { return a.indexOf(id) === i; });
      const text = reportText(result, entries.length, entries.length) + (result.error ? '。' + result.error : '');
      await T.feedback(controller, session, text, true, ids, result.failed.map(function (f) { return '第 ' + f.number + ' 题：' + f.reason; }));
      N.show(controller.addon, text);
    }
    return result;
  }
  return { run: run, write: write, index: index, answerStatus: answerStatus };
})();
