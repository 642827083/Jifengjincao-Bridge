var __JFJC_NATIVE__ = (function () {
  function value(object, key) { const v = object && object[key]; return typeof v === 'function' ? v.call(object) : v; }
  function items(list) {
    if (!list) return []; if (Array.isArray(list)) return list.slice();
    if (typeof list.count === 'function' && typeof list.objectAtIndex === 'function') {
      const result = []; for (let i = 0; i < list.count(); i++) result.push(list.objectAtIndex(i)); return result;
    }
    return [];
  }
  function requireUtils() {
    if (typeof MNUtil === 'undefined' || typeof MNNote === 'undefined' || typeof MNNote.new !== 'function' || typeof MNUtil.undoGrouping !== 'function' || typeof MNUtil.getNoteById !== 'function') {
      throw new Error('请先安装并启用 MN Utils，再使用 Jifengjincao Bridge');
    }
  }
  function raw(note) { return note && note.note || note; }
  function wrap(note) {
    requireUtils(); const result = MNNote.new(raw(note));
    if (!result) throw new Error('卡片已失效或被删除'); return result;
  }
  function noteId(note) { return String(value(raw(note), 'noteId') || ''); }
  function comments(note) { return items(value(raw(note), 'comments')).map(function (comment) { return String(value(comment, 'text') || ''); }); }
  function has(note, marker) { return comments(note).some(function (text) { return text.indexOf('<!-- JFJC_' + marker + ' -->') >= 0; }); }
  function children(note) { return items(value(raw(note), 'childNotes')); }
  function all(notebook) {
    const result = [], queue = items(value(notebook, 'notes') || value(notebook, 'childNotes')), seen = {};
    while (queue.length) {
      const note = queue.shift(), id = noteId(note);
      if (!id || seen[id]) continue; seen[id] = true;
      const live = MNUtil.getNoteById(id); if (!live) continue;
      result.push(live); children(live).forEach(function (child) { queue.push(child); });
    }
    return result;
  }
  function context(addon) {
    requireUtils();
    const app = Application.sharedInstance(), study = app.studyController(addon.window);
    const id = String(value(study && study.notebookController, 'notebookId') || '');
    const database = Database.sharedInstance(), notebook = id && database.getNotebookById(id);
    const topicId = notebook && String(value(notebook, 'topicId') || id);
    if (!notebook || !topicId) throw new Error('请先打开要导入题目的 MarginNote 学习集');
    if (typeof database.createNoteWithTitleTopicid !== 'function' || typeof database.deleteBookNoteTree !== 'function') throw new Error('当前 MN 版本缺少卡片创建或异常清理接口');
    return { app: app, database: database, notebook: notebook, notebookId: id, topicId: topicId,
      title: String(value(notebook, 'title') || value(notebook, 'name') || '当前学习集') };
  }
  function ensureContext(addon, captured) {
    const current = context(addon);
    if (current.notebookId !== captured.notebookId || current.topicId !== captured.topicId) throw new Error('学习集已切换，本次导入已停止');
    return current;
  }
  function create(title, context) {
    const note = context.database.createNoteWithTitleTopicid(title, context.topicId);
    if (!note) throw new Error('MN 未能创建卡片');
    try { return wrap(note); }
    catch (error) { context.database.deleteBookNoteTree(noteId(note)); throw error; }
  }
  function undo(context, work) { MNUtil.undoGrouping(work, context.topicId); }
  function add(parent, child, before) {
    if (before) {
      const target = raw(parent);
      if (typeof target.insertChildBefore !== 'function') throw new Error('当前 MN 版本不支持按题号插入卡片');
      target.insertChildBefore(raw(child), raw(before));
    } else {
      const target = wrap(parent);
      if (typeof target.addChild !== 'function') throw new Error('MN Utils 缺少子卡挂接接口，请更新 MN Utils');
      target.addChild(child);
    }
    const live = MNUtil.getNoteById(noteId(child));
    if (!live || noteId(value(live, 'parentNote')) !== noteId(parent)) throw new Error('MN 未能将卡片挂接到目标父节点');
  }
  function append(note, markdown) {
    const wrapped = wrap(note);
    if (typeof wrapped.appendMarkdownComment !== 'function') throw new Error('MN Utils 缺少 Markdown 评论接口，请更新 MN Utils');
    const before = comments(note).length;
    try {
      wrapped.appendMarkdownComment(markdown);
      if (comments(note).length <= before) throw new Error('MN 没有保存卡片正文');
      if (/data:image\//.test(markdown)) {
        if (typeof wrapped.processMarkdownBase64Images !== 'function') throw new Error('MN Utils 缺少图片转存接口，请更新 MN Utils');
        wrapped.processMarkdownBase64Images();
        const appended = comments(note).slice(before);
        if (appended.some(function (text) { return /data:image\//.test(text); }) || !String(value(raw(note), 'mediaList') || '')) throw new Error('图片未完整转存，已保留为未完成题目');
      }
    } catch (error) {
      // 仅清理本次追加的评论，既有笔记、手写和已补齐内容保留。
      for (let i = comments(note).length - 1; i >= before; i--) {
        if (typeof wrapped.removeCommentByIndex !== 'function') throw new Error('评论保存失败且 MN Utils 缺少清理接口，请更新后处理本题');
        wrapped.removeCommentByIndex(i);
      }
      throw error;
    }
  }
  function replaceMarkdownParts(note, index, expected, parts) {
    const wrapped = wrap(note), target = raw(note), before = comments(note), count = before.length;
    if (before[index] !== expected) throw new Error('卡片正文已变化，评论未更新');
    if (typeof wrapped.removeCommentByIndex !== 'function' || typeof target.sortCommentsByNewIndices !== 'function') throw new Error('当前 MN 版本缺少评论替换或排序接口');
    // 先保存完整新评论，再移除旧评论；其余评论、手写和媒体均不重建。
    try {
      parts.forEach(function (text, i) {
        append(note, text);
        if (comments(note)[count + i] !== text) throw new Error('新评论没有保存');
      });
    } catch (error) {
      for (let i = comments(note).length - 1; i >= count; i--) wrapped.removeCommentByIndex(i);
      throw error;
    }
    wrapped.removeCommentByIndex(index);
    if (comments(note).length !== count - 1 + parts.length) {
      for (let i = comments(note).length - 1; i >= count; i--) wrapped.removeCommentByIndex(i);
      throw new Error('旧评论未能替换');
    }
    const indices = [];
    for (let i = 0; i < count - 1; i++) indices.push(i);
    const inserted = parts.map(function (text, i) { return count - 1 + i; });
    indices.splice.apply(indices, [index, 0].concat(inserted)); target.sortCommentsByNewIndices(indices);
    const after = before.slice(); after.splice.apply(after, [index, 1].concat(parts));
    if (comments(note).length !== after.length || after.some(function (text, i) { return comments(note)[i] !== text; })) throw new Error('评论排序未完成，新评论已保存');
  }
  function replaceMarkdown(note, index, expected, updated) { replaceMarkdownParts(note, index, expected, [updated]); }
  function delay(seconds) { return new Promise(function (resolve) { NSTimer.scheduledTimerWithTimeInterval(seconds, false, resolve); }); }
  function show(addon, text) { Application.sharedInstance().showHUD(String(text), addon.window, 3); }
  function preference(key, fallback) {
    const full = 'cn.marginnote.jifengjincao-bridge.' + key;
    const result = typeof MNUtil !== 'undefined' && typeof MNUtil.getLocalDataByKey === 'function' ? MNUtil.getLocalDataByKey(full) : NSUserDefaults.standardUserDefaults().objectForKey(full);
    return result === null || result === undefined ? fallback : result;
  }
  function savePreference(key, result) {
    const full = 'cn.marginnote.jifengjincao-bridge.' + key;
    if (typeof MNUtil !== 'undefined' && typeof MNUtil.setLocalDataByKey === 'function') MNUtil.setLocalDataByKey(result, full);
    else NSUserDefaults.standardUserDefaults().setObjectForKey(result, full);
  }
  return { value: value, items: items, raw: raw, wrap: wrap, noteId: noteId, comments: comments, has: has, children: children,
    all: all, context: context, ensureContext: ensureContext, create: create, undo: undo, add: add, append: append, delay: delay, show: show, requireUtils: requireUtils,
    preference: preference, savePreference: savePreference, replaceMarkdown: replaceMarkdown, replaceMarkdownParts: replaceMarkdownParts };
})();
