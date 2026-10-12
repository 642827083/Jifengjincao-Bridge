import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeHost, envelope } from './helpers.mjs';

function prepared(h, entry, paper, q = true, answer = true) { return h.format.format(entry, paper, { images: { 369: 'data:image/png;base64,aGVsbG8=' }, inlineImages: {} }, q, answer); }

test('题干与选项图片离线保存，第一条无注释，第二条始终为原题链接和完整身份', () => {
  for (const includeTopics of [true, false]) {
    const h = nativeHost(), model = h.adapter.normalize(envelope()), entry = model.entries[0];
    entry.options = { A: '$x$', B: '$y$', C: '$z$', D: '$w$' }; entry.topics = ['极限'];
    entry.assets.push({ id: 370, usage: 'stem', alt: '题图' }, { id: 371, usage: 'option', alt: '选项图' });
    const images = { 369: 'data:image/png;base64,aA==', 370: 'data:image/png;base64,aA==', 371: 'data:image/png;base64,aA==' };
    const output = h.format.format(entry, model.paper, { images, inlineImages: {} }, true, false, includeTopics);
    const result = h.importer.write(h.native.context({ window: {} }), model.paper, entry, output, null, false);
    const body = result.note.comments[0].text;
    assert.equal(result.note.comments.length, 2);
    for (const option of ['A. $x$', 'B. $y$', 'C. $z$', 'D. $w$']) assert.ok(body.includes(option));
    assert.equal(body.includes('知识点：极限'), includeTopics);
    assert.doesNotMatch(body, /<!-- JFJC_/);
    assert.match(body, /marginnote-media:/); assert.doesNotMatch(body, /data:image|查看原题/); assert.ok(result.note.mediaList);
    assert.equal(result.note.comments[1].text, '[查看原题](' + h.context.__JFJC_SOURCE__.link(model.paper.id, entry.id) + ')\n\n<!-- JFJC_QUESTION:237:5074 -->\n\n<!-- JFJC_ORDER:' + entry.order + ' -->\n\n<!-- JFJC_SOURCE:237:5074 -->');
    assert.ok(result.note.comments.every(comment => comment.text.replace(/<!--[\s\S]*?-->/g, '').trim()));
  }
});

test('答案身份跟随首条正文，原题链接是独立评论，缺少答案时仍可补齐', () => {
  for (const explanationOnly of [false, true]) {
    const h = nativeHost(), data = envelope();
    if (explanationOnly) data.questions[1].question.correct_answer = '';
    const m = h.adapter.normalize(data), c = h.native.context({ window: {} }), e = m.entries[0];
    const result = h.importer.write(c, m.paper, e, prepared(h, e, m.paper), null, true);
    assert.equal(result.note.comments.length, 2);
    assert.doesNotMatch(result.note.comments[0].text, /查看原题/);
    assert.doesNotMatch(result.note.comments[0].text, /<!-- JFJC_/);
    assert.equal(result.note.comments[1].text, '[查看原题](' + h.context.__JFJC_SOURCE__.link(237, 5074) + ')\n\n<!-- JFJC_QUESTION:237:5074 -->\n\n<!-- JFJC_ORDER:' + e.order + ' -->\n\n<!-- JFJC_SOURCE:237:5074 -->');
    const answer = result.note.childNotes[0], original = answer.comments[0].text;
    assert.match(original, new RegExp('### ' + (explanationOnly ? '解析' : '答案')));
    assert.match(original, /JFJC_ANSWER:237:5074/);
    assert.ok(answer.comments.every(comment => !/^\s*<!--[\s\S]*-->\s*$/.test(comment.text)));
    const complete = h.adapter.normalize(envelope()).entries[0];
    h.importer.write(c, m.paper, complete, prepared(h, complete, m.paper, false, true), result.note, true);
    assert.equal(answer.comments[0].text, original);
    assert.equal(answer.comments.length, 2);
    assert.equal(h.importer.answerStatus(result.note, '237:5074').answer, true);
    assert.equal(h.importer.answerStatus(result.note, '237:5074').explanation, true);
  }
});
test('按原卷排序，保留 LaTeX 与答案解析，把图片存为媒体', () => {
  const h=nativeHost(), model=h.adapter.normalize(envelope()), c=h.native.context({window:{}});
  assert.deepEqual(Array.from(model.entries,e=>e.id),[5074,5075]);
  const first=h.importer.write(c,model.paper,model.entries[1],prepared(h,model.entries[1],model.paper),null,true);
  const second=h.importer.write(c,model.paper,model.entries[0],prepared(h,model.entries[0],model.paper),null,true);
  assert.equal(second.created,true); assert.equal(second.missing,'');
  const parent=second.note.parentNote;
  assert.deepEqual(parent.childNotes.map(n=>n.noteTitle),['2026 年数学一真题 · 第 1 题','2026 年数学一真题 · 第 2 题']);
  assert.match(first.note.comments[0].text,/\$f\(x\)\$/);
  const answer=second.note.childNotes[0]; assert.equal(answer.noteTitle,'答案与解析');
  assert.ok(answer.mediaList); assert.ok(!answer.comments.some(c=>c.text.includes('data:image')));
});
test('补答案保留已有题干、自建评论、手写和子卡', () => {
  const h=nativeHost(), m=h.adapter.normalize(envelope()), c=h.native.context({window:{}}), e=m.entries[0];
  const first=h.importer.write(c,m.paper,e,prepared(h,e,m.paper,true,false),null,false);
  first.note.comments.push({text:'我的笔记'}); first.note.strokes='手写';
  const custom=h.database.createNoteWithTitleTopicid('我的解法','book-1');h.native.wrap(first.note).addChild(custom);
  const body=first.note.comments[0].text;
  const result=h.importer.write(c,m.paper,e,prepared(h,e,m.paper,false,true),first.note,true);
  assert.equal(result.created,false); assert.equal(result.answerAdded,true);
  assert.equal(first.note.comments[0].text,body); assert.equal(first.note.comments[2].text,'我的笔记');assert.equal(first.note.strokes,'手写');assert.ok(first.note.childNotes.includes(custom));
});
test('部分答案以后只补缺失解析，保护答案评论', () => {
  const h=nativeHost(), data=envelope();data.questions[0].question.explanation_latex='';
  const m=h.adapter.normalize(data), c=h.native.context({window:{}}), e=m.entries[1];
  const first=h.importer.write(c,m.paper,e,prepared(h,e,m.paper),null,true);
  assert.ok(first.missing);const answer=first.note.childNotes[0];answer.comments.push({text:'补充注解'});
  const complete=h.adapter.normalize(envelope()).entries[1];
  const result=h.importer.write(c,m.paper,complete,prepared(h,complete,m.paper,false,true),first.note,true);
  assert.equal(result.missing,'');assert.equal(answer.comments.filter(c=>c.text.includes('JFJC_PART:answer')).length,1);assert.ok(answer.comments.some(c=>c.text==='补充注解'));
});
test('图片转换失败清理本次新建节点，部分改写不报成功', () => {
  for(const flag of ['imageFailure','partialImageFailure']) {
    const h=nativeHost(), data=envelope();data.questions[1].question.assets.push({id:370,usage:'explanation',asset_type:'image',url:'/api/question-assets/370'});
    const m=h.adapter.normalize(data), c=h.native.context({window:{}}), e=m.entries[0];h.flags[flag]=true;
    const p=h.format.format(e,m.paper,{images:{369:'data:image/png;base64,aA==',370:'data:image/png;base64,aA=='},inlineImages:{}},true,true);
    assert.throws(()=>h.importer.write(c,m.paper,e,p,null,true),/图片未完整/);assert.equal(h.notes.size,0);
  }
});
test('公式边界转换保护代码与文本，不改推导', () => {
  const h=nativeHost();const text='说明 \\(x^2\\)。\n\\[\n\\begin{cases}x&x>0\\\\0&x\\le0\\end{cases}\n\\]\n\n```tex\n\\(保持原样\\)\n\n$$code$$\n```';
  const out=h.format.normalize(text);assert.match(out,/说明 \$x\^2\$。/);assert.match(out,/\n\n\$\$\n\\begin/);assert.match(out,/```tex\n\\\(保持原样\\\)\n\n\$\$code\$\$/);
});
test('拒绝错科目、重复 ID、越界选择和未下载图片', () => {
  const h=nativeHost(), data=envelope();data.questions[1].question.subject='math3';assert.throws(()=>h.adapter.normalize(data),/科目/);
  const duplicate=envelope();duplicate.questions[1].question.id=duplicate.questions[0].question.id;assert.throws(()=>h.adapter.normalize(duplicate),/重复/);
  const m=h.adapter.normalize(envelope());assert.throws(()=>h.adapter.selection(m,[999]),/不属于/);assert.throws(()=>h.format.format(m.entries[0],m.paper,{images:{},inlineImages:{}},true,true),/尚未下载/);
});
test('原子存储与坏文件保护', () => {
  const h=nativeHost();h.store.task({id:'t1',state:'partial'});assert.equal(h.store.read().tasks[0].id,'t1');
  h.flags.saveFailure=true;assert.throws(()=>h.store.task({id:'t2'}),/保存失败/);assert.equal(h.store.read().tasks.length,1);
  h.files.set('/documents/cn.marginnote.jifengjincao-bridge/imports.json','broken');assert.throws(()=>h.store.read(),/原文件已保留/);assert.equal(h.files.get('/documents/cn.marginnote.jifengjincao-bridge/imports.json'),'broken');
});
test('缺少 MN Utils 和异步切换学习集明确停止', () => {
  const h=nativeHost(), c=h.native.context({window:{}});h.switchNotebook('book-2');assert.throws(()=>h.native.ensureContext({window:{}},c),/学习集/);
  h.host.MNUtil=undefined;assert.throws(()=>h.native.context({window:{}}),/MN Utils/);
});
test('MN Utils 静默挂接失败必须判为失败并清理节点',()=>{
  const h=nativeHost(), m=h.adapter.normalize(envelope()), c=h.native.context({window:{}}), e=m.entries[0];h.flags.childFailure=true;
  assert.throws(()=>h.importer.write(c,m.paper,e,prepared(h,e,m.paper),null,true),/挂接/);assert.equal(h.notes.size,0);
});
test('先导入解答题再导入选择题，题卡直接放在试卷下并按原题号排列',()=>{
  const h=nativeHost(), data=envelope();data.questions[0].section_title='三、解答题';data.questions[0].display_order=22;data.questions[0].question.question_type='solution';
  const m=h.adapter.normalize(data), c=h.native.context({window:{}});
  const first=h.importer.write(c,m.paper,m.entries[1],prepared(h,m.entries[1],m.paper),null,true);
  h.importer.write(c,m.paper,m.entries[0],prepared(h,m.entries[0],m.paper),null,true);
  const paperNode = first.note.parentNote;
  assert.equal(paperNode.noteTitle, m.paper.title);
  assert.deepEqual(paperNode.childNotes.map(n=>n.noteTitle), ['2026 年数学一真题 · 第 1 题', '2026 年数学一真题 · 第 2 题']);
  assert.ok([...h.notes.values()].every(n=>!n.comments.some(c=>c.text.includes('JFJC_SECTION:'))));
});

test('旧题型分组下的题卡继续查重并保留批注，新题直接挂到原试卷', () => {
  const h = nativeHost(), m = h.adapter.normalize(envelope()), c = h.native.context({ window: {} });
  const existing = h.importer.write(c, m.paper, m.entries[0], prepared(h, m.entries[0], m.paper), null, true).note;
  const paper = existing.parentNote, section = h.database.createNoteWithTitleTopicid('一、选择题', 'book-1');
  h.native.append(section, '<!-- JFJC_SECTION:237:legacy -->'); h.native.add(paper, section); h.native.add(section, existing);
  existing.comments.push({ text: '我的解题记录' }); existing.strokes = '手写';
  const indexed = h.importer.index(c), before = h.notes.size;
  const repeat = h.importer.write(c, m.paper, m.entries[0], prepared(h, m.entries[0], m.paper), indexed['237:5074'], true);
  assert.equal(repeat.created, false); assert.equal(h.notes.size, before); assert.equal(existing.parentNote, section);
  assert.equal(existing.comments.at(-1).text, '我的解题记录'); assert.equal(existing.strokes, '手写');
  const added = h.importer.write(c, m.paper, m.entries[1], prepared(h, m.entries[1], m.paper), null, true).note;
  assert.equal(added.parentNote, paper); assert.equal(section.childNotes.length, 1);
});
