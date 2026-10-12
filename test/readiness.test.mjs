import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { nativeHost, browserHost, envelope, tick } from './helpers.mjs';
import { pageScriptSource } from '../scripts/web-bundle.mjs';

test('目录读取等待空页、网页初始化及路由稳定，自动跳转时不提前创建任务', async () => {
  const native = nativeHost(), browser = browserHost(envelope(), url => url.includes('/api/papers?') ? new Response(JSON.stringify({ items: [{ id: 237, subject: 'math1', kind: 'official', title: '真题', year: 2026 }], total: 1 })) : null);
  native.context.__JFJC_PAGE_SCRIPT__ = pageScriptSource();
  const c = { addon: { window: {} }, activePage: 'import', visible: true, webView: { loading: true } }, probes = [];
  let stage = 0;
  c.webView.evaluateJavaScript = (code, callback) => {
    if (code.includes('__JFJC_READINESS__')) {
      probes.push(++stage);
      if (stage === 1) return callback(JSON.stringify({ origin: 'null', route: 'about:blank', ready: 'complete', content: false }), null);
      c.webView.loading = false;
      if (stage === 2) return callback(JSON.stringify({ origin: 'https://bbkaoyan.cn', route: '/papers', ready: 'complete', content: false }), null);
      if (stage === 3) return callback(JSON.stringify({ origin: 'https://bbkaoyan.cn', route: '/papers', ready: 'complete', content: true }), null);
      browser.location.pathname = '/past-papers';
      return callback(JSON.stringify({ origin: 'https://bbkaoyan.cn', route: '/past-papers', ready: 'complete', content: true }), null);
    }
    assert.ok(stage >= 5, '网页未就绪时提前执行了目录任务');
    try { callback(vm.runInContext(code, browser.context), null); } catch (error) { callback(null, error); }
  };
  const result = await native.context.__JFJC_WEB_COMMANDS__.dispatch(c, 'loadCatalog', { subject: 'math1', kind: 'official' });
  assert.equal(result.papers.length, 1); assert.ok(probes.length >= 5);
  assert.equal(browser.calls.length, 1);
});

test('空页持续不恢复时给出加载提示，等待有上限且不注入业务脚本', async () => {
  const h = nativeHost(); let now = 0, probes = 0;
  h.context.Date = { now: () => now };
  h.native.delay = async seconds => { now += seconds * 1000; };
  const c = { visible: true, webView: { loading: true, evaluateJavaScript(code, callback) {
    assert.ok(code.includes('__JFJC_READINESS__')); probes++;
    callback(JSON.stringify({ origin: 'null', route: 'about:blank', ready: 'complete', content: false }), null);
  } } };
  await assert.rejects(h.transport.waitReady(c), /尚未加载完成/);
  assert.equal(probes, 48); assert.equal(now, 12000);
});

test('真正换站、关闭面板或重新加载时终止等待，不读取目录', async () => {
  for (const mode of ['foreign', 'closed', 'reloaded']) {
    const h = nativeHost(), c = { visible: true, pageLoadEpoch: 1, webView: { loading: false } };
    c.webView.evaluateJavaScript = (code, callback) => {
      if (mode === 'closed') c.visible = false;
      if (mode === 'reloaded') c.pageLoadEpoch++;
      callback(JSON.stringify({ origin: mode === 'foreign' ? 'https://other.test' : 'https://bbkaoyan.cn', route: '/papers', ready: 'complete', content: false }), null);
    };
    await assert.rejects(h.transport.waitReady(c), /切换|取消/);
  }
});

test('就绪探针执行在网页上下文，空根节点等待、内容出现后继续，取消命令不在异源执行', async () => {
  const h = nativeHost(), browser = browserHost(), root = browser.document.createElement('div');
  root.id = 'root'; browser.document.body.appendChild(root);
  Object.defineProperty(browser.document, 'readyState', { value: 'complete', configurable: true });
  const c = { visible: true, webView: { loading: false, evaluateJavaScript(code, callback) {
    try { callback(vm.runInContext(code, browser.context), null); } catch (error) { callback(null, error); }
  } } };
  const waiting = h.transport.waitReady(c); await tick(); root.textContent = '历年真题'; await waiting;
  browser.location.origin = 'https://foreign.test';
  let cancelled = false; browser.window.__JFJC_PAGE__.cancel = () => { cancelled = true; };
  await h.transport.cancel(c); assert.equal(cancelled, false);
  await assert.rejects(h.transport.evaluate(c, '1'), /网站已切换/);
});

test('cn 网页与传输只在 cn 执行，top 和相似域名不读取会话', async () => {
  for (const origin of ['https://bbkaoyan.top', 'https://bbkaoyan.cn.evil.test']) {
    const h = nativeHost(), browser = browserHost(envelope(), undefined, origin);
    assert.equal(browser.runtime, undefined); assert.equal(browser.window.__JFJC_QUESTION_TOOLS__, undefined);
    const c = { visible: true, webView: { loading: false, evaluateJavaScript(code, callback) {
      try { callback(vm.runInContext(code, browser.context), null); } catch (error) { callback(null, error); }
    } } };
    await assert.rejects(h.transport.waitReady(c), /网站已切换/);
    await assert.rejects(h.transport.evaluate(c, '1'), /网站已切换/);
    assert.equal(browser.calls.length, 0);
  }
});
