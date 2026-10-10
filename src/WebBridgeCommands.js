var __JFJC_WEB_COMMANDS__ = (function () {
  const N = __JFJC_NATIVE__, T = __JFJC_TRANSPORT__;
  function evaluate(controller, code) {
    return new Promise(function (resolve, reject) {
      if (!controller.importWebView) { reject(new Error('导入页面尚未打开')); return; }
      let settled = false;
      const timer = NSTimer.scheduledTimerWithTimeInterval(12, false, function () { finish(null, new Error('导入页面响应超时')); });
      function finish(value, error) {
        if (settled) return; settled = true; timer.invalidate();
        if (error) reject(error); else resolve(value);
      }
      try { controller.importWebView.evaluateJavaScript(code, finish); } catch (error) { finish(null, error); }
    });
  }
  function progress(controller, value) {
    evaluate(controller, 'window.__JFJC_IMPORT_PAGE__&&window.__JFJC_IMPORT_PAGE__.progress(' + JSON.stringify(value) + ')').catch(function () {});
  }
  async function session(controller) {
    if (controller.webView.loading) throw new Error('数学页面正在加载，请稍候再刷新');
    const context = N.context(controller.addon);
    await T.evaluate(controller, '(function(){' + __JFJC_PAGE_SCRIPT__ + ';return "injected";})()');
    const value = { token: 'panel-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), context: context, cancelled: false, running: false, panel: true };
    controller.session = value; return value;
  }
  function status(controller, model) {
    const context = N.context(controller.addon), index = __JFJC_IMPORT__.index(context);
    return { paper: model.paper, target: context.title, entries: model.entries.map(function (entry) {
      const key = __JFJC_ADAPTER__.key(model.paper.id, entry.id), note = index[key];
      const answer = __JFJC_IMPORT__.answerStatus(note, key);
      return Object.assign({}, entry, { imported: Boolean(note), complete: Boolean(note && answer.answer && answer.explanation) });
    }) };
  }
  const commands = {
    getImportPreferences: function () { return { content: N.preference('content', 'questionAnswer') }; },
    loadCatalog: async function (controller, payload) {
      if (!payload || ['math1', 'math2', 'math3'].indexOf(payload.subject) < 0 || ['official', 'mock'].indexOf(payload.kind) < 0) throw new Error('科目或试卷类型无效');
      controller.panelModel = null;
      const s = await session(controller);
      return T.take(controller, s, 'window.__JFJC_PAGE__.catalog(' + [JSON.stringify(s.token), JSON.stringify(payload.subject), JSON.stringify(payload.kind)].join(',') + ')');
    },
    loadPaper: async function (controller, payload) {
      const id = __JFJC_ADAPTER__.integer(payload && payload.paperId, '试卷 ID');
      controller.panelModel = null;
      const s = await session(controller);
      const data = await T.take(controller, s, 'window.__JFJC_PAGE__.panelPaper(' + JSON.stringify(s.token) + ',' + id + ')');
      const model = __JFJC_ADAPTER__.normalize(data);
      if (model.paper.id !== id) throw new Error('网站返回的试卷与选择不符');
      const result = status(controller, model);
      controller.panelModel = model; return result;
    },
    refreshImportedStatus: function (controller) {
      if (!controller.panelModel) throw new Error('请先选择一份试卷');
      return status(controller, controller.panelModel);
    },
    importQuestions: async function (controller, payload) {
      let s = controller.session;
      const model = controller.panelModel;
      if (!model || !payload || payload.paperId !== model.paper.id) throw new Error('试卷会话已失效，请重新选择试卷');
      if (['question', 'questionAnswer'].indexOf(payload.content) < 0) throw new Error('导入内容无效');
      __JFJC_ADAPTER__.selection(model, payload.ids);
      // 停止后重试重新读取同一试卷，不沿用已取消的网页请求。
      if (!s || !s.panel || s.cancelled) { await commands.loadPaper(controller, { paperId: model.paper.id }); s = controller.session; }
      s.context = N.context(controller.addon);
      s.includeTopics = __JFJC_SETTINGS__.importTopics();
      const accepted = await T.evaluate(controller, 'window.__JFJC_PAGE__.panelCommit(' + [JSON.stringify(s.token), JSON.stringify(payload.ids), JSON.stringify(payload.content)].join(',') + ')');
      if (String(accepted) !== 'accepted') throw new Error('网页试卷会话已失效，请重新选择试卷');
      const result = await __JFJC_IMPORT__.run(controller, s);
      let snapshot = null;
      try { snapshot = status(controller, controller.panelModel); } catch (error) { result.error = result.error || String(error.message || error); }
      return { result: result, status: snapshot };
    },
    cancelImport: function (controller) { T.cancel(controller); return { cancelled: true }; }
  };
  async function dispatch(controller, command, payload) {
    if (controller.activePage !== 'import') throw new Error('请先打开导入页面');
    if (!Object.prototype.hasOwnProperty.call(commands, command)) throw new Error('未知导入命令');
    if (command === 'cancelImport') return commands[command](controller, payload);
    if (controller.panelOperation || controller.previewing || controller.session && controller.session.running) throw new Error('请等待当前操作结束');
    controller.panelOperation = command;
    try { return await commands[command](controller, payload); }
    finally { controller.panelOperation = null; }
  }
  function handle(controller, address) {
    const match = /^mnaddon:\/\/bridge\?payload=([^&]+)$/.exec(address);
    if (!match || match[1].length > 48000) return false;
    let request;
    try { request = JSON.parse(decodeURIComponent(match[1])); } catch (error) { return false; }
    if (!request || typeof request.command !== 'string' || typeof request.requestId !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(request.requestId)) return false;
    dispatch(controller, request.command, request.payload).then(function (payload) { reply({ requestId: request.requestId, payload: payload }); }, function (error) {
      reply({ requestId: request.requestId, error: { message: String(error.message || error) } });
    });
    function reply(value) { evaluate(controller, 'window.__JFJC_BRIDGE_RECEIVE__(' + JSON.stringify(value) + ')').catch(function () {}); }
    return true;
  }
  return { handle: handle, dispatch: dispatch, progress: progress };
})();
