import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { nativeHost, browserHost, envelope, source, open } from './helpers.mjs';

function host(options = {}) {
  const h = nativeHost(), writes = [], create = h.database.createNoteWithTitleTopicid;
  function attach(note) {
    note.commentState = function () { return options.readError || { ok: true, revision: 'revision-' + note.noteId,
      comments: note.comments.map((comment, i) => ({ ...comment, index: i + 1,
        commentId: options.commentId === undefined ? 'comment-' + i : options.commentId, ownerNoteId: options.ownerNoteId === undefined ? note.noteId : options.ownerNoteId })) }; };
    note.setCommentsCollapsed = function (targets, collapsed, revision) {
      writes.push({ targets: structuredClone(targets), collapsed, revision });
      if (options.writeError) return options.writeError;
      assert.equal(revision, 'revision-' + note.noteId);
      const target = targets[0]; assert.notEqual('index' in target, 'commentId' in target);
      const index = 'index' in target ? target.index - 1 : Number(target.commentId.slice('comment-'.length));
      note.comments[index].collapsed = collapsed;
      return { ok: true, persisted: true };
    };
    return note;
  }
  h.database.createNoteWithTitleTopicid = (...args) => attach(create(...args));
  const fold = h.context.__JFJC_COMMENT_FOLD__;
  function card(id = 5074) {
    const note = h.database.createNoteWithTitleTopicid('题目', 'book-1');
    note.comments = [{ text: '题干', collapsed: false }, { text: '[查看原题](' + h.context.__JFJC_SOURCE__.link(237, id)
      + ')\n\n<!-- JFJC_QUESTION:237:' + id + ' -->', collapsed: false },
    { text: '个人笔记', collapsed: false }, { type: 'PaintNote', paint: '手写', collapsed: false }];
    return note;
  }
  return { ...h, fold, writes, card };
}

test('自动折叠默认关闭，保存开关且关闭不展开已有评论，原生配置回退有效', () => {
  const h = host(), note = h.card(); assert.equal(h.fold.enabled(), false);
  assert.equal(h.fold.automatic(note), null); assert.equal(h.writes.length, 0);
  h.fold.setEnabled(true); h.fold.automatic(note); assert.equal(note.comments[1].collapsed, true);
  vm.runInContext(source('src/JifengjincaoCommentFold.js'), h.context);
  assert.equal(h.context.__JFJC_COMMENT_FOLD__.enabled(), true);
  h.fold.setEnabled(false); assert.equal(note.comments[1].collapsed, true);
  delete h.context.MNUtil.getLocalDataByKey; delete h.context.MNUtil.setLocalDataByKey;
  h.fold.setEnabled(true); assert.equal(h.fold.enabled(), true);
});

test('只折叠移动后的原题评论，稳定身份与读取版本一致，可展开且不改正文笔记手写', () => {
  const h = host(), note = h.card(), original = structuredClone(note.comments);
  const metadata = note.comments.splice(1, 1)[0]; note.comments.push(metadata);
  assert.equal(h.fold.fold(note, true).changed, true);
  assert.deepEqual(h.writes[0], { targets: [{ ownerNoteId: note.noteId, commentId: 'comment-3' }], collapsed: true, revision: 'revision-' + note.noteId });
  assert.deepEqual(note.comments.slice(0, 3), [original[0], original[2], original[3]]);
  assert.equal(h.fold.fold(note, true).unchanged, true); assert.equal(h.writes.length, 1);
  assert.equal(h.fold.fold(note, false).changed, true); assert.equal(metadata.collapsed, false);
});

test('旧评论空 ID、原生 NSNull、空归属均只使用读取返回的一起始序号', () => {
  class NSNull { toJSON() { return null; } }
  for (const options of [{ commentId: null }, { commentId: new NSNull() }, { commentId: '' }, { ownerNoteId: null }, { ownerNoteId: ' ' }]) {
    const h = host(options), note = h.card(); h.fold.fold(note, true);
    assert.deepEqual(h.writes[0].targets, [{ index: 2 }]);
  }
});

test('旧版原题评论含 SOURCE 或 ORDER 仍可折叠，缺少身份及无效标记不处理', () => {
  for (const style of ['legacy', 'sourceOnly', 'missing', 'badOrder', 'conflictSource']) {
    const h = host(), note = h.card();
    if (style === 'sourceOnly' || style === 'missing') note.comments[1].text = note.comments[1].text.replace(/\n\n<!-- JFJC_QUESTION:[^>]+ -->/, '');
    if (style === 'legacy' || style === 'sourceOnly') note.comments[1].text += '\n\n<!-- JFJC_SOURCE:237:5074 -->\n\n<!-- JFJC_ORDER:1 -->';
    if (style === 'badOrder') note.comments[1].text += '\n\n<!-- JFJC_ORDER:1.2.3 -->';
    if (style === 'conflictSource') note.comments[1].text += '\n\n<!-- JFJC_SOURCE:238:5074 -->';
    const outcome = h.fold.fold(note, true);
    assert.equal(Boolean(outcome.changed), ['legacy', 'sourceOnly'].includes(style));
    assert.equal(h.writes.length, ['legacy', 'sourceOnly'].includes(style) ? 1 : 0);
  }
});

test('普通链接、自改入口、身份冲突、重复原题评论均不写入', () => {
  for (const change of ['ordinary', 'other', 'conflict', 'personal', 'duplicate']) {
    const h = host(), note = h.card();
    if (change === 'ordinary') note.comments[1].text = '[查看原题](https://example.com)';
    if (change === 'other') note.comments[1].text = note.comments[1].text.replaceAll('jifengjincao-bridge', 'daguanyuan-bridge');
    if (change === 'conflict') note.comments[1].text = note.comments[1].text.replace('QUESTION:237:5074', 'QUESTION:237:9999');
    if (change === 'personal') note.comments[1].text += '\n个人补充';
    if (change === 'duplicate') note.comments.push({ ...note.comments[1] });
    if (change === 'duplicate') assert.throws(() => h.fold.fold(note, true), /重复/);
    else assert.equal(h.fold.fold(note, true).skipped, true);
    assert.equal(h.writes.length, 0);
  }
});

test('读取错误、版本冲突、未保存和缺少接口均报告失败，不强写重试', () => {
  for (const options of [{ readError: { ok: false, error: { code: 'READ_FAILED' } } },
    { writeError: { ok: false, error: { code: 'COMMENT_CHANGED', message: '评论已变化' } } }, { writeError: { ok: true, persisted: false } }]) {
    const h = host(options), note = h.card(); assert.throws(() => h.fold.fold(note, true));
    assert.equal(note.comments[1].collapsed, false); assert.ok(h.writes.length <= 1);
  }
  const h = host(), note = h.card(); delete note.commentState;
  assert.throws(() => h.fold.fold(note, true), e => e.code === 'COMMENT_FOLD_UNSUPPORTED');
  note.comments = [{ text: '普通笔记' }]; assert.equal(h.fold.fold(note, true).skipped, true);
});

test('其他评论出现冲突身份、空版本或零序号时拒绝修改', () => {
  for (const mode of ['identity', 'revision', 'index']) {
    const h = host({ commentId: null }), note = h.card();
    const read = note.commentState;
    if (mode === 'identity') note.comments[0].text += '\n<!-- JFJC_QUESTION:237:9999 -->';
    if (mode === 'revision') note.commentState = () => ({ ...read(), revision: '' });
    if (mode === 'index') note.commentState = () => { const state = read(); state.comments[1].index = 0; return state; };
    assert.throws(() => h.fold.fold(note, true), /冲突|版本信息|序号无效/); assert.equal(h.writes.length, 0);
  }
});

test('批量折叠只处理当前学习集，切换学习集或取消时停止，已完成结果保留', async () => {
  for (const cancel of [false, true]) {
    const h = host(); for (let i = 0; i < 24; i++) h.card(5074 + i);
    const ordinary = h.database.createNoteWithTitleTopicid('个人卡片', 'book-1'); ordinary.comments = [{ text: '个人内容' }];
    let active = true;
    const result = await h.fold.batch({ window: {} }, true, progress => {
      if (progress.processed === 10) { if (cancel) active = false; else h.switchNotebook('book-2'); }
    }, () => active);
    assert.equal(result.changed, 10); assert.ok(result.interrupted); assert.equal(h.writes.length, 10);
    assert.deepEqual(ordinary.comments, [{ text: '个人内容' }]);
  }
});

test('批量展开不修改自动开关，相同状态不重复写，删除的目标跳过', async () => {
  const h = host(), first = h.card(), second = h.card(5075); first.comments[1].collapsed = true;
  const result = await h.fold.batch({ window: {} }, false, () => { h.database.deleteBookNoteTree(second.noteId); });
  assert.equal(result.changed, 1); assert.equal(result.skipped, 1); assert.equal(h.fold.enabled(), false);
  assert.equal((await h.fold.batch({ window: {} }, false)).unchanged, 1);
});

test('手动修复旧卡后按开关折叠，重复修复不重置用户展开的原题评论', () => {
  const h = host(), note = h.card(); h.fold.setEnabled(true);
  note.comments = [{ text: '题干\n\n<!-- JFJC_QUESTION:237:5074 -->\n<!-- JFJC_ORDER:1 -->' }, { text: '个人笔记' }];
  h.repair({ window: {} });
  assert.equal(note.comments[1].collapsed, true); assert.equal(note.comments[2].text, '个人笔记');
  h.fold.fold(note, false); h.repair({ window: {} });
  assert.equal(note.comments[1].collapsed, false);
});

for (const unsupported of [false, true]) test('完整导入后' + (unsupported ? '折叠失败仅警告，保留题卡与映射' : '自动折叠原题评论，重复导入不重置显示'), async () => {
  const h = host(), b = browserHost(); h.fold.setEnabled(true);
  if (unsupported) {
    const create = h.database.createNoteWithTitleTopicid;
    h.database.createNoteWithTitleTopicid = (...args) => { const note = create(...args); delete note.setCommentsCollapsed; return note; };
  }
  await open(b, 'all'); b.document.getElementById('jfjc-commit').click();
  const session = { token: 'test-task', context: h.native.context({ window: {} }), cancelled: false, running: false };
  const c = { addon: { window: {} }, session, webView: { evaluateJavaScript(script, callback) { try { callback(vm.runInContext(script, b.context), null); } catch (e) { callback(null, e); } } } };
  const result = await h.importer.run(c, session);
  assert.equal(result.created, 2); assert.equal(result.failed.length, 0); assert.equal(Object.keys(h.store.read().mappings).length, 2);
  const cards = [...h.notes.values()].filter(note => note.comments.some(comment => /JFJC_QUESTION:/.test(comment.text)));
  assert.equal(cards.length, 2);
  if (unsupported) { assert.equal(result.commentFoldWarnings.length, 2); assert.ok(h.hud.some(text => text.includes('题卡已保存'))); }
  else {
    assert.ok(cards.every(note => note.comments[1].collapsed === true && !note.comments[0].collapsed));
    h.fold.fold(cards[0], false); b.document.getElementById('jfjc-commit').click();
    const repeated = await h.importer.run(c, session); assert.equal(repeated.skipped, 2); assert.equal(cards[0].comments[1].collapsed, false);
  }
});
