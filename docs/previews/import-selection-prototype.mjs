import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 独立预览：对比总复选框的全选与半选状态，不调用导入、桥接或持久化。
const previewDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(previewDir, '../..');
const fixture = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, 'jfjc-import-fixture.json'), 'utf8'));
const css = fs.readFileSync(path.join(root, 'web/src/BBKaoyanDialog.css'), 'utf8').replaceAll('#jfjc-dialog', '.prototype-dialog');
const escape = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const entries = fixture.questions.slice().sort((a, b) => Number(a.display_order) - Number(b.display_order));
const partial = new Set([0, 2, 4, 5, 7]);
function panel(kind) {
  const all = kind === 'all';
  return `<section class="example"><h2>${all ? '① 默认打开：全部选中' : '② 取消部分题目：显示半选'}</h2><div class="prototype-dialog" data-kind="${kind}"><div class="jfjc-sheet">
    <header class="jfjc-header"><strong>导入题目</strong><button aria-label="关闭预览">×</button></header>
    <div class="jfjc-meta"><div><span>来源</span><b>${escape(fixture.paper.title)}</b></div><div><span>目标学习集</span><b>数学</b></div></div>
    <div class="jfjc-select"><label class="master-label"><input type="checkbox" data-master aria-label="全选题目"><span>全选</span></label><button data-clear>清空</button><small data-count aria-live="polite"></small></div>
    <div class="jfjc-scroll"><div class="jfjc-list">${entries.map((row, index) => {
      const q = row.question, checked = all || partial.has(index);
      return `<div class="jfjc-row ${checked ? 'is-selected' : ''}"><label class="jfjc-check"><input type="checkbox" data-row aria-label="选择第 ${escape(row.question_number)} 题" ${checked ? 'checked' : ''}></label><div class="jfjc-rowbody"><label class="jfjc-rowtitle"><b>第 ${escape(row.question_number)} 题</b><span>${escape({choice:'选择题',blank:'填空题',solution:'解答题'}[q.question_type] || '')}</span></label><div class="jfjc-excerpt">${escape(String(q.stem_latex || q.stem || '').replace(/\s+/g, ' ').slice(0, 180))}</div></div></div>`;
    }).join('')}</div></div>
    <footer><div class="jfjc-footer-status"></div><div class="jfjc-footer-actions"><div class="jfjc-mode"><span>导入内容</span><div class="jfjc-segments" role="group" aria-label="导入内容"><button data-content="question" aria-pressed="true">题目</button><button data-content="questionAnswer" aria-pressed="false">题目＋答案</button></div></div><button class="mock-import">导入</button></div></footer>
  </div></div><p class="explanation">${all ? '✓ 表示全部选中；取消勾选可取消全部。' : '— 表示只选了部分；再次勾选可补齐全部。'}</p></section>`;
}
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>全选与清空 · 独立预览</title><style>${css}
body{margin:0;background:#f2f4f7;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#26333e}
main{max-width:1264px;margin:auto;padding:28px 28px 20px}.intro{margin-bottom:20px}.intro h1{font-size:24px;margin:0 0 6px;font-weight:650}.intro p{margin:0;color:#72808d}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:24px}.example{min-width:0}.example h2{font-size:15px;margin:0 0 12px;font-weight:600;color:#4b5965}.prototype-dialog{position:static;width:auto;height:auto;padding:0;background:transparent;display:block}.prototype-dialog .jfjc-sheet{height:448px;width:100%;max-width:100%;border:1px solid #e0e6ec;border-radius:14px;box-shadow:0 8px 28px #172c4110}.prototype-dialog .jfjc-header{padding:16px 20px 10px}.prototype-dialog .jfjc-meta{padding:0 20px 14px;gap:16px;font-size:12px}.prototype-dialog .jfjc-meta b{max-width:210px}.prototype-dialog .jfjc-select{border-top:1px solid #edf0f2;border-bottom:1px solid #edf0f2;background:#fafbfd;padding:12px 20px;gap:18px}.master-label{display:flex;align-items:center;gap:12px;color:#334e68;font-weight:500;cursor:pointer}.prototype-dialog .jfjc-select small{color:#73818e;font-variant-numeric:tabular-nums}.prototype-dialog .jfjc-scroll{padding:8px 8px 8px}.prototype-dialog .jfjc-row{padding:12px 12px;gap:12px;margin-bottom:4px}.prototype-dialog footer{min-height:64px;padding:12px 20px}.prototype-dialog .jfjc-footer-status{flex:1}.prototype-dialog .jfjc-segments button{padding:5px 10px}.prototype-dialog .mock-import{background:#2263b4;border-color:#2263b4;color:white;white-space:nowrap}.explanation{margin:12px 0 0;font-size:13px;color:#6c7b88}.notice{font-size:12px;color:#94a0ab;margin:18px 0 0}
@media(max-width:900px){.comparison{grid-template-columns:1fr}main{padding:20px}.prototype-dialog .jfjc-meta{flex-direction:row}.prototype-dialog .jfjc-footer-status{flex-basis:auto}.prototype-dialog .jfjc-footer-actions{width:auto;justify-content:flex-end}}
</style></head><body><main><header class="intro"><h1>总复选框＋清空</h1><p>选择操作集中在列表顶部，右侧显示已选数量，底部保留导入设置。</p></header><div class="comparison">${panel('all')}${panel('partial')}</div><p class="notice">独立界面预览 · 可点击全选、清空或单题复选框体验 · 不执行导入、不修改现有插件</p></main><script>
// 仅在内存中演示选择状态，不执行插件命令。
document.querySelectorAll('.prototype-dialog').forEach(panel=>{
  const master=panel.querySelector('[data-master]'),rows=Array.from(panel.querySelectorAll('[data-row]')),clear=panel.querySelector('[data-clear]');
  function update(){const count=rows.filter(row=>row.checked).length;master.checked=count===rows.length;master.indeterminate=count>0&&count<rows.length;panel.querySelector('[data-count]').textContent='已选 '+count+' / '+rows.length+' 题';clear.disabled=count===0;const button=panel.querySelector('.mock-import');button.textContent='导入 '+count+' 题';button.disabled=count===0;rows.forEach(row=>row.closest('.jfjc-row').classList.toggle('is-selected',row.checked));}
  master.addEventListener('change',()=>{rows.forEach(row=>row.checked=master.checked);update()});
  clear.addEventListener('click',()=>{rows.forEach(row=>row.checked=false);update()});rows.forEach(row=>row.addEventListener('change',update));
  panel.querySelectorAll('[data-content]').forEach(button=>button.addEventListener('click',()=>panel.querySelectorAll('[data-content]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)))));
  update();
});
</script></body></html>`;
fs.writeFileSync(path.join(previewDir, 'import-selection-prototype.html'), html);
http.createServer((request, response) => { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); }).listen(49177, '127.0.0.1', () => console.log('独立选择预览：http://127.0.0.1:49177/papers/237'));
