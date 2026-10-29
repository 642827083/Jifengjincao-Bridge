var __JFJC_HANDWRITING__ = (function () {
  const N = __JFJC_NATIVE__, MAX = 10 * 1024 * 1024;
  function value(object, key) {
    if (!object) return undefined;
    let item = object[key];
    if (item === undefined && typeof object.objectForKey === 'function') item = object.objectForKey(key);
    return typeof item === 'function' ? item.call(object) : item;
  }
  function selected(context, addon) {
    const study = context.app.studyController(addon.window), notebook = study && study.notebookController;
    const selection = value(value(notebook, 'mindmapView'), 'selViewLst');
    let note;
    if (selection !== undefined && selection !== null) {
      const nodes = N.items(selection);
      if (nodes.length !== 1) throw new Error('请先在 MN 中只选中一张卡片');
      note = nodes[0];
      for (let depth = 0; note && !value(note, 'noteId') && depth < 3; depth++) note = value(note, 'note');
    } else note = value(notebook, 'focusNote');
    const id = N.noteId(note), live = id && context.database.getNoteById(id);
    if (!live || String(value(live, 'notebookId') || '') !== context.notebookId) throw new Error('请先在当前学习集中选中一张卡片');
    return live;
  }
  function latest(note) {
    const comments = N.items(value(note, 'comments'));
    // 保留来源快照用于切卡保护，图片内容交给官方媒体接口读取。
    for (let index = comments.length - 1; index >= 0; index--) {
      const comment = comments[index], drawing = value(comment, 'drawing');
      if (value(comment, 'type') === 'PaintNote' && drawing !== undefined && drawing !== null && drawing !== '') {
        if (typeof drawing !== 'string' || drawing.length > 1024) throw new Error('最后一条手写批注的媒体引用格式暂不支持');
        return { index: index, hash: drawing };
      }
    }
    throw new Error('所选卡片没有可读取的手写批注，请先保存手写后重试');
  }
  function capture(addon) {
    const context = N.context(addon), note = selected(context, addon), noteId = N.noteId(note), source = latest(note);
    function validate() {
      N.ensureContext(addon, context);
      const live = selected(context, addon);
      if (N.noteId(live) !== noteId) throw new Error('所选卡片已切换，手写上传已停止');
      const current = latest(live);
      if (current.index !== source.index || current.hash !== source.hash) throw new Error('最后一条手写批注已变化，请重新上传');
    }
    let pending = null;
    function cancel() {
      if (pending) pending.finish(null, new Error('手写上传已取消'));
    }
    function content(controller) {
      validate();
      if (typeof AddonWebPanel === 'undefined' || typeof AddonWebPanel.panel !== 'function') throw new Error('当前 MN 缺少官方媒体面板接口，请更新 MN');
      return new Promise(function (resolve, reject) {
        let panel, timer, settled = false;
        const request = { token: 'ink-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), noteId: noteId, index: source.index + 1,
          validate: validate, chunks: [], offset: 0, stage: '官方媒体页面加载' };
        function finish(result, error) {
          if (settled) return; settled = true;
          if (timer) timer.invalidate();
          if (controller.handwritingRequest === request) controller.handwritingRequest = null;
          pending = null;
          try { if (panel && typeof panel.hideFloating === 'function') panel.hideFloating(); else if (panel && typeof panel.teardown === 'function') panel.teardown(); } catch (ignored) {}
          if (error) reject(error); else resolve(result);
        }
        request.finish = finish; pending = request; controller.handwritingRequest = request;
        try {
          panel = AddonWebPanel.panel(); request.panel = panel;
          if (!panel || ['loadPanel', 'showFloatingIn', 'hideFloating', 'teardown'].some(function (name) { return typeof panel[name] !== 'function'; })) throw new Error('当前 MN 不支持官方手写图片读取，请更新 MN');
          panel.onMessage = function (command, payload) {
            if (command === '__closed__') { finish(null, new Error('手写上传已取消')); return { ok: true }; }
            if (command !== 'receiveHandwriting') throw new Error('未知手写读取命令');
            return __JFJC_WEB_COMMANDS__.receiveHandwriting(controller, payload, panel);
          };
          timer = NSTimer.scheduledTimerWithTimeInterval(30, false, function () { finish(null, new Error(request.stage + '超时，请重试')); });
          panel.maxContentHeight = 120;
          if (panel.loadPanel() === false) throw new Error('官方媒体读取页面无法加载，请重新安装测试包');
          panel.showFloatingIn(context.app.studyController(addon.window));
        } catch (error) { finish(null, error); }
      });
    }
    return { validate: validate, content: content, cancel: cancel };
  }
  function receive(controller, payload, panel) {
    const request = controller.handwritingRequest;
    if (!request || request.panel !== panel || !payload || payload.phase !== 'ready' && payload.token !== request.token) throw new Error('手写读取已取消或来源不符');
    try {
      request.validate();
      if (payload.phase === 'ready') {
        if (request.ready) throw new Error('官方媒体页面重复请求，请重新上传');
        request.ready = true; request.stage = '官方卡片信息读取';
        return { token: request.token, noteId: request.noteId, index: request.index };
      }
      if (payload.phase === 'error') throw new Error(String(payload.message || '官方手写图片读取失败'));
      if (payload.phase === 'progress') {
        const stages = { media: '官方手写图片读取', background: '手写图片背景处理' };
        if (!request.ready || !stages[payload.stage]) throw new Error('官方手写读取阶段无效');
        request.stage = stages[payload.stage];
      } else if (payload.phase === 'begin') {
        if (request.length || payload.noteId !== request.noteId || payload.index !== request.index || !Number.isSafeInteger(payload.bytes) || payload.bytes < 1 || payload.bytes > MAX
          || payload.length !== Math.ceil(payload.bytes / 3) * 4) throw new Error('官方手写图片大小或来源无效');
        request.length = payload.length; request.stage = '手写图片回传';
      } else if (payload.phase === 'chunk') {
        if (!request.length || payload.offset !== request.offset || typeof payload.text !== 'string' || !/^[A-Za-z0-9+/=]{1,65536}$/.test(payload.text) || request.offset + payload.text.length > request.length) throw new Error('官方手写图片分块无效');
        request.chunks.push(payload.text); request.offset += payload.text.length;
      } else if (payload.phase === 'finish') {
        const base64 = request.chunks.join('');
        if (!request.length || request.offset !== request.length || !/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error('官方手写 PNG 不完整');
        request.finish({ type: 'image/png', base64: base64 });
      } else throw new Error('未知手写图片阶段');
      return { ok: true };
    } catch (error) { request.finish(null, error); throw error; }
  }
  return { capture: capture, latest: latest, receive: receive };
})();
