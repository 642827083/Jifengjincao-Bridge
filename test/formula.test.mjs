import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeHost, envelope } from './helpers.mjs';

test('截图中 2014 数学二选项的公式边界空白被消除，公式内容不变', () => {
  const h = nativeHost();
  const samples = [String.raw`$ \frac{\sqrt{10}}{50} $ .`, String.raw`$ y = x + \sin x $ .`, String.raw`当 $ {f}^{\prime }\left( x\right) \geq 0 $ 时, $ f\left( x\right) \geq g\left( x\right) $ .`];
  for (const input of samples) {
    const expected = input.replace(/\$ ([\s\S]*?) \$/g, (_, math) => '$' + math + '$');
    assert.equal(h.format.normalize(input), expected);
    assert.equal(h.format.normalize(expected), expected);
  }
});

test('代码、转义金额与独立公式不被行内公式转换破坏', () => {
  const h = nativeHost();
  const input = '代码 `$ x $`' + String.raw`，金额 \$20；公式 $ a + \$b $。`;
  const out = h.format.normalize(input);
  assert.ok(out.includes('`$ x $`')); assert.ok(out.includes(String.raw`\$20`));
  assert.ok(out.includes(String.raw`$a + \$b$`));
  assert.equal(h.format.normalize('$$\n x + y \n$$'), '$$\nx + y\n$$');
  const fence = '```tex\n$ x $\n$$ y $$\n```';
  assert.equal(h.format.normalize(fence), fence);
});

test('选项优先使用网站转换字段，缺少时兼容原始 options', () => {
  const h = nativeHost(), data = envelope();
  data.questions[1].question.options = { A: String.raw`$ x $`, B: String.raw`$ y $` };
  data.questions[1].question.option_text = { A: String.raw`\(x\)` };
  const model = h.adapter.normalize(data), entry = model.entries[0];
  assert.equal(entry.options.A, String.raw`\(x\)`);
  const output = h.format.format(entry, model.paper, { images: {}, inlineImages: {} }, true, false).question;
  assert.ok(output.includes('A. $x$')); assert.ok(output.includes('B. $y$'));
});

test('旧题干与答案只修复公式边界，保留媒体、评论、手写及顺序，支持撤销', () => {
  const h = nativeHost(), addon = { window: {} };
  const note = h.database.createNoteWithTitleTopicid('第 4 题', 'book-1');
  const original = String.raw`A. $ \frac{\sqrt{10}}{50} $ .` + '\n\n![图](marginnote-media://saved)\n\n<!-- JFJC_QUESTION:265:5711 -->';
  note.comments.push({ text: original }, { text: '我的笔记 $ 保持原样 $' });
  note.mediaList = 'saved'; note.strokes = '手写';
  const answer = h.database.createNoteWithTitleTopicid('答案与解析', 'book-1');
  h.native.wrap(note).addChild(answer);
  answer.comments.push({ text: '$ x $\n\n<!-- JFJC_PART:explanation -->\n\n<!-- JFJC_ANSWER:265:5711 -->' });
  assert.equal(h.context.__JFJC_SOURCE__.upgrade(addon), 2);
  assert.ok(note.comments[0].text.includes(String.raw`$\frac{\sqrt{10}}{50}$`));
  assert.ok(note.comments[0].text.includes('marginnote-media://saved'));
  assert.equal(note.comments[2].text, '我的笔记 $ 保持原样 $');
  assert.doesNotMatch(note.comments[0].text, /<!-- JFJC_/); assert.match(note.comments[1].text, /^\[查看原题\]/);
  assert.equal(note.strokes, '手写'); assert.equal(note.mediaList, 'saved');
  assert.ok(answer.comments[0].text.startsWith('$x$'));
  assert.equal(h.context.__JFJC_SOURCE__.upgrade(addon), 0);
  h.undo(); h.undo(); assert.equal(h.notes.get(note.noteId).comments[0].text, original);
});
