import fs from 'node:fs';
import http from 'node:http';
import vm from 'node:vm';
import { importPageHTML } from './web-bundle.mjs';

const input = process.argv[2];
if (!input) throw new Error('请指定公开试卷数据回放文件');
const envelope = JSON.parse(fs.readFileSync(input, 'utf8'));
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../src/BBKaoyanAdapter.js', import.meta.url), 'utf8'), context);
const model = context.__JFJC_ADAPTER__.normalize(envelope);
const value = { paper: model.paper, target: '当前学习集（预览）', entries: model.entries.map(entry => ({ ...entry, imported: false, complete: false })) };
const catalog = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : [{ id: model.paper.id, title: model.paper.title, subject: model.paper.subject, kind: 'official', year: model.paper.year, questionCount: model.entries.length }];
// 回放仅模拟原生消息，不读取账号，也不执行真实建卡。
const mock = `const append=document.body.appendChild.bind(document.body);const data=${JSON.stringify(value).replaceAll('<', '\\u003c')};const catalog=${JSON.stringify(catalog).replaceAll('<', '\\u003c')};
document.body.appendChild=function(node){if(node.tagName==='IFRAME'&&node.src.startsWith('mnaddon://')){const request=JSON.parse(decodeURIComponent(node.src.split('payload=')[1]));let payload;
if(request.command==='getImportPreferences')payload={content:'questionAnswer'};
if(request.command==='loadCatalog')payload={papers:catalog.filter(paper=>paper.subject===request.payload.subject&&paper.kind===request.payload.kind)};
if(request.command==='loadPaper'||request.command==='refreshImportedStatus')payload=data;
window.setTimeout(()=>window.__JFJC_BRIDGE_RECEIVE__({requestId:request.requestId,payload:payload,error:payload?null:{message:'界面回放不执行真实导入'}}),30);return node;}return append(node);};`;
const html = importPageHTML().replace('<script>', () => '<script>' + mock);
const server = http.createServer((request, response) => { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(html); });
server.listen(49180, '127.0.0.1', () => console.log('导入页回放：http://127.0.0.1:49180'));
