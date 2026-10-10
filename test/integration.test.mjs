import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { nativeHost, browserHost, open, envelope } from './helpers.mjs';

async function connected(data=envelope(), responseFor, content='questionAnswer') {
  const native=nativeHost(), browser=browserHost(data,responseFor);await open(browser);
  browser.document.querySelector('[data-content="'+content+'"]').click();browser.document.getElementById('jfjc-commit').click();
  const addon={window:{}};
  const session={token:'test-task',context:native.native.context(addon),cancelled:false,running:false};
  const controller={addon,session,webView:{evaluateJavaScript(script,callback){try{callback(vm.runInContext(script,browser.context),null);}catch(error){callback(null,error);}}}};
  return {native,browser,controller,session};
}
test('网页脚本分块→原生传输→模拟建卡→持久报告，重复运行不重复建卡',async()=>{
  const h=await connected();const first=await h.native.importer.run(h.controller,h.session);
  assert.equal(first.created,2);assert.equal(first.answerAdded,2);assert.equal(first.failed.length,0);
  assert.equal(h.native.store.read().tasks.at(-1).state,'complete');
  assert.equal(Object.keys(h.native.store.read().mappings).length,2);
  h.browser.document.getElementById('jfjc-commit').click();
  const second=await h.native.importer.run(h.controller,h.session);assert.equal(second.created,0);assert.equal(second.skipped,2);
  assert.equal([...h.native.notes.values()].filter(n=>n.comments.some(c=>c.text.includes('JFJC_QUESTION:'))).length,2);
});

test('旧关闭原题配置不再生效，新卡第二条保存链接身份并正常去重补答案', async () => {
  const data = envelope();
  data.questions.forEach(row => { row.question.chapter_topics = [{ chapter_name: '第一章', topic_name: '极限' }]; });
  const h = await connected(data, undefined, 'question');
  h.session.includeSourceLink = false; h.session.includeTopics = true;
  h.native.native.savePreference('import.include-source-link', false);
  const first = await h.native.importer.run(h.controller, h.session);
  assert.equal(first.created, 2); assert.equal(first.failed.length, 0);
  const notes = [...h.native.notes.values()].filter(note => note.comments.some(comment => comment.text.includes('JFJC_QUESTION:')));
  const bodies = notes.map(note => note.comments[0].text);
  for (const note of notes) {
    const body = note.comments[0].text;
    assert.equal(note.comments.length, 2);
    assert.doesNotMatch(body, /查看原题|marginnote4app:\/\/addon/);
    assert.match(body, /知识点：第一章 \/ 极限/);
    assert.doesNotMatch(body, /<!-- JFJC_/);
    assert.match(note.comments[1].text, /^\[查看原题\]\(marginnote4app:\/\/addon\/jifengjincao-bridge/);
    assert.match(note.comments[1].text, /JFJC_QUESTION:237:507[45]/); assert.match(note.comments[1].text, /JFJC_ORDER:|JFJC_SOURCE:/);
  }
  assert.equal(h.native.store.read().tasks.at(-1).includeSourceLink, undefined);
  assert.equal(h.native.context.__JFJC_SOURCE__.upgrade(h.controller.addon), 0);
  h.browser.document.querySelector('[data-content="questionAnswer"]').click(); h.browser.document.getElementById('jfjc-commit').click();
  const second = await h.native.importer.run(h.controller, h.session);
  assert.equal(second.created, 0); assert.equal(second.answerAdded, 2); assert.equal(second.failed.length, 0);
  assert.deepEqual(notes.map(note => note.comments[0].text), bodies);
  h.browser.document.getElementById('jfjc-commit').click();
  const third = await h.native.importer.run(h.controller, h.session); assert.equal(third.skipped, 2);
  const enabled = await connected();
  await enabled.native.importer.run(enabled.controller, enabled.session);
  assert.equal(enabled.session.includeSourceLink, undefined);
  for (const note of Object.values(enabled.native.importer.index(enabled.session.context))) {
    assert.doesNotMatch(note.comments[0].text, /\[查看原题\]/);
    assert.doesNotMatch(note.comments[0].text, /<!-- JFJC_/);
    assert.match(note.comments[1].text, /\[查看原题\]\(marginnote4app:\/\/addon\/jifengjincao-bridge/);
    assert.match(note.comments[1].text, /JFJC_QUESTION:|JFJC_ORDER:|JFJC_SOURCE:/);
  }
});
test('图片失败后重试只补失败题，已有题卡和批注保留',async()=>{
  const h=await connected();h.native.flags.imageFailure=true;
  const first=await h.native.importer.run(h.controller,h.session);assert.equal(first.created,1);assert.equal(first.failed.length,1);
  assert.doesNotMatch(h.native.hud.at(-1),/导入完成/);
  const preserved=[...h.native.notes.values()].find(n=>n.comments.some(c=>c.text.includes('JFJC_QUESTION:237:5075')));preserved.comments.push({text:'保留批注'});
  h.native.flags.imageFailure=false;h.browser.document.getElementById('jfjc-retry').click();
  const retry=await h.native.importer.run(h.controller,h.session);assert.equal(retry.created,1);assert.equal(retry.failed.length,0);assert.ok(preserved.comments.some(c=>c.text==='保留批注'));
  const parent=preserved.parentNote;assert.deepEqual(parent.childNotes.map(n=>n.noteTitle),['2026 年数学一真题 · 第 1 题','2026 年数学一真题 · 第 2 题']);
});
test('撤销后即使映射存在，再次导入能重建实际缺失卡片',async()=>{
  const h=await connected();await h.native.importer.run(h.controller,h.session);h.native.undo();h.native.undo();assert.equal(h.native.notes.size,0);
  assert.equal(Object.keys(h.native.store.read().mappings).length,2);
  h.browser.document.getElementById('jfjc-commit').click();const result=await h.native.importer.run(h.controller,h.session);assert.equal(result.created,2);assert.equal(result.skipped,0);
});
test('传输分块缺失时拒绝写入题卡',async()=>{
  const h=await connected();h.browser.runtime.chunk=()=>'';const result=await h.native.importer.run(h.controller,h.session);
  assert.match(result.error,/分块不完整/);assert.equal(h.native.notes.size,0);
});
test('下载后学习集切换时停止，所有卡片仍留在捕获的学习集',async()=>{
  const h=await connected();let switched=false;
  const original=h.native.context.__JFJC_TRANSPORT__.media;
  h.native.context.__JFJC_TRANSPORT__.media=async(...args)=>{const media=await original(...args);if(!switched){switched=true;h.native.switchNotebook('book-2');}return media;};
  const result=await h.native.importer.run(h.controller,h.session);assert.match(result.error,/学习集/);assert.equal(h.native.notes.size,0);assert.equal(result.failed.length,2);
});

test('图片读取遇到登录失效、权限拒绝或验证要求，停止后续题目并保留已完成卡片',async()=>{
  for (const status of [401,403,428]) {
    const data=envelope();data.questions[0].display_order=1;data.questions[0].question_number='1';data.questions[1].display_order=2;data.questions[1].question_number='2';
    const extra=structuredClone(data.questions[0]);extra.question.id=5076;extra.question_number='3';extra.display_order=3;data.questions.push(extra);
    const h=await connected(data,url=>url.includes('/question-assets/')?new Response('{}',{status}):null);
    const result=await h.native.importer.run(h.controller,h.session);
    assert.equal(result.created,1);assert.equal(result.failed.length,2);assert.ok(result.error);
    assert.equal(h.native.store.read().tasks.at(-1).state,'interrupted');
    assert.equal(h.browser.calls.filter(c=>c.url.includes('/question-assets/')).length,1);
    assert.match(h.native.hud.at(-1),/导入中断：新建 1/);assert.doesNotMatch(h.native.hud.at(-1),/导入完成/);
  }
});

test('取消后等原生结束再重试，任务成功恢复且不会误报完成',async()=>{
  const h=await connected();let stopped=false;const media=h.native.transport.media;
  h.native.transport.media=async(...args)=>{const value=await media(...args);if(!stopped){stopped=true;h.session.cancelled=true;h.browser.runtime.cancel();}return value;};
  const first=await h.native.importer.run(h.controller,h.session);
  assert.equal(first.cancelled,true);assert.equal(first.created,0);assert.equal(first.failed.length,2);
  assert.match(h.native.hud.at(-1),/已停止/);assert.doesNotMatch(h.native.hud.at(-1),/导入完成/);
  h.browser.document.getElementById('jfjc-retry').click();h.session.cancelled=false;
  const retry=await h.native.importer.run(h.controller,h.session);assert.equal(retry.created,2);assert.equal(retry.failed.length,0);
});

test('知识点开关与来源标题贯穿真实分块导入，不修改旧题卡或重复建卡', async () => {
  for (const enabled of [true, false]) {
    const data = envelope();
    data.questions.forEach(row => { row.question.chapter_topics = [{ chapter_name: '第一章 函数与极限', topic_name: '第二节 极限' }]; });
    const original = JSON.stringify(data), h = await connected(data);
    h.session.includeTopics = enabled;
    h.native.context.__JFJC_SETTINGS__.saveTopics(!enabled);
    const first = await h.native.importer.run(h.controller, h.session);
    assert.equal(first.created, 2); assert.equal(first.failed.length, 0);
    const notes = [...h.native.notes.values()].filter(note => note.comments.some(comment => comment.text.includes('JFJC_QUESTION:')));
    for (const note of notes) {
      assert.match(note.noteTitle, /^2026 年数学一真题 · 第 [12] 题$/);
      const body = note.comments[0].text;
      assert.doesNotMatch(body, /来源：|\[查看原题\]/); assert.match(note.comments[1].text, /\[查看原题\]/);
      assert.equal(body.includes('知识点：第一章 函数与极限 / 第二节 极限'), enabled);
    }
    assert.equal(h.native.store.read().tasks.at(-1).includeTopics, enabled);
    notes[0].noteTitle = '我的自定义标题'; notes[0].comments.push({ text: '来源：我的个人笔记' }); notes[0].strokes = '我的手写';
    const preserved = JSON.stringify(notes[0].comments);
    h.session.includeTopics = !enabled; h.browser.document.getElementById('jfjc-commit').click();
    const second = await h.native.importer.run(h.controller, h.session);
    assert.equal(second.skipped, 2); assert.equal(second.created, 0);
    assert.equal(notes[0].noteTitle, '我的自定义标题'); assert.equal(notes[0].strokes, '我的手写'); assert.equal(JSON.stringify(notes[0].comments), preserved);
    assert.equal(JSON.stringify(data), original);
  }
});
