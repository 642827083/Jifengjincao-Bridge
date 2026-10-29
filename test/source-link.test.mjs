import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeHost, envelope } from './helpers.mjs';

const oldBody = '题干 $x^2$\n\n![图](marginnote-media://sample)\n\n[查看原题](https://bbkaoyan.cn/papers/237#question-5074)\n\n<!-- JFJC_QUESTION:237:5074 -->';

test('临时 top 域名的受管理旧卡入口升级后在 cn 打开，正文和批注保留', () => {
  for (const paperId of [0, 237]) {
    const h = nativeHost(), links = h.context.__JFJC_SOURCE__, note = h.database.createNoteWithTitleTopicid('题卡', 'book-1');
    const path = paperId ? '/papers/' + paperId + '#question-5074' : '/questions/5074';
    const identity = '<!-- JFJC_QUESTION:' + paperId + ':5074 -->';
    note.comments.push({ text: '完整题干\n\n[查看原题](https://bbkaoyan.top' + path + ')\n\n' + identity }, { text: '我的笔记' });
    assert.equal(h.repair({ window: {} }), 1);
    assert.equal(note.comments[0].text, '完整题干'); assert.equal(note.comments[2].text, '我的笔记');
    const url = /\[查看原题\]\(([^)]+)\)/.exec(note.comments[1].text)[1];
    assert.equal(links.parse(url.replace('marginnote4app://addon/', '')).url, 'https://bbkaoyan.cn' + path);
    assert.ok(note.comments[1].text.includes(identity)); assert.equal(h.repair({ window: {} }), 0);
  }
});

test('无法确认题干、注释身份冲突或用户改过链接时不搬动评论', () => {
  const h = nativeHost(), links = h.context.__JFJC_SOURCE__;
  const identity = '<!-- JFJC_QUESTION:237:5074 -->', order = '<!-- JFJC_ORDER:1 -->', source = '<!-- JFJC_SOURCE:237:5074 -->';
  const url = '[查看原题](' + links.link(237, 5074) + ')';
  const samples = [
    [{ type: 'PaintNote', paint: '手写' }, { text: url + '\n\n' + identity + '\n\n' + order + '\n\n' + source }],
    [{ text: '题干\n\n' + identity }, { text: url + '\n\n<!-- JFJC_QUESTION:237:5075 -->\n\n' + order }],
    [{ text: oldBody }, { text: '<!-- JFJC_QUESTION:237:5075 -->' }],
    [{ text: '题干\n\n' + identity }, { text: '[查看原题](https://bbkaoyan.cn/questions/9)\n\n' + source }],
    [{ text: '题干' }, { text: url + '\n\n我的附加说明\n\n' + identity + '\n\n' + order + '\n\n' + source }],
    [{ text: '题干\n\n' + identity }, { text: url + '\n\n<!-- JFJC_SOURCE:238:5074 -->' }],
    [{ text: '题干\n\n' + identity + '\n\n' + order }, { text: url + '\n\n<!-- JFJC_ORDER:2 -->' }],
    [{ text: '题干\n\n' + identity + '\n\n<!-- JFJC_ORDER:1.2.3 -->' }],
    [{ text: '题干\n\n<!-- JFJC_QUESTION:9007199254740993:5074 -->' }]
  ];
  const notes = samples.map(comments => { const note = h.database.createNoteWithTitleTopicid('题卡', 'book-1'); note.comments.push(...comments); return note; });
  const before = notes.map(note => JSON.stringify(note.comments));
  assert.equal(h.repair({ window: {} }), 0);
  assert.deepEqual(notes.map(note => JSON.stringify(note.comments)), before);
});

test('旧题卡注释集中到第二条原题链接后，关闭链接的旧卡补入口，批注媒体子卡保留且可撤销', () => {
  for (const style of ['original', 'combined', 'metadataOnly', 'closed', 'final', 'current']) {
    const h = nativeHost(), links = h.context.__JFJC_SOURCE__, note = h.database.createNoteWithTitleTopicid('自定义标题', 'book-1');
    const body = '题干 $x^2$\n\n![图](marginnote-media://sample)\n\nA. 1\n\nB. 2\n\n知识点：极限';
    const annotations = '<!-- JFJC_QUESTION:237:5074 -->\n\n<!-- JFJC_ORDER:1 -->';
    const sourceMarker = '<!-- JFJC_SOURCE:237:5074 -->', source = '[查看原题](' + links.link(237, 5074) + ')';
    const includeLink = ['original', 'combined', 'final', 'current'].includes(style);
    const finalBody = body + '\n\n' + annotations + (includeLink ? '\n\n' + sourceMarker : '');
    const oldSource = source + '\n\n' + annotations + '\n\n' + sourceMarker;
    const finalSource = source + '\n\n<!-- JFJC_QUESTION:237:5074 -->';
    if (style === 'original') note.comments.push({ text: body + '\n\n' + annotations }, { text: source + '\n\n' + sourceMarker });
    else if (style === 'combined') note.comments.push({ text: body }, { text: source + '\n\n' + annotations + '\n\n' + sourceMarker });
    else if (style === 'metadataOnly') note.comments.push({ text: body }, { text: annotations });
    else if (style === 'current') note.comments.push({ text: body }, { text: oldSource });
    else { note.comments.push({ text: finalBody }); if (includeLink) note.comments.push({ text: source }); }
    const user = { text: '我的批注' }, paint = { type: 'PaintNote', paint: '手写' };
    note.comments.push(user, paint); note.mediaList = 'saved'; note.strokes = '我的手写';
    const child = h.database.createNoteWithTitleTopicid('我的解法', 'book-1'); h.native.add(note, child);
    const addon = { window: {} }, context = h.native.context(addon);
    const before = note.comments.map(c => c.text), migrated = 1;
    assert.equal(h.repair(addon), migrated);
    assert.equal(note.comments[0].text, body);
    const userIndex = 2;
    assert.equal(note.comments[1].text, finalSource);
    assert.equal(note.comments[userIndex], user); assert.equal(note.comments[userIndex + 1], paint);
    assert.equal(note.comments.length, userIndex + 2);
    assert.equal(note.noteTitle, '自定义标题'); assert.equal(note.mediaList, 'saved'); assert.equal(note.strokes, '我的手写'); assert.equal(note.childNotes[0], child);
    assert.equal(h.importer.index(context)['237:5074'], note);
    assert.equal(h.repair(addon), 0);
    if (migrated) { h.undo(); assert.deepEqual(h.notes.get(note.noteId).comments.map(c => c.text), before); }
  }
});

test('旧卡注释迁移失败保留身份和原文，第二步删除失败后可重试恢复', () => {
  for (const failure of ['append', 'remove']) {
    const h = nativeHost(), links = h.context.__JFJC_SOURCE__, note = h.database.createNoteWithTitleTopicid('题目', 'book-1');
    const original = '题干\n\n<!-- JFJC_QUESTION:237:5074 -->\n\n<!-- JFJC_ORDER:1 -->';
    const source = '[查看原题](' + links.link(237, 5074) + ')\n\n<!-- JFJC_QUESTION:237:5074 -->';
    const oldSource = '[查看原题](' + links.link(237, 5074) + ')';
    note.comments.push({ text: original }, { text: oldSource }, { text: '批注' });
    const wrap = h.context.MNNote.new;
    h.context.MNNote.new = raw => {
      const wrapped = wrap(raw), append = wrapped.appendMarkdownComment, remove = wrapped.removeCommentByIndex;
      wrapped.appendMarkdownComment = text => { if (failure === 'append' && text.startsWith('[查看原题](')) throw new Error('模拟保存失败'); append(text); };
      wrapped.removeCommentByIndex = index => { if (failure === 'remove' && index === 2) return; remove(index); };
      return wrapped;
    };
    assert.throws(() => h.repair({ window: {} }), /保存失败|未能替换/);
    assert.ok(note.comments[0].text.startsWith('题干')); assert.equal(note.comments.at(-1).text, '批注');
    if (failure === 'append') assert.deepEqual(note.comments.map(c => c.text), [original, oldSource, '批注']);
    assert.equal(h.importer.index(h.native.context({ window: {} }))['237:5074'], note);
    h.context.MNNote.new = wrap;
    assert.equal(h.repair({ window: {} }), 1); assert.equal(note.comments[0].text, '题干');
    assert.equal(note.comments.length, 3); assert.equal(note.comments[1].text, source);
    assert.match(note.comments[1].text, /JFJC_QUESTION:237:5074/); assert.doesNotMatch(note.comments[1].text, /JFJC_ORDER:|JFJC_SOURCE:/);
    assert.equal(h.repair({ window: {} }), 0);
  }
});

test('新题卡原题链接使用 MN 插件入口，按试卷或单题定位', () => {
  const h = nativeHost(), model = h.adapter.normalize(envelope()), links = h.context.__JFJC_SOURCE__;
  const text = h.format.format(model.entries[1], model.paper, {}, true, false).sourceLink;
  const url = /\[查看原题\]\(([^)]+)\)/.exec(text)[1];
  assert.match(url, /^marginnote4app:\/\/addon\/jifengjincao-bridge\?action=open&paper=237&question=5075$/);
  assert.equal(links.parse(url.replace('marginnote4app://addon/', '')).url, 'https://bbkaoyan.cn/papers/237#question-5075');
  assert.equal(links.parse(links.link(0, 5074).replace('marginnote4app://addon/', '')).url, 'https://bbkaoyan.cn/questions/5074');
  for (const message of ['other?action=open&paper=237&question=5074', 'jifengjincao-bridge?action=delete&paper=237&question=5074', 'jifengjincao-bridge?action=open&paper=237&question=0', 'jifengjincao-bridge?action=open&paper=237&question=9007199254740992', 'jifengjincao-bridge?action=open&paper=237&question=5074&url=https://evil.test']) assert.equal(links.parse(message), null);
});

test('旧卡片原题链接拆分为独立评论，其他评论顺序、手写、媒体、子卡保留且可撤销', () => {
  const h = nativeHost(), links = h.context.__JFJC_SOURCE__, addon = { window: {} };
  const note = h.database.createNoteWithTitleTopicid('我的题卡标题', 'book-1');
  const paint = { type: 'PaintNote', paint: 'my-media' }, user = { text: '我的批注 [查看原题](https://bbkaoyan.cn/questions/9)' };
  note.comments.push(user, { type: 'TextNote', markdown: true, text: oldBody }, paint); note.strokes = '手写'; note.mediaList = 'local-media';
  const child = h.database.createNoteWithTitleTopicid('我的解法', 'book-1'); h.native.wrap(note).addChild(child);
  const external = h.database.createNoteWithTitleTopicid('普通链接', 'book-1'); external.comments.push({ text: oldBody.replace('<!-- JFJC_QUESTION:237:5074 -->', '') });
  assert.equal(h.repair(addon), 1);
  assert.equal(note.comments[1].text, '题干 $x^2$\n\n![图](marginnote-media://sample)');
  assert.equal(note.comments[2].text, '[查看原题](' + links.link(237, 5074) + ')\n\n<!-- JFJC_QUESTION:237:5074 -->');
  assert.equal(note.comments[0], user); assert.equal(note.comments[3], paint);
  assert.equal(note.noteTitle, '我的题卡标题'); assert.equal(note.mediaList, 'local-media'); assert.equal(note.strokes, '手写'); assert.equal(note.childNotes[0], child);
  assert.match(external.comments[0].text, /https:\/\/bbkaoyan/);
  assert.equal(h.repair(addon), 0); assert.equal(h.snapshots.length, 1);
  h.undo(); assert.equal(h.database.getNoteById(note.noteId).comments[1].text, oldBody);
});

test('旧链接替换接口缺失、正文变化和静默删除失败时保留原评论', () => {
  const h = nativeHost(), note = h.database.createNoteWithTitleTopicid('题卡', 'book-1'); note.comments.push({ text: oldBody }, { text: '批注' });
  const updated = oldBody.replace('https://bbkaoyan.cn/papers/237#question-5074', h.context.__JFJC_SOURCE__.link(237, 5074));
  const sort = note.sortCommentsByNewIndices; delete note.sortCommentsByNewIndices;
  assert.throws(() => h.native.replaceMarkdown(note, 0, oldBody, updated), /接口/); assert.equal(note.comments.length, 2);
  note.sortCommentsByNewIndices = sort;
  assert.throws(() => h.native.replaceMarkdown(note, 0, '其他正文', updated), /变化/);
  const wrap = h.context.MNNote.new;
  h.context.MNNote.new = raw => { const wrapped = wrap(raw), remove = wrapped.removeCommentByIndex; wrapped.removeCommentByIndex = index => { if (index !== 0) remove(index); }; return wrapped; };
  assert.throws(() => h.native.replaceMarkdown(note, 0, oldBody, updated), /未能替换/);
  assert.deepEqual(note.comments.map(c => c.text), [oldBody, '批注']);
});

test('原题通知只打开当前窗口，并忽略其他插件或非法消息', () => {
  const h = nativeHost(), links = h.context.__JFJC_SOURCE__, active = {}, other = {}, opened = [];
  h.context.MNUtil.currentWindow = active;
  h.context.__JFJC_PANEL__ = { create(addon) { return { addon }; }, openSource(controller, target) { opened.push({ controller, target }); } };
  const addon = { window: active }, sender = { userInfo: { message: 'jifengjincao-bridge?action=open&paper=237&question=5074' } };
  assert.equal(links.receive({ window: other }, sender), false); assert.equal(opened.length, 0);
  assert.equal(links.receive(addon, sender), true); assert.equal(opened.length, 1); assert.equal(opened[0].controller, addon.panelController);
  assert.equal(opened[0].target.url, 'https://bbkaoyan.cn/papers/237#question-5074');
  assert.equal(links.receive(addon, { userInfo: { message: 'other?command=open' } }), false);
});

test('旧答案纯标记并入答案末尾，只有解析时并入解析，批注保留且可撤销', () => {
  for (const part of ['answer', 'explanation']) {
    const h = nativeHost(), parent = h.database.createNoteWithTitleTopicid('题目', 'book-1');
    parent.comments.push({ text: '题干' }, { text: '[查看原题](' + h.context.__JFJC_SOURCE__.link(237, 5074) + ')\n\n<!-- JFJC_QUESTION:237:5074 -->' });
    const answer = h.database.createNoteWithTitleTopicid('答案与解析', 'book-1'); h.native.add(parent, answer);
    const identity = '<!-- JFJC_ANSWER:237:5074 -->', original = '### ' + (part === 'answer' ? '答案\n\nB' : '解析\n\n推导') + '\n\n<!-- JFJC_PART:' + part + ' -->';
    const user = { text: '我的笔记' }, paint = { type: 'PaintNote', paint: '手写' };
    answer.comments.push({ text: identity }, { text: original }, user, paint); answer.mediaList = 'local-image';
    const links = h.context.__JFJC_SOURCE__;
    assert.equal(h.repair({ window: {} }), 1);
    assert.equal(answer.comments.length, 3); assert.equal(answer.comments[0].text, original + '\n\n' + identity);
    assert.equal(answer.comments[1], user); assert.equal(answer.comments[2], paint); assert.equal(answer.mediaList, 'local-image');
    assert.equal(h.importer.answerStatus(parent, '237:5074').note, answer);
    assert.equal(h.repair({ window: {} }), 0);
    h.undo(); assert.deepEqual(h.database.getNoteById(answer.noteId).comments.map(c => c.text), [identity, original, '我的笔记', undefined]);
  }
});

test('只有注释或自行修改的答案身份不迁移，自改原题链接不拆分', () => {
  const h = nativeHost(), parent = h.database.createNoteWithTitleTopicid('题目', 'book-1');
  const body = oldBody.replace('question-5074', 'question-9'); parent.comments.push({ text: body });
  for (const text of ['<!-- JFJC_ANSWER:237:5074 -->', '我的说明 <!-- JFJC_ANSWER:237:5074 -->']) {
    const child = h.database.createNoteWithTitleTopicid('答案与解析', 'book-1'); h.native.add(parent, child); child.comments.push({ text });
  }
  assert.equal(h.repair({ window: {} }), 0);
  assert.equal(parent.comments[0].text, body);
});

test('拆分追加失败或旧评论未删除时不丢失原文、不残留新链接', () => {
  for (const failure of ['append', 'remove']) {
    const h = nativeHost(), note = h.database.createNoteWithTitleTopicid('题目', 'book-1'), user = { text: '批注' };
    note.comments.push({ text: oldBody }, user);
    const wrap = h.context.MNNote.new;
    h.context.MNNote.new = raw => {
      const wrapped = wrap(raw), append = wrapped.appendMarkdownComment, remove = wrapped.removeCommentByIndex;
      wrapped.appendMarkdownComment = text => { if (failure === 'append' && text.startsWith('[查看原题](')) throw new Error('模拟保存失败'); append(text); };
      wrapped.removeCommentByIndex = index => { if (failure === 'remove' && index === 0) return; remove(index); };
      return wrapped;
    };
    assert.throws(() => h.repair({ window: {} }), /保存失败|未能替换/);
    assert.deepEqual(note.comments.map(c => c.text), [oldBody, '批注']); assert.equal(note.comments[1], user);
  }
});

test('通知监听只注册一次，断开后释放，优先 MN Utils 并支持原生接口', () => {
  for (const mode of ['utils', 'native']) {
    const h = nativeHost(), links = h.context.__JFJC_SOURCE__, calls = [], addon = {};
    const add = (...args) => calls.push(['add', ...args]), remove = (...args) => calls.push(['remove', ...args]);
    h.context.NSNotificationCenter = { defaultCenter: () => ({ addObserverSelectorName: add, removeObserverName: remove }) };
    if (mode === 'utils') { h.context.MNUtil.addObserver = add; h.context.MNUtil.removeObserver = remove; }
    links.register(addon); links.register(addon); assert.equal(calls.length, 1); assert.equal(calls[0][2], 'onSourceLink:'); assert.equal(calls[0][3], 'AddonBroadcast');
    links.unregister(addon); assert.equal(calls.length, 2); assert.equal(calls[1][2], 'AddonBroadcast'); assert.equal(addon.sourceLinkObserver, null);
  }
});


test('问 AI 从试卷与单题卡进入该题自带 AI 的详情页，原题入口保持不变', () => {
  const h = nativeHost(), links = h.context.__JFJC_SOURCE__, active = {}, opened = [];
  h.context.MNUtil.currentWindow = active;
  h.context.__JFJC_PANEL__ = { create(addon) { return { addon }; }, openSource(controller, target) { opened.push(target); } };
  for (const paper of [0, 237]) {
    const message = 'jifengjincao-bridge?action=ask-ai&paper=' + paper + '&question=5074';
    assert.equal(links.parse(message).url, 'https://bbkaoyan.cn/questions/5074');
    assert.equal(links.parse(message).askAi, true);
    assert.equal(links.receive({ window: {} }, { userInfo: { message } }), false);
    assert.equal(links.receive({ window: active }, { userInfo: { message } }), true);
    assert.equal(opened.at(-1).questionId, 5074);
    assert.equal(links.parse(message + '&prompt=hello'), null);
  }
  assert.equal(links.parse('jifengjincao-bridge?action=ask-ai&paper=0&question=0'), null);
});
