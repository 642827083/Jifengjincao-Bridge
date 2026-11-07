var __JFJC_CARD_LOCATOR__ = (function () {
  const N = __JFJC_NATIVE__;
  function mode() { return __JFJC_SETTINGS__.cardLocationMode(); }
  function setMode(requested) { __JFJC_SETTINGS__.saveCardLocationMode(requested); }

  function identity(note) {
    const matches = []; let invalid = false;
    N.comments(note).forEach(function (text) {
      const pattern = /<!-- JFJC_QUESTION:(\d+):(\d+) -->/g;
      let match;
      while ((match = pattern.exec(text))) {
        const paperId = Number(match[1]), questionId = Number(match[2]);
        if (!Number.isSafeInteger(paperId) || paperId < 0 || !Number.isSafeInteger(questionId) || questionId < 1) { invalid = true; continue; }
        matches.push({ paperId: paperId, questionId: questionId });
      }
    });
    if (invalid || !matches.length || matches.some(function (item) { return item.paperId !== matches[0].paperId || item.questionId !== matches[0].questionId; })) return null;
    return matches[0];
  }
  function matches(operation, note) {
    const link = identity(note);
    return link && link.questionId === operation.target.questionId;
  }

  function value(object, key) {
    const item = object && object[key];
    return typeof item === "function" ? item.call(object) : item;
  }

  function items(list) {
    if (!list) return [];
    const count = Number(typeof list.count === "function" ? list.count() : list.length) || 0;
    const result = [];
    for (let index = 0; index < count; index += 1) result.push(typeof list.objectAtIndex === "function" ? list.objectAtIndex(index) : list[index]);
    return result;
  }

  function studyFor(addon) {
    return Application.sharedInstance().studyController(addon.window);
  }

  function studySetId(study) {
    return String(value(study && study.notebookController, "notebookId") || "");
  }

  function ensureActive(operation) {
    if (operation.done || operation.addon.__jfjcCardLocation !== operation) throw new Error("已取消定位");
    if ((operation.phase === 'search' || operation.phase === 'select') && studySetId(studyFor(operation.addon)) !== operation.initialBook) throw new Error('学习集已切换，请重新定位');
  }

  function clearTimer(operation, timer) {
    if (!timer) return;
    operation.timers.delete(timer);
    timer.invalidate();
  }

  function finish(operation, error, result) {
    if (operation.done) return;
    operation.done = true;
    operation.timers.forEach(function (timer) { timer.invalidate(); });
    operation.timers.clear();
    operation.waits.forEach(function (reject) { reject(error || new Error("定位已结束")); });
    operation.waits.clear();
    if (operation.selecting) {
      try { __JFJC_CARD_LOCATOR_UI__.cancel(operation.addon.panelController); }
      catch (cleanupError) { console.log(`[Jifengjincao Bridge] 关闭题卡选择列表失败：${cleanupError && cleanupError.message || cleanupError}`); }
    }
    if (operation.addon.__jfjcCardLocation === operation) operation.addon.__jfjcCardLocation = null;
    if (error) operation.reject(error);
    else operation.resolve(result);
  }

  function later(operation, seconds, action) {
    ensureActive(operation);
    let fired = false;
    const timer = NSTimer.scheduledTimerWithTimeInterval(seconds, false, function () {
      if (fired) return;
      fired = true;
      clearTimer(operation, timer);
      if (operation.done) return;
      try { ensureActive(operation); action(); } catch (error) { finish(operation, error); }
    });
    operation.timers.add(timer);
    return timer;
  }

  function delay(operation, seconds, switching) {
    return new Promise(function (resolve, reject) {
      operation.waits.add(reject);
      const timer = later(operation, seconds, function () {
        operation.waits.delete(reject);
        if (operation.switchTimer === timer) operation.switchTimer = null;
        resolve();
      });
      if (switching) operation.switchTimer = timer;
    });
  }

  function phase(operation, name, seconds, message) {
    clearTimer(operation, operation.deadline);
    operation.phase = name;
    operation.deadline = later(operation, seconds, function () { finish(operation, new Error(message)); });
  }

  function cardPath(note) {
    const path = [];
    const seen = new Set();
    let parent = value(note, "parentNote");
    while (parent && path.length < 20) {
      const id = String(value(parent, "noteId") || "");
      if (seen.has(id)) break;
      seen.add(id);
      const title = String(value(parent, "noteTitle") || "").trim();
      if (title) path.unshift(title);
      parent = value(parent, "parentNote");
    }
    return path.join(" / ");
  }

  async function scanStudySet(database, target, notebook, check, pause) {
    if (!notebook) return [];
    const notebookId = String(value(notebook, "topicId") || "");
    if (!notebookId) return [];
    const pending = items(value(notebook, 'notes') || value(notebook, 'childNotes')).reverse();
    const seen = new Set();
    const candidates = [];
    let inspected = 0;
    while (pending.length) {
      check();
      const snapshot = pending.pop(), note = database.getNoteById(String(value(snapshot, 'noteId') || ''));
      const id = String(value(note, "noteId") || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const link = identity(note);
      if (link && link.questionId === target.questionId && String(value(note, 'notebookId') || notebookId) === notebookId) {
        candidates.push({ noteId: id, notebookId, questionId: link.questionId, sourcePaperId: link.paperId, studySetTitle: String(value(notebook, "title") || "未命名学习集"),
          title: String(value(note, "noteTitle") || "未命名卡片"), path: cardPath(note) });
      }
      items(value(note, 'childNotes')).reverse().forEach(function (child) { pending.push(child); });
      // 大学习集分批扫描，让主线程有机会响应；不把网页或缓存当成题卡真源。
      if (++inspected % 150 === 0) await pause();
    }
    return candidates;
  }

  async function findCandidates(database, currentId, target, check, pause) {
    let candidates = await scanStudySet(database, target, currentId && database.getNotebookById(currentId), check, pause);
    if (!candidates.length) {
      if (typeof database.allNotebooks !== 'function') throw new Error('当前 MarginNote 版本不支持跨学习集查找');
      const seenBooks = new Set([currentId]), notebooks = items(database.allNotebooks());
      for (let index = 0; index < notebooks.length; index += 1) {
        check();
        const id = String(value(notebooks[index], 'topicId') || '');
        if (!id || seenBooks.has(id)) continue;
        seenBooks.add(id);
        candidates = candidates.concat(await scanStudySet(database, target, notebooks[index], check, pause));
      }
    }
    check();
    // 同题可在多份试卷中出现；当前学习集内优先使用原卷身份，单题导入也能找到。
    const exact = target.paperId && candidates.filter(function (item) { return item.sourcePaperId === target.paperId; });
    return exact && exact.length ? exact : candidates;
  }

  async function find(addon, target, validate) {
    if (!target || !Number.isSafeInteger(target.questionId) || target.questionId < 1 || !Number.isSafeInteger(target.paperId) || target.paperId < 0) throw new Error('题目标识无效');
    const currentId = studySetId(studyFor(addon)), deadline = Date.now() + 30000;
    function check() {
      validate();
      if (studySetId(studyFor(addon)) !== currentId) throw new Error('学习集已切换，查找题卡已停止');
      if (Date.now() > deadline) throw new Error('查找题卡超时，请稍后重试');
    }
    check();
    // 上传仅复用查找，不进入定位流程，不选卡、不切换学习集。
    return findCandidates(Database.sharedInstance(), currentId, target, check, function () { return N.delay(0.001); });
  }

  function checkedNote(operation, candidate) {
    ensureActive(operation);
    const note = operation.database.getNoteById(candidate.noteId);
    if (!note) throw new Error("目标卡片不存在或尚未同步，请重新定位");
    const actualStudySetId = String(value(note, "notebookId") || candidate.notebookId);
    if (actualStudySetId !== candidate.notebookId) throw new Error("目标卡片已移动到其他学习集，请重新定位");
    const link = identity(note);
    if (!matches(operation, note) || link.paperId !== candidate.sourcePaperId) throw new Error("题卡的题目来源已变化，请重新定位");
    return note;
  }

  async function execute(operation) {
    const study = studyFor(operation.addon);
    if (!study) throw new Error("当前窗口的学习控制器不可用，请先打开 MarginNote 学习页面");
    const currentId = studySetId(study);
    operation.initialBook = currentId;
    const database = operation.database;
    phase(operation, "search", 30, "查找学习集题卡超时，请稍后重试");
    const candidates = await findCandidates(database, currentId, operation.target, function () { ensureActive(operation); }, function () { return delay(operation, 0.001); });
    ensureActive(operation);
    await operation.validate(); ensureActive(operation);
    if (!candidates.length) throw new Error("所有学习集中都没有这道题的脑图卡片，请先导入或等待同步完成");
    let candidate = candidates[0];
    if (candidates.length > 1) {
      phase(operation, "select", 120, "选择题卡超时，请重新点击定位卡片");
      operation.selecting = true;
      candidate = await __JFJC_CARD_LOCATOR_UI__.choose(operation.addon.panelController, candidates);
      operation.selecting = false;
      ensureActive(operation);
      if (!candidate || !candidates.some(function (item) { return item.noteId === candidate.noteId && item.notebookId === candidate.notebookId; })) throw new Error("题卡选择无效");
    }
    checkedNote(operation, candidate);
    await operation.validate(); ensureActive(operation);
    if (studySetId(studyFor(operation.addon)) !== candidate.notebookId) {
      phase(operation, "switch", 10, "切换目标学习集超时，请稍后重试");
      // 和 CardLink 一样使用官方卡片链接，不依赖当前打开的来源文档。
      try {
        Application.sharedInstance().openURL(NSURL.URLWithString("marginnote4app://note/" + encodeURIComponent(candidate.noteId)));
      } catch (error) {
        // 宿主可能在派发返回异常后仍完成切换，以实际学习集状态为准。
        console.log(`[Jifengjincao Bridge] 派发题卡链接异常：${error && error.message || error}`);
      }
      while (studySetId(studyFor(operation.addon)) !== candidate.notebookId) await delay(operation, 0.1, true);
      await delay(operation, 0.2);
    }
    phase(operation, "focus", 3, "目标卡片定位超时，请稍后重试");
    await operation.validate(); ensureActive(operation);
    function targetStudy() {
      ensureActive(operation);
      const active = studyFor(operation.addon);
      if (studySetId(active) !== candidate.notebookId) throw new Error("学习集已切换，定位停止");
      if (!active || (operation.mode === "focus" && (!active.notebookController || typeof active.notebookController.changeFocusToNote !== "function"))) {
        throw new Error(operation.mode === "focus" ? "当前 MarginNote 版本不支持进入焦点并定位脑图卡片" : "当前 MarginNote 版本不支持定位脑图卡片");
      }
      return active;
    }
    if (operation.mode === "focus") {
      targetStudy().notebookController.changeFocusToNote(checkedNote(operation, candidate));
      // 和 CardLink 一样，切焦点后等待画布重建，再派发滚动定位。
      await delay(operation, 0.08);
    }
    checkedNote(operation, candidate);
    const active = targetStudy();
    // MN Utils 的定位封装绑定当前窗口；其他插件窗口使用显式窗口的原生接口。
    if (value(MNUtil, 'currentWindow') === operation.addon.window) MNUtil.focusNoteInMindMapById(candidate.noteId);
    else if (typeof active.focusNoteInMindMapById === 'function') active.focusNoteInMindMapById(candidate.noteId);
    else throw new Error('当前 MarginNote 版本不支持定位此窗口的脑图卡片');
    await delay(operation, 0.06);
    checkedNote(operation, candidate);
    targetStudy();
    return { questionId: operation.target.questionId, noteId: candidate.noteId, notebookId: candidate.notebookId };
  }

  function locate(addon, target, validate) {
    if (!addon) return Promise.reject(new Error("插件窗口不可用"));
    if (addon.__jfjcCardLocation) return Promise.reject(new Error("正在定位上一张卡片，请稍候"));
    if (!target || !Number.isSafeInteger(target.questionId) || target.questionId < 1 || !Number.isSafeInteger(target.paperId) || target.paperId < 0) return Promise.reject(new Error('题目标识无效'));
    if (typeof MNUtil === 'undefined' || typeof MNUtil.focusNoteInMindMapById !== 'function') return Promise.reject(new Error('请先安装并启用最新版 MN Utils，再使用定位卡片'));
    if (typeof validate !== 'function') return Promise.reject(new Error('网页题目校验不可用'));
    const operation = { addon: addon, target: { paperId: target.paperId, questionId: target.questionId }, validate: validate, mode: mode(), database: Database.sharedInstance(),
      timers: new Set(), waits: new Set(), done: false, selecting: false };
    const result = new Promise(function (resolve, reject) { operation.resolve = resolve; operation.reject = reject; });
    addon.__jfjcCardLocation = operation;
    execute(operation).then(function (value) { finish(operation, null, value); }, function (error) { finish(operation, error); });
    return result;
  }

  function resume(addon) {
    const operation = addon && addon.__jfjcCardLocation;
    if (operation && operation.phase === "switch" && operation.switchTimer && typeof operation.switchTimer.fire === 'function') operation.switchTimer.fire();
  }

  function cancel(addon) {
    const operation = addon && addon.__jfjcCardLocation;
    if (operation) finish(operation, new Error("已取消定位"));
  }

  function switching(addon) { return Boolean(addon && addon.__jfjcCardLocation && addon.__jfjcCardLocation.phase === 'switch'); }
  return { locate: locate, find: find, resume: resume, cancel: cancel, switching: switching, mode: mode, setMode: setMode, identity: identity };
})();
