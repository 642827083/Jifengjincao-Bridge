import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { browserHost, envelope, open, packet } from './helpers.mjs';
import { pageScriptSource } from '../scripts/web-bundle.mjs';

test('导入摘要仅显示公式原文，切换导入内容后完整 Markdown 和 LaTeX 不变', async () => {
  const data = envelope();
  data.questions[1].question.stem_latex = String.raw`计算 $ x^2 $、\(\frac{1}{2}\)、$$\int_0^1 x\,dx$$ 与 \[\begin{pmatrix}1&0\\0&1\end{pmatrix}\]。`;
  const before = JSON.stringify(data);
  const h = browserHost(data); await open(h);
  const excerpt = h.document.getElementById('jfjc-excerpt-5074');
  assert.equal(excerpt.textContent, data.questions[1].question.stem_latex);
  assert.equal(excerpt.children.length, 0);
  assert.equal(h.document.querySelector('[data-action="expand"]'), null);
  assert.equal(h.window.__JFJC_MATH__, undefined);
  assert.equal(h.window.__JFJC_PREVIEW__, undefined);
  h.document.querySelector('[data-content="question"]').click();
  h.document.getElementById('jfjc-commit').click();
  const request = await packet(h, () => h.runtime.begin('test-task'));
  assert.equal(request.content, 'question');
  assert.equal(JSON.stringify(request.envelope), before);
  assert.equal(JSON.stringify(data), before);
  assert.equal(h.document.querySelector('[data-content="questionAnswer"]').disabled, true);
});

test('HTML 和图片标记作为文字显示，不执行脚本、不预加载图片、不改导入原文', async () => {
  const data = envelope();
  const original = '<p onclick="evil()">题干 $x^2$<script>evil()</script><img src="/api/question-assets/369" onerror="evil()"><a href="javascript:evil()">说明</a></p>';
  data.questions[1].question.stem_latex = original;
  const h = browserHost(data); await open(h);
  const excerpt = h.document.getElementById('jfjc-excerpt-5074');
  assert.equal(excerpt.textContent, original);
  assert.equal(excerpt.children.length, 0);
  assert.equal(h.document.querySelectorAll('#jfjc-dialog img, #jfjc-dialog script').length, 0);
  assert.equal(h.calls.length, 1);
  h.document.getElementById('jfjc-commit').click();
  const request = await packet(h, () => h.runtime.begin('test-task'));
  assert.equal(request.envelope.questions[1].question.stem_latex, original);
});

test('长摘要先截断再转义，空题干提供提示，不读取或修改网站已渲染公式', async () => {
  const data = envelope();
  data.questions[1].question.stem_latex = '题'.repeat(179) + '<&>' + '长题干'.repeat(100);
  data.questions[0].question.stem = '';
  const h = browserHost(data);
  const website = h.document.getElementById('question-5074');
  website.innerHTML = '<div class="question-stem"><span class="katex">网站公式</span></div>';
  const websiteBefore = website.innerHTML;
  await open(h);
  assert.equal(h.document.getElementById('jfjc-excerpt-5074').textContent, '题'.repeat(179) + '<');
  assert.equal(h.document.getElementById('jfjc-excerpt-5075').textContent, '题干见原题');
  assert.equal(website.innerHTML, websiteBefore);
  h.document.getElementById('jfjc-commit').click();
  const request = await packet(h, () => h.runtime.begin('test-task'));
  assert.equal(request.envelope.questions[1].question.stem_latex, data.questions[1].question.stem_latex);
});

test('完整网页脚本无需公式库即可重复注入，样式和导入入口不重复', async () => {
  const h = browserHost();
  vm.runInContext(pageScriptSource(), h.context);
  await open(h);
  assert.equal(h.document.querySelectorAll('#jfjc-style').length, 1);
  assert.equal(h.document.querySelectorAll('#jfjc-toolbar').length, 1);
  assert.equal(h.document.querySelectorAll('#jfjc-dialog').length, 1);
  assert.equal(h.document.querySelectorAll('#jfjc-toolbar button').length, 1);
  assert.equal(h.document.querySelector('#jfjc-toolbar button').textContent, '选题导入');
  h.document.querySelector('#jfjc-toolbar button').click();
  assert.match(h.frames.at(-1), /:\/\/preview\?token=&scope=selected$/);
  assert.equal(h.document.querySelector('footer [data-action="close"]'), null);
  assert.equal(h.document.querySelector('[data-content="question"]').textContent, '题目');
  assert.equal(h.document.querySelector('[data-content="questionAnswer"]').textContent, '题目＋答案');
  assert.equal(h.document.querySelector('[data-content="question"]').closest('footer') !== null, true);
  assert.equal(h.document.getElementById('jfjc-style').textContent, h.window.__JFJC_DIALOG_CSS__);
  assert.doesNotMatch(pageScriptSource(), /__JFJC_MATH__|__JFJC_PREVIEW__|data:font\/woff2;base64,/);
});

test('单题只显示当前题，整卷原序排列，全选清空和题型显示正确', async () => {
  const h = browserHost(); await open(h, 'single');
  assert.equal(h.document.querySelectorAll('.jfjc-row').length, 1);
  assert.equal(h.document.querySelector('input[data-id]').dataset.id, '5074');
  assert.equal(h.document.getElementById('jfjc-count').textContent, '已选 1 / 1 题');
  await open(h, 'selected');
  assert.deepEqual(Array.from(h.document.querySelectorAll('input[data-id]')).map(x => x.dataset.id), ['5074', '5075']);
  assert.equal(h.document.getElementById('jfjc-commit').disabled, false);
  assert.equal(h.document.getElementById('jfjc-count').textContent, '已选 2 / 2 题');
  h.document.querySelector('[data-action="select-none"]').click();
  assert.equal(h.document.getElementById('jfjc-commit').disabled, true);
  h.document.querySelector('[data-action="select-all"]').click();
  assert.equal(h.document.getElementById('jfjc-commit').disabled, false);
  assert.equal(h.document.querySelectorAll('.jfjc-row.is-selected').length, 2);
  h.document.querySelector('[data-action="select-none"]').click();
  assert.equal(h.document.getElementById('jfjc-commit').disabled, true);
  assert.equal(h.document.querySelectorAll('.jfjc-row.is-selected').length, 0);
  assert.equal(h.document.querySelector('.jfjc-rowtitle span').textContent, '选择题');
});

test('错误结果按文本显示且重复反馈不累积，不挤入底部状态与动作', async () => {
  const h = browserHost(); await open(h);
  const feedback = {done:true,message:'完成 1，失败 1',retryIds:[5074],details:['<img src=x onerror=evil()>']};
  h.runtime.feedback('test-task', feedback); h.runtime.feedback('test-task', feedback);
  assert.equal(h.document.querySelectorAll('#jfjc-result .jfjc-errors li').length, 1);
  assert.equal(h.document.querySelector('#jfjc-result img'), null);
  assert.equal(h.document.querySelector('#jfjc-status .jfjc-errors'), null);
  assert.equal(h.document.getElementById('jfjc-result').closest('.jfjc-scroll') !== null, true);
  assert.equal(h.document.getElementById('jfjc-retry').hidden, false);
});

test('关闭弹窗或离开试卷恢复网页原有滚动，连续打开不丢失原状态', async () => {
  const h = browserHost(); h.document.body.style.overflow = 'auto';
  await open(h); await open(h, 'selected');
  assert.equal(h.document.body.style.overflow, 'hidden');
  h.document.querySelector('[aria-label="关闭导入"]').click();
  assert.equal(h.document.body.style.overflow, 'auto');
  await open(h); h.location.pathname = '/papers/238'; h.runtime.refresh();
  assert.equal(h.document.body.style.overflow, 'auto');
});
