import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { pageScriptSource } from './web-bundle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssFile = process.argv[2];
if (!cssFile) throw new Error('请指定已核验的网站 CSS 文件路径');
const siteCSS = fs.readFileSync(cssFile, 'utf8');
const host = vm.createContext({ __JFJC_NATIVE__: {}, __JFJC_TRANSPORT__: {}, JSB: { defineClass() { return {}; } } });
vm.runInContext(fs.readFileSync(path.join(root, 'src/WebPanelController.js'), 'utf8'), host);
// 验证触屏分支时只替换媒体条件，保持原网站规则的先后顺序。
const touchCSS = siteCSS.replaceAll('@media (hover: none),(pointer: coarse)', '@media all');
function group(name, count, years) {
  const stage = Array.from({ length: count }, (_, i) => {
    const columns = count > 6 ? Math.ceil(count / 2) : count, row = i >= columns ? 1 : 0, column = i - row * columns;
    const fan = columns <= 1 ? 0 : column / (columns - 1) * 4 - 2;
    return `<article class="paper-volume-card" style="--stack-count:${count};--stack-index:${i};--stack-row:${row};--stack-fan:${fan};--stack-z-index:${count-i}"><a class="paper-stack-card-hit" href="#preview"><div class="fixture-cover"><small>全国硕士研究生招生考试</small><strong>数学（一）</strong><span>试卷 ${i+1}</span><p>一、选择题</p><p>1. 设函数 f(x) 连续，则 …</p><p>2. 下列命题正确的是 …</p><p>3. 求积分 ∫ f(x) dx 的值 …</p><p>二、填空题</p><p>函数的极限为 ______</p><p>三、解答题</p><p>证明下列等式成立，并计算 …</p></div></a></article>`;
  }).join('');
  return `<section class="paper-stack-group ${years?'official-paper-stack':'mock-paper-stack'}"><div class="paper-stack-stage${count>6?' has-two-rows':''}">${stage}</div><div class="paper-stack-meta"><h2>${name}</h2><div class="paper-stack-entries"><a class="paper-stack-cover-caption" href="#preview">查看${years?years[0]+' 年试卷':'卷一'} →</a><nav class="paper-stack-entry-list">${Array.from({length: Math.min(count,5)},(_,i)=>`<a class="paper-stack-entry" href="#preview">${years?years[i]:['卷一','卷二','卷三','卷四','卷五'][i]}</a>`).join('')}</nav>${count>5?`<button class="paper-stack-entry-more" data-expand="${count}">查看全部 ${count} 卷</button>`:''}</div></div></section>`;
}
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jifengjincao Bridge 布局检查</title><link rel="stylesheet" href="/site.css"><style>
body{margin:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.native-bar{position:sticky;top:0;z-index:100;height:36px;background:#fbfbfc;border-bottom:1px solid #e5e7eb}.native-title{position:absolute;font-size:14px;font-weight:700;color:#555;text-align:center;line-height:36px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.native-button{position:absolute;box-sizing:border-box;border:0;border-radius:0;background:transparent;color:#666;font:20px sans-serif;cursor:pointer}.fixture-heading{display:flex;justify-content:space-between;align-items:center;padding:18px 32px;border-bottom:1px solid #e4e7eb;background:#fafbfc}.fixture-heading strong{font-size:23px}.fixture-heading span{font-size:13px;color:#64748b}.fixture-actions{display:flex;gap:8px;margin:16px 32px}.fixture-actions button{border:1px solid #ddd;background:white;border-radius:6px;padding:8px 12px}.paper-center-page{padding:20px 32px!important;max-width:none!important;width:100%!important}.paper-stack-directory{margin-bottom:44px}.fixture-cover{width:100%;height:100%;padding:16px 14px;box-sizing:border-box;background:#fff;border-left:7px solid #202326;text-align:left;font:8px/1.7 serif;overflow:hidden}.fixture-cover strong{display:block;text-align:center;font-size:12px}.fixture-cover small,.fixture-cover span{display:block;text-align:center}.fixture-cover p{border-bottom:1px solid #eef0f2;padding:5px 0;margin:8px 0}.fixture-caption{margin:0 32px 20px;color:#7b8493;font-size:12px}
</style></head><body><header class="native-bar" id="native-bar"></header><div class="fixture-heading"><strong>疾风劲草 · 套卷</strong><span>布局验证用封面样例</span></div><div class="fixture-actions"><button id="selection">展开两排</button><button id="compact">窄年份容器</button></div><main class="paper-center-page"><div class="paper-stack-directory mock-stack-directory">${group('李林 · 六套卷',6)}${group('张宇 · 八套卷',8)}</div><div class="paper-stack-directory official-stack-directory">${group('2002–2006 年真题',5,[2006,2005,2004,2003,2002])}${group('1997–2001 年真题',5,[2001,2000,1999,1998,1997])}</div></main><p class="fixture-caption">网页使用当前网站 CSS 与实际布局模块；顶部按原生代码计算的 frame 展示。此页面不执行 MN 导入。</p><script src="/layout.js"></script><script>
if(new URLSearchParams(location.search).has('touch')){const original=window.matchMedia.bind(window);window.matchMedia=function(query){return query==='(hover: hover) and (pointer: fine)'?{matches:false}:original(query);};}
window.__JFJC_LAYOUT__.install();
async function toolbar(){const f=await(await fetch('/frames?width='+document.documentElement.clientWidth)).json();const box=b=>'left:'+b.x+'px;top:'+b.y+'px;width:'+b.width+'px;height:'+b.height+'px;';let out=f.title.width?'<span class="native-title" style="'+box(f.title)+'">Jifengjincao Bridge</span>':'';
out+='<button aria-label="关闭" class="native-button" style="'+box(f.close)+'">×</button>';document.getElementById('native-bar').innerHTML=out;}
toolbar();addEventListener('resize',toolbar);new ResizeObserver(toolbar).observe(document.documentElement);
if(document.getElementById('selection'))document.getElementById('selection').onclick=function(){const stage=document.querySelector('.has-two-rows');stage.classList.toggle('is-selection-mode');this.textContent=stage.classList.contains('is-selection-mode')?'收起两排':'展开两排';};
if(document.getElementById('compact'))document.getElementById('compact').onclick=function(){const entries=document.querySelector('.official-stack-directory .paper-stack-entries');entries.style.maxWidth=entries.style.maxWidth?'':'180px';};
document.querySelectorAll('[data-expand]').forEach(button=>{button.onclick=function(){const list=this.previousElementSibling;if(this.dataset.open){while(list.children.length>5)list.lastElementChild.remove();delete this.dataset.open;this.textContent='查看全部 '+this.dataset.expand+' 卷';}else{for(let i=6;i<=Number(this.dataset.expand);i++){const link=document.createElement('a');link.className='paper-stack-entry';link.href='#preview';link.textContent='卷'+i;list.appendChild(link);}this.dataset.open='true';this.textContent='收起';}};});
</script></body></html>`;
// 原生标题栏为尺寸示意；网页导入栏和锚点定位运行实际网页脚本。
const sampleCard = (id, number) => `<article id="question-${id}" class="fixture-question"><h2>第 ${number} 题 · 布局样例</h2><p>已知函数 f(x) 连续，求下列式子的值。</p><div class="fixture-options"><p>A. 0</p><p>B. 1</p><p>C. 2</p><p>D. 3</p></div><button>查看答案</button></article>`;
const paperHTML = html.replace('疾风劲草 · 套卷', '疾风劲草 · 示例试卷')
  .replace('class="fixture-heading"', 'class="fixture-heading topbar"')
  .replace(/<div class="fixture-actions">[\s\S]*?<\/div>/, '')
  .replace(/<main class="paper-center-page">[\s\S]*?<\/main>/, '<main class="fixture-paper"><h1>示例试卷 · 布局验证</h1>' + sampleCard(5074, '01') + '<div id="async-question"><p>下一道题加载中…</p></div></main>')
  .replace('</style>', '.fixture-heading{position:sticky;top:36px;z-index:90}.fixture-paper{max-width:1060px;margin:auto;padding:24px 28px 100px}.fixture-question{padding:24px;margin:24px 0;background:white;border:1px solid #ddd;border-radius:12px;min-height:420px}.fixture-options{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fixture-options p{padding:16px;border:1px solid #eee;border-radius:8px}.fixture-question button{padding:12px;border:1px solid #ddd;border-radius:8px;background:white}.fixture-paper h1{font-size:28px}@media(max-width:500px){.fixture-heading{padding:16px}.fixture-heading strong{font-size:18px}.fixture-heading span{display:none}.fixture-paper{padding:12px 16px 100px}.fixture-question{padding:16px}.fixture-paper h1{font-size:23px}}</style>')
  .replace('<script src="/layout.js"></script>', '<script src="/layout.js"></script><script src="/page.js"></script>')
  .replace('</body>', '<script>setTimeout(()=>{document.getElementById("async-question").outerHTML=' + JSON.stringify(sampleCard(5075, '02')) + ';},200);</script></body>');
const server = http.createServer((request,response)=>{
  const url = new URL(request.url,'http://localhost');
  if(url.pathname==='/frames'){response.setHeader('Content-Type','application/json');response.end(JSON.stringify(host.__JFJC_PANEL__.toolbarFrames(Math.max(304,Number(url.searchParams.get('width'))||920))));}
  else if(url.pathname==='/preview/import-dialog'){response.setHeader('Content-Type','text/html; charset=utf-8');response.end(fs.readFileSync(path.join(root,'docs/previews/import-dialog-proposal.html')));}
  else if(url.pathname==='/layout.js'){response.setHeader('Content-Type','application/javascript; charset=utf-8');response.end(fs.readFileSync(path.join(root,'web/src/BBKaoyanLayout.js')));}
  else if(url.pathname==='/page.js'){response.setHeader('Content-Type','application/javascript; charset=utf-8');response.end(pageScriptSource().replaceAll("window.location.origin !== 'https://bbkaoyan.cn'", "window.location.origin !== 'http://127.0.0.1:49173'"));}
  else if(url.pathname==='/site.css'){response.setHeader('Content-Type','text/css; charset=utf-8');response.end(url.searchParams.has('touch')?touchCSS:siteCSS);}
  else {response.setHeader('Content-Type','text/html; charset=utf-8');const page=url.pathname==='/papers/237'?paperHTML:html;response.end(url.searchParams.has('touch')?page.replace('/site.css','/site.css?touch=1'):page);}
});
server.listen(49173,'127.0.0.1',()=>console.log('布局预览：http://127.0.0.1:49173/?touch=1'));
