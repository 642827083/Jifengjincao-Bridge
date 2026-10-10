import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { browserHost, envelope, open, packet, tick, source } from './helpers.mjs';

test('整卷预览、勾选、确认和分块 JSON，保持同源凭据',async()=>{
  const h=browserHost();await open(h);
  assert.equal(h.document.querySelectorAll('input[data-id]').length,2);
  h.document.getElementById('jfjc-commit').click();
  assert.match(h.frames.at(-1),/^jifengjincaobridge:\/\/import\?token=test-task/);
  const data=await packet(h,()=>h.runtime.begin('test-task'));assert.equal(data.ids.length,2);assert.equal(data.content,'questionAnswer');
  assert.equal(h.calls[0].options.credentials,'include');assert.match(h.document.getElementById('jfjc-count').textContent,/已选 2 \/ 2 题/);
});
test('只下载本题所需图片，反馈支持失败重试',async()=>{
  const h=browserHost();await open(h);h.document.getElementById('jfjc-commit').click();
  const media=await packet(h,()=>h.runtime.prepare('test-task',5074,true,true));assert.equal(media.questionId,5074);assert.match(media.images[369],/^data:image\/png;base64,/);
  assert.equal(h.calls.filter(c=>c.url.includes('/question-assets/')).length,1);
  h.runtime.feedback('test-task',{done:true,message:'未完成 1 题',retryIds:[5074],details:['第1题：图片失败']});
  assert.equal(h.document.getElementById('jfjc-retry').hidden,false);h.document.getElementById('jfjc-retry').click();
  const retry=await packet(h,()=>h.runtime.begin('test-task'));assert.deepEqual(retry.ids,[5074]);
});
test('选题模式默认全选，清空后拒绝导入；旧单题调用仍选择当前题目',async()=>{
  const h=browserHost();await open(h,'selected');assert.equal(h.document.getElementById('jfjc-commit').disabled,false);
  assert.equal(h.document.querySelectorAll('input[data-id]:checked').length,2);
  h.document.querySelector('[data-action="select-none"]').click();assert.equal(h.document.getElementById('jfjc-commit').disabled,true);
  h.document.getElementById('jfjc-commit').click();assert.ok(!h.frames.some(f=>f.includes('://import?')));
  await open(h,'single');h.document.getElementById('jfjc-commit').click();const data=await packet(h,()=>h.runtime.begin('test-task'));assert.deepEqual(data.ids,[5074]);
});
test('登录失败、权限拒绝和访问验证均明确提示',async()=>{
  for(const [status,text]of[[401,'登录'],[403,'权限'],[428,'访问验证']]){
    const h=browserHost(envelope(),()=>new Response('{}',{status}));await open(h);assert.match(h.document.getElementById('jfjc-dialog').textContent,new RegExp(text));assert.equal(h.calls.length,1);
  }
});
test('取消与页面切换拒绝继续读取，重复注入只保留一个工具栏',async()=>{
  const h=browserHost();await open(h);h.document.getElementById('jfjc-commit').click();h.runtime.cancel();await assert.rejects(()=>packet(h,()=>h.runtime.begin('test-task')),/取消/);
  vm.runInContext(source('web/src/BBKaoyanPage.js'),h.context);assert.equal(h.document.querySelectorAll('#jfjc-toolbar').length,1);
  h.location.pathname='/papers/238';h.runtime.refresh();assert.equal(h.document.getElementById('jfjc-dialog').hidden,true);assert.equal(h.runtime.begin('test-task'),'rejected');
});
test('拒绝站外图片、资源范围外图片和越权题目',async()=>{
  const data=envelope();data.questions[1].question.assets[0].url='https://evil.test/secret';
  const h=browserHost(data);await open(h);h.document.getElementById('jfjc-commit').click();await assert.rejects(()=>packet(h,()=>h.runtime.prepare('test-task',5074,true,true)),/范围/);
  await assert.rejects(()=>packet(h,()=>h.runtime.prepare('test-task',999,true,true)),/选择/);
  assert.ok(!h.calls.some(c=>c.url.includes('evil')));
});
test('超过一块的大解析可精确恢复',async()=>{
  const data=envelope();data.questions[0].question.explanation_latex='长解析🧮'.repeat(18000);
  const h=browserHost(data);await open(h);h.document.getElementById('jfjc-commit').click();const out=await packet(h,()=>h.runtime.begin('test-task'));assert.equal(out.envelope.questions[0].question.explanation_latex,data.questions[0].question.explanation_latex);
  await tick();
});

test('停止期间保持导入按钮锁定，原生结束反馈后才允许重试',async()=>{
  const h=browserHost();await open(h);h.document.getElementById('jfjc-commit').click();h.document.querySelector('[aria-label="停止导入"]').click();
  assert.equal(h.document.getElementById('jfjc-commit').disabled,true);
  h.document.getElementById('jfjc-commit').click();assert.equal(h.frames.filter(f=>f.includes('://import?')).length,1);
  assert.equal(await h.runtime.open('all',{token:'another-task',target:'另一个学习集'}),'busy');
  h.runtime.feedback('test-task',{done:true,message:'已停止',retryIds:[5074]});
  h.document.getElementById('jfjc-retry').click();
  const data=await packet(h,()=>h.runtime.begin('test-task'));assert.deepEqual(data.ids,[5074]);
});

test('连续打开预览时旧请求迟到，不覆盖最新题目和任务',async()=>{
  let resolveOld,count=0;const latest=envelope();latest.paper.title='最新预览';
  const h=browserHost(latest,()=>{if(++count===1)return new Promise(resolve=>{resolveOld=resolve;});});
  const first=h.runtime.open('all',{token:'old-task',target:'我的学习集'});await tick();
  await h.runtime.open('single',{token:'test-task',target:'我的学习集'});
  resolveOld(new Response(JSON.stringify(envelope()),{headers:{'Content-Type':'application/json'}}));await first;
  assert.match(h.document.getElementById('jfjc-dialog').textContent,/最新预览/);
  h.document.getElementById('jfjc-commit').click();
  const data=await packet(h,()=>h.runtime.begin('test-task'));assert.deepEqual(data.ids,[5074]);assert.equal(data.envelope.paper.title,'最新预览');
});

test('原题锚点等待异步题目出现后定位一次，后续渲染不打断阅读',async()=>{
  const h=browserHost();h.location.hash='#question-5075';h.runtime.refresh();
  const card=h.document.createElement('article');card.id='question-5075';let scrolled=0;card.scrollIntoView=options=>{assert.equal(options.block,'start');scrolled++;};
  h.document.body.appendChild(card);await new Promise(resolve=>setTimeout(resolve,80));
  assert.equal(scrolled,1);h.runtime.refresh();h.document.body.appendChild(h.document.createElement('div'));await new Promise(resolve=>setTimeout(resolve,80));assert.equal(scrolled,1);
  h.location.pathname='/papers/238';h.runtime.refresh();assert.equal(scrolled,2);
});
