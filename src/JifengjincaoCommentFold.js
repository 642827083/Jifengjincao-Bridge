var __JFJC_COMMENT_FOLD__ = (function () {
  const N = __JFJC_NATIVE__, KEY = 'card-tools.fold-source-comment';
  function enabled() { return N.preference(KEY, false) === true; }
  function setEnabled(on) { N.savePreference(KEY, Boolean(on)); }
  function failure(message, code) { const error = new Error(message); error.code = code || 'COMMENT_FOLD_FAILED'; return error; }
  function checked(reply) {
    if (!reply || reply.ok !== true || reply.error) {
      const error = reply && reply.error;
      throw failure(error && (error.message || error.code) || '评论接口未返回有效结果', error && error.code);
    }
    return reply;
  }
  function sources(comments) {
    return comments.filter(function (comment) {
      const text = String(N.value(comment, 'text') || ''), match = /^\[查看原题\]\(marginnote4app:\/\/addon\/(jifengjincao-bridge\?action=open&paper=\d+&question=\d+)\)/.exec(text.trim());
      const target = match && __JFJC_SOURCE__.parse(match[1]);
      if (!target) return false;
      const key = target.paperId + ':' + target.questionId, tag = '<!-- JFJC_SOURCE:' + key + ' -->', identity = '<!-- JFJC_QUESTION:' + key + ' -->';
      // 新卡用题目身份确认归属，旧卡仍兼容仅有来源标记的独立入口。
      if (!text.includes(identity) && !text.includes(tag)) return false;
      const tags = text.match(/<!-- JFJC_(?:QUESTION:\d+:\d+|SOURCE:\d+:\d+|ORDER:[-\d.]+) -->/g) || [];
      return tags.every(function (value) { return value === tag || value === identity || /^<!-- JFJC_ORDER:[-\d.]+ -->$/.test(value) && Number.isFinite(Number(/JFJC_ORDER:([-\d.]+)/.exec(value)[1])); })
        && text.replace(/<!-- JFJC_(?:QUESTION:\d+:\d+|SOURCE:\d+:\d+|ORDER:[-\d.]+) -->/g, '').trim() === match[0];
    });
  }
  function fold(note, collapsed) {
    note = N.raw(note);
    if (typeof collapsed !== 'boolean') throw failure('评论折叠状态无效');
    if (!note) throw failure('题卡已删除');
    if (!sources(N.items(N.value(note, 'comments'))).length) return { skipped: true };
    if (typeof note.commentState !== 'function' || typeof note.setCommentsCollapsed !== 'function') throw failure('当前 MarginNote 版本不支持评论折叠，请更新后重试', 'COMMENT_FOLD_UNSUPPORTED');
    const state = checked(note.commentState()), comments = sources(N.items(state.comments));
    if (comments.length !== 1) throw failure('原题评论缺失或重复，请先整理后重试');
    if (typeof state.revision !== 'string' || !state.revision) throw failure('评论版本信息无效');
    const comment = comments[0];
    const sourceIdentity = /<!-- JFJC_(?:QUESTION|SOURCE):(\d+:\d+) -->/.exec(String(N.value(comment, 'text')))[1];
    const identities = N.items(state.comments).map(function (item) { return String(N.value(item, 'text') || ''); }).join('\n').match(/<!-- JFJC_QUESTION:\d+:\d+ -->/g) || [];
    if (identities.some(function (tag) { return tag !== '<!-- JFJC_QUESTION:' + sourceIdentity + ' -->'; })) throw failure('题卡身份冲突，原题评论未修改');
    if (comment.collapsed === collapsed) return { unchanged: true };
    // NSNull 和空字符串不作为稳定身份；旧评论采用同次读取的一起始序号。
    const identified = typeof comment.ownerNoteId === 'string' && comment.ownerNoteId.trim() && typeof comment.commentId === 'string' && comment.commentId.trim();
    const target = identified ? { ownerNoteId: comment.ownerNoteId, commentId: comment.commentId } : { index: comment.index };
    if (!identified && (!Number.isSafeInteger(target.index) || target.index < 1)) throw failure('原题评论序号无效');
    const result = checked(note.setCommentsCollapsed([target], collapsed, state.revision));
    if (result.persisted !== true) throw failure('原题评论未确认保存成功', 'COMMENT_NOT_PERSISTED');
    return { changed: true };
  }
  function automatic(note) {
    if (!enabled()) return null;
    try { fold(note, true); return null; }
    catch (error) { return { noteId: N.noteId(note), reason: String(error.message || error) }; }
  }
  async function batch(addon, collapsed, progress, active) {
    const context = N.context(addon), ids = N.all(context.notebook).filter(function (note) { return sources(N.items(N.value(note, 'comments'))).length; }).map(N.noteId);
    const result = { total: ids.length, processed: 0, changed: 0, unchanged: 0, skipped: 0, failed: [] };
    for (const id of ids) {
      try {
        if (active && !active()) throw failure('操作已停止，已完成的修改保留');
        N.ensureContext(addon, context);
      } catch (error) { result.interrupted = String(error.message || error); break; }
      const note = context.database.getNoteById(id); result.processed++;
      if (!note || String(N.value(note, 'notebookId') || '') !== context.notebookId) result.skipped++;
      else try {
        const outcome = fold(note, collapsed);
        if (outcome.changed) result.changed++; else if (outcome.unchanged) result.unchanged++; else result.skipped++;
      } catch (error) {
        result.failed.push({ noteId: id, reason: String(error.message || error) });
        if (error.code === 'COMMENT_FOLD_UNSUPPORTED') { result.interrupted = error.message; break; }
      }
      if (progress) progress(result);
      if (result.processed % 10 === 0 && result.processed < ids.length) await N.delay(0.01);
    }
    return result;
  }
  return { enabled: enabled, setEnabled: setEnabled, fold: fold, automatic: automatic, batch: batch };
})();
