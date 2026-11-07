var __JFJC_WEB_COMMANDS__ = (function () {
  const N = __JFJC_NATIVE__, T = __JFJC_TRANSPORT__;
  function evaluate(controller, code, sourceWeb) {
    return new Promise(function (resolve, reject) {
      const web = sourceWeb || controller.importWebView;
      if (!web) { reject(new Error('本地页面尚未打开')); return; }
      let settled = false;
      const timer = NSTimer.scheduledTimerWithTimeInterval(12, false, function () { finish(null, new Error('导入页面响应超时')); });
      function finish(value, error) {
        if (settled) return; settled = true; timer.invalidate();
        if (error) reject(error); else resolve(value);
      }
      try { web.evaluateJavaScript(code, finish); } catch (error) { finish(null, error); }
    });
  }
  function progress(controller, value) {
    evaluate(controller, 'window.__JFJC_IMPORT_PAGE__&&window.__JFJC_IMPORT_PAGE__.progress(' + JSON.stringify(value) + ')').catch(function () {});
  }
  function check(controller, request) {
    if (!request || request.cancelled || controller.panelRequest !== request || controller.activePage !== 'import' || controller.visible === false) throw new Error('导入页面读取已取消');
  }
  function cancelRead(controller) {
    if (controller.panelOperation === 'importQuestions' || controller.session && controller.session.running) return false;
    if (controller.panelRequest) controller.panelRequest.cancelled = true;
    controller.panelRequest = null; controller.panelOperation = null;
    T.cancel(controller);
    return true;
  }
  async function session(controller) {
    const request = controller.panelRequest;
    check(controller, request);
    await T.waitReady(controller, function () { check(controller, request); }); check(controller, request);
    const context = N.context(controller.addon);
    await T.evaluate(controller, '(function(){' + __JFJC_PAGE_SCRIPT__ + ';window.__JFJC_REVIEW__&&window.__JFJC_REVIEW__.configure({enabled:' + __JFJC_SETTINGS__.showUpload() + ',source:' + JSON.stringify(__JFJC_SETTINGS__.uploadSource()) + ',attachFirst:' + __JFJC_SETTINGS__.attachFirstContent() + '});return "injected";})()');
    check(controller, request);
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
    getExtraText: function (controller) {
      controller.extraTextWebReady = true;
      controller.extraTextHint.text = '可换行，编辑后点击保存'; controller.extraTextSaveButton.enabled = true;
      return { text: __JFJC_SETTINGS__.extraText() };
    },
    saveExtraText: async function (controller, payload, sourceWeb) {
      try {
        if (!payload || !Number.isSafeInteger(payload.revision) || payload.revision < 0) throw new Error('文字保存请求无效');
        const result = await evaluate(controller, 'JSON.stringify(window.__JFJC_EXTRA_TEXT__.read(' + payload.revision + '))', sourceWeb);
        if (sourceWeb !== controller.extraTextEditor || controller.activePage !== 'settings' || controller.visible === false) throw new Error('设置页面已切换，请重新保存');
        return __JFJC_SETTINGS__.persistExtraText(controller, JSON.parse(String(result)));
      } catch (error) { N.show(controller.addon, '文字未保存：' + String(error.message || error)); throw error; }
    },
    getImportPreferences: function () { return { content: N.preference('content', 'questionAnswer') }; },
    loadCatalog: async function (controller, payload) {
      if (!payload || ['math1', 'math2', 'math3'].indexOf(payload.subject) < 0 || ['official', 'mock'].indexOf(payload.kind) < 0) throw new Error('科目或试卷类型无效');
      controller.panelModel = null;
      const s = await session(controller);
      return T.take(controller, s, 'window.__JFJC_PAGE__.catalog(' + [JSON.stringify(s.token), JSON.stringify(payload.subject), JSON.stringify(payload.kind)].join(',') + ')');
    },
    loadPaper: async function (controller, payload) {
      const request = controller.panelRequest;
      const id = __JFJC_ADAPTER__.integer(payload && payload.paperId, '试卷 ID');
      controller.panelModel = null;
      const s = await session(controller);
      const data = await T.take(controller, s, 'window.__JFJC_PAGE__.panelPaper(' + JSON.stringify(s.token) + ',' + id + ')');
      check(controller, request);
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
    cancelImport: function (controller) { if (!cancelRead(controller)) T.cancel(controller); return { cancelled: true }; }
  };
  async function dispatch(controller, command, payload, sourceWeb) {
    if (sourceWeb && sourceWeb === controller.extraTextEditor) {
      if (command !== 'getExtraText' && command !== 'saveExtraText') throw new Error('未知设置命令');
      if (command === 'saveExtraText' && (controller.activePage !== 'settings' || controller.visible === false)) throw new Error('请先打开设置页面');
      return commands[command](controller, payload, sourceWeb);
    }
    if (command === 'getExtraText' || command === 'saveExtraText') throw new Error('文字编辑器来源无效');
    if (controller.activePage !== 'import') throw new Error('请先打开导入页面');
    if (!Object.prototype.hasOwnProperty.call(commands, command)) throw new Error('未知导入命令');
    if (command === 'cancelImport') return commands[command](controller, payload);
    if (controller.panelOperation || controller.previewing || controller.session && controller.session.running) throw new Error('请等待当前操作结束');
    const request = { command: command, cancelled: false };
    controller.panelRequest = request; controller.panelOperation = command;
    try { const result = await commands[command](controller, payload); check(controller, request); return result; }
    finally { if (controller.panelRequest === request) { controller.panelRequest = null; controller.panelOperation = null; } }
  }
  function handle(controller, address, sourceWeb) {
    const match = /^mnaddon:\/\/bridge\?payload=([^&]+)$/.exec(address);
    if (!match || match[1].length > 48000) return false;
    let request;
    try { request = JSON.parse(decodeURIComponent(match[1])); } catch (error) { return false; }
    if (!request || typeof request.command !== 'string' || typeof request.requestId !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(request.requestId)) return false;
    dispatch(controller, request.command, request.payload, sourceWeb).then(function (payload) { reply({ requestId: request.requestId, payload: payload }); }, function (error) {
      reply({ requestId: request.requestId, error: { message: String(error.message || error) } });
    });
    function reply(value) { evaluate(controller, 'window.__JFJC_BRIDGE_RECEIVE__(' + JSON.stringify(value) + ')', sourceWeb).catch(function () {}); }
    return true;
  }
  function receiveHandwriting(controller, payload, panel) { return __JFJC_HANDWRITING__.receive(controller, payload, panel); }
  return { handle: handle, dispatch: dispatch, progress: progress, receiveHandwriting: receiveHandwriting, cancelRead: cancelRead };
})();
