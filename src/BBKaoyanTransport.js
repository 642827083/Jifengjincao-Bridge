var __JFJC_TRANSPORT__ = (function () {
  const PREFIX = 'window.__JFJC_PAGE__';
  function evaluate(controller, code) {
    return new Promise(function (resolve, reject) {
      let settled = false;
      const timer = NSTimer.scheduledTimerWithTimeInterval(12, false, function () { done(null, new Error('网站响应超时，请刷新后重试')); });
      function done(result, error) {
        if (settled) return; settled = true; if (timer && typeof timer.invalidate === 'function') timer.invalidate();
        if (error) reject(error); else resolve(result);
      }
      try {
        controller.webView.evaluateJavaScript('(function(){if(window.location.origin!=="https://bbkaoyan.cn")throw new Error("网站已切换");return (' + code + ');})()', function (result, error) {
          done(result, error ? new Error(String(__JFJC_NATIVE__.value(error, 'localizedDescription') || error)) : null);
        });
      } catch (error) { done(null, error); }
    });
  }
  function guard(controller, session) {
    if (session.cancelled || controller.session !== session) throw new Error('导入已停止');
    __JFJC_NATIVE__.ensureContext(controller.addon, session.context);
  }
  async function take(controller, session, start) {
    guard(controller, session);
    const token = JSON.stringify(session.token);
    const accepted = await evaluate(controller, start);
    if (String(accepted) !== 'accepted') throw new Error('网站连接已失效，请重新打开导入面板');
    const deadline = Date.now() + 180000;
    try {
      while (Date.now() < deadline) {
        guard(controller, session);
        const state = JSON.parse(String(await evaluate(controller, PREFIX + '.read(' + token + ')')));
        if (state.status === 'error') { const error = new Error(state.error || '网站读取失败'); error.stopImport = Boolean(state.stopImport); throw error; }
        if (state.status !== 'ready') { await __JFJC_NATIVE__.delay(0.15); continue; }
        if (!Number.isSafeInteger(state.length) || state.length <= 0 || state.length > 24 * 1024 * 1024) throw new Error('网站传输内容大小无效');
        const chunks = []; let offset = 0;
        while (offset < state.length) {
          guard(controller, session);
          const chunk = String(await evaluate(controller, PREFIX + '.chunk(' + token + ',' + offset + ')') || '');
          if (!chunk.length || chunk.length > 65536 || offset + chunk.length > state.length) throw new Error('网页数据分块不完整');
          chunks.push(chunk); offset += chunk.length;
        }
        guard(controller, session); return JSON.parse(chunks.join(''));
      }
      throw new Error('网站读取超时，请重试');
    } finally { await evaluate(controller, PREFIX + '.release(' + token + ')').catch(function () {}); }
  }
  function begin(controller, session) { return take(controller, session, PREFIX + '.begin(' + JSON.stringify(session.token) + ')'); }
  function media(controller, session, id, question, answer) {
    return take(controller, session, PREFIX + '.prepare(' + [JSON.stringify(session.token), id, Boolean(question), Boolean(answer)].join(',') + ')');
  }
  function feedback(controller, session, message, done, retryIds, details) {
    if (session.panel && typeof __JFJC_WEB_COMMANDS__ !== 'undefined') __JFJC_WEB_COMMANDS__.progress(controller, { message: message, done: Boolean(done) });
    return evaluate(controller, PREFIX + '.feedback(' + JSON.stringify(session.token) + ',' + JSON.stringify({ message: message, done: Boolean(done), retryIds: retryIds || [], details: details || [] }) + ')').catch(function () {});
  }
  function cancel(controller) {
    if (typeof __JFJC_CLIPBOARD__ !== 'undefined') __JFJC_CLIPBOARD__.cancel(controller);
    if (controller.session) controller.session.cancelled = true;
    return evaluate(controller, PREFIX + '&&' + PREFIX + '.cancel()').catch(function () {});
  }
  return { evaluate: evaluate, take: take, begin: begin, media: media, guard: guard, feedback: feedback, cancel: cancel };
})();
