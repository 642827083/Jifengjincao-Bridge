import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { browserHost, source } from './helpers.mjs';

function header(h) {
  const top = h.document.querySelector('.topbar');
  top.innerHTML = '<a class="brand" href="/">疾风劲草</a><div class="topbar-search-slot"><form class="topbar-search"><svg class="topbar-search-icon"></svg><input class="topbar-search-input" placeholder="原站搜索"><button type="submit">查找</button><div class="search-results">AI 对话结果</div></form></div><div class="topbar-notices"><div class="topbar-notice-carousel"><span class="topbar-support">售后群：1094624751</span></div></div><div class="topbar-actions"><nav class="primary-nav"><div class="primary-nav-group"><button>AI 组件</button><div class="primary-nav-menu"><a href="/assistant">AI 问答</a></div></div><a href="/papers">套卷</a><a href="/categories">分类题库</a><a href="/baskets">题篮</a><a href="/discussions">文章/讨论</a></nav><div class="topbar-user"><button>通知</button><button>账户</button></div></div>';
  h.window.__JFJC_HEADER__.refresh(); h.runtime.refresh();
  top.querySelector('input').focus = () => {};
  top.querySelector('.jfjc-search-toggle').focus = () => {};
  return top;
}

test('紧凑顶部保留原搜索节点、导航链接及选题导入，只标记群信息隐藏', () => {
  const h = browserHost(), top = header(h), input = top.querySelector('input'), form = top.querySelector('form');
  input.value = '我的草稿'; let submits = 0, changes = 0;
  form.addEventListener('submit', event => { event.preventDefault(); submits++; }); input.addEventListener('input', () => changes++);
  const links = [...top.querySelectorAll('a')].map(node => node.getAttribute('href'));
  vm.runInContext(source('web/src/BBKaoyanHeader.js'), h.context);
  assert.equal(top.querySelectorAll('.jfjc-search-toggle').length, 1); assert.equal(h.document.querySelectorAll('#jfjc-header-style').length, 1);
  assert.equal(top.querySelector('input'), input); assert.equal(top.querySelector('form'), form); assert.equal(input.value, '我的草稿');
  assert.deepEqual([...top.querySelectorAll('a')].map(node => node.getAttribute('href')), links);
  assert.equal(top.querySelectorAll('#jfjc-toolbar').length, 1); assert.match(top.querySelector('#jfjc-toolbar').textContent, /选题导入/);
  assert.ok(top.querySelector('.topbar-support').hasAttribute('data-jfjc-group-notice'));
  assert.ok(top.querySelector('.topbar-notices').hasAttribute('data-jfjc-empty-notices'));
  const Event = input.ownerDocument.defaultView.Event;
  top.querySelector('.jfjc-search-toggle').click(); assert.ok(top.hasAttribute('data-jfjc-search-open'));
  input.dispatchEvent(new Event('input', { bubbles:true })); form.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
  assert.equal(changes, 1); assert.equal(submits, 1); assert.equal(input.value, '我的草稿');
  top.querySelector('.jfjc-search-toggle').click(); assert.equal(top.hasAttribute('data-jfjc-search-open'), false);
});

test('轮播改为赞助或其他通知时仍显示，不连同交流群整块隐藏', () => {
  const h = browserHost(), top = header(h), row = top.querySelector('.topbar-support');
  for (const text of ['😊 友情赞助 😊', '网站服务通知', '交流群：123456']) {
    row.textContent = text; h.window.__JFJC_HEADER__.refresh();
    assert.equal(row.hasAttribute('data-jfjc-group-notice'), text.startsWith('交流群'));
    assert.equal(top.querySelector('.topbar-notices').hasAttribute('data-jfjc-empty-notices'), text.startsWith('交流群'));
  }
});

test('导航和搜索被 React 重建后自动恢复入口，迟到输入框也能展开', async () => {
  const h = browserHost(), top = header(h), slot = top.querySelector('.topbar-search-slot');
  slot.remove(); h.window.__JFJC_HEADER__.refresh(); assert.equal(top.querySelector('.jfjc-search-toggle'), null);
  top.appendChild(slot); await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(top.querySelectorAll('.jfjc-search-toggle').length, 1);
  const replacement = top.cloneNode(true); replacement.querySelector('.jfjc-search-toggle').remove();
  top.replaceWith(replacement); await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(replacement.querySelectorAll('.jfjc-search-toggle').length, 1);
  replacement.querySelector('input').focus = () => {};
  replacement.querySelector('.jfjc-search-toggle').click(); assert.ok(replacement.hasAttribute('data-jfjc-search-open'));
});

test('Escape 和点击面板外部可收起搜索，输入内容和结果节点仍保留', () => {
  const h = browserHost(), top = header(h), toggle = top.querySelector('.jfjc-search-toggle'), input = top.querySelector('input');
  input.value = '5678'; const Event = input.ownerDocument.defaultView.Event;
  toggle.click(); const escape = new Event('keydown', { bubbles:true }); Object.defineProperty(escape, 'key', { value:'Escape' });
  input.dispatchEvent(escape); assert.equal(top.hasAttribute('data-jfjc-search-open'), false);
  toggle.click(); h.document.body.dispatchEvent(new Event('pointerdown', { bubbles:true }));
  assert.equal(top.hasAttribute('data-jfjc-search-open'), false); assert.equal(input.value, '5678'); assert.ok(top.querySelector('.search-results'));
});
