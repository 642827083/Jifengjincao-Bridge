var __JFJC_HANDWRITING__ = (function () {
  const N = __JFJC_NATIVE__, MAX = 10 * 1024 * 1024, MAX_TEXT = 1024 * 1024, MAX_BUNDLE = Math.ceil(MAX / 3) * 4 + MAX_TEXT + 4096;
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
    throw new Error('来源卡片没有可读取的手写批注，请先保存手写后重试');
  }
  function prepare(addon, sourceType) {
    const context = N.context(addon);
    let fallback, fallbackError;
    // 备用来源固定为点击上传时的单选卡片，查找期间的改选不会悄悄改变来源。
    try { fallback = capture(addon, null, context, sourceType); } catch (error) { fallbackError = error; }
    return async function (target, check) {
      function validate() { N.ensureContext(addon, context); check(); }
      validate();
      const candidates = target ? await __JFJC_CARD_LOCATOR__.find(addon, target, validate) : [];
      validate();
      if (candidates.length > 1) throw new Error('找到多张同题题卡，无法唯一确定上传来源，请先整理重复题卡');
      if (candidates.length) return capture(addon, candidates[0], context, sourceType);
      if (fallbackError) throw new Error((target ? '未找到对应题卡；' : '') + String(fallbackError.message || fallbackError));
      fallback.validate();
      fallback.notice = target ? '未找到对应题卡，使用当前选中卡片' : '当前对话没有关联题号，使用当前选中卡片';
      return fallback;
    };
  }
  function capture(addon, candidate, captured, sourceType) {
    const context = captured || N.context(addon), note = candidate ? context.database.getNoteById(candidate.noteId) : selected(context, addon);
    const noteId = N.noteId(note), notebookId = candidate ? candidate.notebookId : context.notebookId;
    if (!noteId || String(value(note, 'notebookId') || '') !== notebookId) throw new Error('来源卡片不存在或已移动，请重新上传');
    const mindmap = sourceType === 'mindmap', none = sourceType === 'none', link = candidate && __JFJC_CARD_LOCATOR__.identity(note), source = mindmap || none ? null : latest(note);
    if (candidate && (!link || link.questionId !== candidate.questionId || link.paperId !== candidate.sourcePaperId)) throw new Error('题卡来源已变化，请重新上传');
    function validate() {
      N.ensureContext(addon, context);
      const live = candidate ? context.database.getNoteById(noteId) : selected(context, addon);
      if (!live || N.noteId(live) !== noteId || String(value(live, 'notebookId') || '') !== notebookId) throw new Error('来源卡片已删除、移动或所选卡片已切换，上传已停止');
      const currentLink = candidate && __JFJC_CARD_LOCATOR__.identity(live);
      if (candidate && (!currentLink || currentLink.paperId !== link.paperId || currentLink.questionId !== link.questionId)) throw new Error('题卡来源已变化，请重新上传');
      if (source) {
        const current = latest(live);
        if (current.index !== source.index || current.hash !== source.hash) throw new Error('最后一条手写批注已变化，请重新上传');
      }
    }
    let pending = null;
    function cancel() {
      if (pending) pending.finish(null, new Error('手写上传已取消'));
    }
    function content(controller, attachFirst) {
      validate();
      if (typeof AddonWebPanel === 'undefined' || typeof AddonWebPanel.panel !== 'function') throw new Error('当前 MN 缺少官方媒体面板接口，请更新 MN');
      return new Promise(function (resolve, reject) {
        let panel, timer, settled = false;
        // 脑图或仅上传卡片首条时不使用手写评论序号，以零值握手。
        const request = { token: 'ink-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), noteId: noteId, index: source ? source.index + 1 : 0, source: none ? 'none' : mindmap ? 'mindmap' : 'handwriting',
          attachFirst: attachFirst === true, validate: validate, chunks: [], offset: 0, stage: '官方媒体页面加载' };
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
        return { token: request.token, noteId: request.noteId, index: request.index, source: request.source, attachFirst: request.attachFirst };
      }
      if (payload.phase === 'error') throw new Error(String(payload.message || '官方手写图片读取失败'));
      if (payload.phase === 'progress') {
        const stages = { media: '官方手写图片读取', background: '手写图片背景处理' };
        if (!request.ready || !stages[payload.stage]) throw new Error('官方手写读取阶段无效');
        request.stage = stages[payload.stage];
      } else if (payload.phase === 'begin') {
        const bundle = request.attachFirst && payload.format === 'bundle';
        if (request.length || payload.noteId !== request.noteId || payload.index !== request.index || !Number.isSafeInteger(payload.bytes) || payload.bytes < (bundle && request.source === 'none' ? 0 : 1) || payload.bytes > MAX
          || !Number.isSafeInteger(payload.length) || (bundle ? payload.length < 4 || payload.length > MAX_BUNDLE : payload.length !== Math.ceil(payload.bytes / 3) * 4)
          || Boolean(request.attachFirst) !== Boolean(bundle)) throw new Error('官方手写图片大小或来源无效');
        request.bundle = bundle; request.bytes = payload.bytes;
        request.length = payload.length; request.stage = '手写图片回传';
      } else if (payload.phase === 'chunk') {
        if (!request.length || payload.offset !== request.offset || typeof payload.text !== 'string' || !payload.text.length || payload.text.length > 65536 || !request.bundle && !/^[A-Za-z0-9+/=]+$/.test(payload.text) || request.offset + payload.text.length > request.length) throw new Error('官方手写图片分块无效');
        request.chunks.push(payload.text); request.offset += payload.text.length;
      } else if (payload.phase === 'finish') {
        const base64 = request.chunks.join('');
        if (!request.length || request.offset !== request.length) throw new Error('官方手写 PNG 不完整');
        if (request.bundle) {
          const bundle = JSON.parse(base64);
          if (!bundle || typeof bundle.text !== 'string' || bundle.text.length > MAX_TEXT || !Array.isArray(bundle.files) || (!bundle.files.length && (request.source !== 'none' || !bundle.text)) || bundle.files.length > 5) throw new Error('卡片图文数据无效');
          let total = 0;
          bundle.files.forEach(function (file) {
            if (!file || !Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > MAX || typeof file.base64 !== 'string' || !/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(file.base64)
              || file.base64.length !== Math.ceil(file.bytes / 3) * 4 || file.base64.length / 4 * 3 - (file.base64.endsWith('==') ? 2 : file.base64.endsWith('=') ? 1 : 0) !== file.bytes) throw new Error('卡片图文图片无效');
            total += file.bytes;
          });
          if (total > MAX) throw new Error('本次图片合计超过 10 MiB，请缩减首条图片后重试');
          if (total !== request.bytes) throw new Error('卡片图文图片不完整');
          request.finish({ type: 'application/x-jfjc-upload+json', text: base64 });
        } else {
          if (!/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error('官方手写 PNG 不完整');
          request.finish({ type: 'image/png', base64: base64 });
        }
      } else throw new Error('未知手写图片阶段');
      return { ok: true };
    } catch (error) { request.finish(null, error); throw error; }
  }
  return { prepare: prepare, capture: capture, latest: latest, receive: receive };
})();
