import fs from 'node:fs';
import http from 'node:http';
import { pageScriptSource } from './web-bundle.mjs';

const input = process.argv[2];
if (!input) throw new Error('请指定公开试卷数据回放文件');
const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const firstId = Number(data.questions[0].question.id);
const script = pageScriptSource().replaceAll("window.location.origin !== 'https://bbkaoyan.cn'", "window.location.origin !== 'http://127.0.0.1:49176'");
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>实际导入弹窗本地回放</title><style>
body{margin:0;background:#f7f8fa;color:#26333e;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.brand{padding:24px 36px;font-size:24px;font-weight:700;border-bottom:1px solid #e0e5ea}main{margin:32px}h1{font-size:28px}.card{background:white;border:1px solid #dde5eb;border-radius:16px;padding:24px;margin:24px 0;min-height:280px}.note{font-size:13px;color:#7d8993}
</style></head><body><div class="brand">疾风劲草 · 导入界面回放</div><main><h1 id="paper-title"></h1><p class="note">公开数据＋实际插件脚本。本地模拟 MN 反馈，不执行建卡或读取真实账号。</p><article id="question-${firstId}" class="card"><b>第 1 题</b><p>本地网页背景样例，弹窗题干仅显示公开 API 文字摘要。</p></article><article class="card">下一题…</article></main><script>
// 本地回放只拦截插件命令，不执行真实导入或远程上传。
const append=document.body.appendChild.bind(document.body);let attempts=0;
document.body.appendChild=function(node){if(node.tagName==='IFRAME'&&node.src.startsWith('jifengjincaobridge://')){const url=new URL(node.src),token=url.searchParams.get('token');node.src='about:blank';if(url.hostname==='import'){attempts++;setTimeout(()=>window.__JFJC_PAGE__.feedback(token,{message:'正在导入（1/22）…'}),100);setTimeout(()=>window.__JFJC_PAGE__.feedback(token,attempts===1?{done:true,message:'完成 21 题，未完成 1 题',retryIds:[${firstId}],details:Array.from({length:20},(_,i)=>'第 '+(i+1)+' 题：本地验证用说明，检查长结果不会挤走底部按钮。')}:{done:true,message:'重试完成，未完成 0 题',retryIds:[]}),400)}}return append(node)};
</script><script src="/bundle.js"></script><script>window.__JFJC_PAGE__.open(new URLSearchParams(location.search).get('scope')||'selected',{token:'local-preview',target:new URLSearchParams(location.search).has('long')?'我的数学学习集：高等数学、线性代数与概率论完整复习计划':'数学',content:'question'});</script></body></html>`;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4XsAAAAASUVORK5CYII=', 'base64');
http.createServer((request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1:49176');
  if(url.pathname==='/bundle.js'){response.setHeader('Content-Type','application/javascript; charset=utf-8');response.end(script);}
  else if(url.pathname==='/api/papers/237/questions'){response.setHeader('Content-Type','application/json; charset=utf-8');response.end(JSON.stringify(data));}
  else if(/^\/api\/question-assets\/[1-9]\d*$/.test(url.pathname)){response.setHeader('Content-Type','image/png');response.end(png);}
  else{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html);}
}).listen(49176,'127.0.0.1',()=>console.log('实际导入弹窗回放：http://127.0.0.1:49176/papers/237（'+data.questions.length+' 题）'));
