var __JFJC_SINGLE_IMPORT__ = (function () {
  const N = __JFJC_NATIVE__;
  function capture(addon, context, position) {
    if (position !== 'child' && position !== 'sibling') throw new Error('导入本题位置无效');
    const study = context.app.studyController(addon.window);
    const selected = N.value(study && study.notebookController, 'focusNote'), selectedId = N.noteId(selected);
    if (!selectedId || String(N.value(selected, 'notebookId') || '') !== context.notebookId) throw new Error('请先在当前学习集中选中一张卡片');
    const parentId = N.noteId(position === 'sibling' ? N.value(selected, 'parentNote') : selected);
    if (!parentId) throw new Error('所选卡片没有父节点，请改用子节点');
    function parent() {
      N.ensureContext(addon, context);
      const live = MNUtil.getNoteById(parentId);
      if (!live || String(N.value(live, 'notebookId') || '') !== context.notebookId) throw new Error('原父卡片已删除或移出学习集，请重新选择');
      if (position === 'sibling') {
        const anchor = MNUtil.getNoteById(selectedId);
        if (!anchor || N.noteId(N.value(anchor, 'parentNote')) !== parentId || !N.children(live).some(function (note) { return N.noteId(note) === selectedId; })) throw new Error('原所选卡片已删除或移动，请重新选择');
      }
      return live;
    }
    parent();
    return {
      parent: parent,
      find: function (id) {
        const matches = N.children(parent()).filter(function (note) {
          const identity = __JFJC_CARD_LOCATOR__.identity(note);
          return identity && identity.questionId === id;
        });
        if (matches.length > 1) throw new Error('目标父卡片下存在多张相同题卡，请先整理');
        return matches[0] || null;
      },
      attach: function (note) {
        const target = parent(); let before = null;
        if (position === 'sibling') {
          const siblings = N.children(target), index = siblings.findIndex(function (child) { return N.noteId(child) === selectedId; });
          before = siblings[index + 1] || null;
        }
        N.add(target, note, before);
      }
    };
  }
  return { capture: capture };
})();
