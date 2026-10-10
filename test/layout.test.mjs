import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { browserHost, source, tick } from './helpers.mjs';

function library(h, id, twoRows=false) {
  const page=h.document.createElement('section');page.className='paper-center-page';
  page.innerHTML=`<div class="paper-stack-directory" id="${id}"><section class="paper-stack-group"><div class="paper-stack-stage${twoRows?' has-two-rows':''}"></div><div class="paper-stack-meta"><h2>试卷</h2><div class="paper-stack-entries"><nav class="paper-stack-entry-list">${[2006,2005,2004,2003,2002].map(y=>`<a class="paper-stack-entry" href="/papers/${y}">${y}</a>`).join('')}</nav></div></div></section></div>`;
  page.querySelector('.paper-stack-group').getBoundingClientRect=()=>({top:10});
  h.document.body.appendChild(page);return page;
}

test('React 新增卷组和重复注入后应用局部布局，保持原始导航和题目内容',async()=>{
  const h=browserHost();const first=library(h,'first');const hrefs=Array.from(first.querySelectorAll('a')).map(a=>a.href);
  h.window.__JFJC_LAYOUT__.refresh();
  assert.equal(first.hasAttribute('data-jfjc-library'),true);
  assert.equal(first.querySelectorAll('[data-jfjc-stack]').length,1);assert.equal(first.querySelectorAll('.jfjc-measure-stage').length,0);
  const second=library(h,'second',true);await tick();h.window.__JFJC_LAYOUT__.refresh();
  assert.equal(second.hasAttribute('data-jfjc-library'),true);
  vm.runInContext(source('web/src/BBKaoyanLayout.js'),h.context);vm.runInContext(source('web/src/BBKaoyanPage.js'),h.context);
  assert.equal(h.document.querySelectorAll('#jfjc-library-style').length,1);
  assert.deepEqual(Array.from(first.querySelectorAll('a')).map(a=>a.href),hrefs);
  assert.equal(h.document.getElementById('question-5074').textContent,'题目');
});

test('展开两排卷组时只同步所在行，退出选择模式恢复，不影响下一行',()=>{
  const h=browserHost(),page=library(h,'rows',true),directory=page.firstElementChild,first=directory.firstElementChild;
  const peer=first.cloneNode(true),below=first.cloneNode(true);peer.querySelector('.paper-stack-stage').classList.remove('has-two-rows');
  h.window.matchMedia=()=>({matches:true});
  first.getBoundingClientRect=()=>({top:10});peer.getBoundingClientRect=()=>({top:10});below.getBoundingClientRect=()=>({top:450});directory.appendChild(peer);directory.appendChild(below);
  first.querySelector('.paper-stack-stage').classList.add('is-selection-mode');h.window.__JFJC_LAYOUT__.refresh();
  assert.equal(first.classList.contains('jfjc-row-expanded'),true);assert.equal(peer.classList.contains('jfjc-row-expanded'),true);assert.equal(below.classList.contains('jfjc-row-expanded'),false);
  first.querySelector('.paper-stack-stage').classList.remove('is-selection-mode');h.window.__JFJC_LAYOUT__.refresh();
  assert.equal(first.classList.contains('jfjc-row-expanded'),false);assert.equal(peer.classList.contains('jfjc-row-expanded'),false);
});
