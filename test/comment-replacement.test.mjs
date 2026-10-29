import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeHost } from './helpers.mjs';

test('按旧索引到新位置排序时，手动修复仍保持题干第一条、原题唯一且居第二条', () => {
  const h = nativeHost(), note = h.database.createNoteWithTitleTopicid('题目', 'book-1');
  const link = '[查看原题](' + h.context.__JFJC_SOURCE__.link(237, 5074) + ')';
  note.comments.push({ text: '题干\n\n<!-- JFJC_QUESTION:237:5074 -->\n\n<!-- JFJC_ORDER:1 -->' },
    { text: link + '\n\n<!-- JFJC_SOURCE:237:5074 -->' });
  note.sortCommentsByNewIndices = destinations => {
    const before = note.comments.slice(), sorted = [];
    destinations.forEach((newIndex, oldIndex) => { sorted[newIndex] = before[oldIndex]; });
    note.comments = sorted;
  };
  let failure;
  try { h.repair({ window: {} }); } catch (error) { failure = error; }
  const links = note.comments.filter(comment => comment.text.startsWith('[查看原题]('));
  assert.equal(links.length, 1, JSON.stringify({ error: failure?.message, comments: note.comments.map(comment => comment.text) }));
  assert.ifError(failure); assert.equal(note.comments[0].text, '题干');
  assert.equal(note.comments[1].text, link + '\n\n<!-- JFJC_QUESTION:237:5074 -->');
  assert.equal(h.repair({ window: {} }), 0);
});

test('上次修复已留下链接在顶部及旧链接的三条评论时，重新手动修复能恢复唯一入口', () => {
  const h = nativeHost(), note = h.database.createNoteWithTitleTopicid('题目', 'book-1');
  const link = '[查看原题](' + h.context.__JFJC_SOURCE__.link(237, 5074) + ')';
  note.comments = [{ text: link + '\n\n<!-- JFJC_QUESTION:237:5074 -->' },
    { text: link + '\n\n<!-- JFJC_SOURCE:237:5074 -->' }, { text: '题干 $x^2$' }];
  assert.equal(h.repair({ window: {} }), 1);
  assert.deepEqual(note.comments.map(comment => comment.text), ['题干 $x^2$', link + '\n\n<!-- JFJC_QUESTION:237:5074 -->']);
  assert.equal(h.repair({ window: {} }), 0);
});

test('替换中间评论且保留个人文字和手写对象，排序方向不能被对称排列掩盖', () => {
  const h = nativeHost(), note = h.database.createNoteWithTitleTopicid('题目', 'book-1');
  const personal = { text: '个人笔记' }, paint = { type: 'PaintNote', paint: '原手写' };
  note.comments = [personal, { text: '旧正文' }, paint, { text: '末尾批注' }];
  h.native.replaceMarkdownParts(note, 1, '旧正文', ['新题干', '原题链接']);
  assert.deepEqual(note.comments.map(comment => comment.text), ['个人笔记', '新题干', '原题链接', undefined, '末尾批注']);
  assert.equal(note.comments[0], personal); assert.equal(note.comments[3], paint);
});
