var __JFJC_SOURCE__ = (function () {
  const N = __JFJC_NATIVE__, KEY = 'jifengjincao-bridge', EVENT = 'AddonBroadcast';
  function validId(id, zero) { return Number.isSafeInteger(Number(id)) && Number(id) >= (zero ? 0 : 1); }
  function link(paperId, questionId) {
    if (!validId(paperId, true) || !validId(questionId, false)) throw new Error('原题编号无效');
    return 'marginnote4app://addon/' + KEY + '?action=open&paper=' + Number(paperId) + '&question=' + Number(questionId);
  }
  function parse(message) {
    const ai = String(message || "").indexOf(KEY + "?action=ask-ai&") === 0;
    if (ai) message = String(message).replace("?action=ask-ai&", "?action=open&");
    const match = /^jifengjincao-bridge\?action=open&paper=(0|[1-9]\d*)&question=([1-9]\d*)$/.exec(String(message || ''));
    if (!match || !validId(match[1], true) || !validId(match[2], false)) return null;
    const paperId = Number(match[1]), questionId = Number(match[2]);
    if (ai) return { paperId: paperId, questionId: questionId, askAi: true, url: "https://bbkaoyan.cn/questions/" + questionId };
    return { paperId: paperId, questionId: questionId, url: paperId
      ? 'https://bbkaoyan.cn/papers/' + paperId + '#question-' + questionId
      : 'https://bbkaoyan.cn/questions/' + questionId };
  }
  function register(addon) {
    if (addon.sourceLinkObserver) return;
    if (typeof MNUtil !== 'undefined' && typeof MNUtil.addObserver === 'function' && typeof MNUtil.removeObserver === 'function') {
      MNUtil.addObserver(addon, 'onSourceLink:', EVENT); addon.sourceLinkObserver = 'utils';
    } else if (typeof NSNotificationCenter !== 'undefined') {
      NSNotificationCenter.defaultCenter().addObserverSelectorName(addon, 'onSourceLink:', EVENT); addon.sourceLinkObserver = 'native';
    } else throw new Error('当前 MN 版本缺少插件链接通知接口');
  }
  function unregister(addon) {
    if (addon.sourceLinkObserver === 'utils' && typeof MNUtil !== 'undefined' && typeof MNUtil.removeObserver === 'function') MNUtil.removeObserver(addon, EVENT);
    else if (addon.sourceLinkObserver && typeof NSNotificationCenter !== 'undefined') NSNotificationCenter.defaultCenter().removeObserverName(addon, EVENT);
    addon.sourceLinkObserver = null;
  }
  function receive(addon, sender) {
    const target = parse(N.value(N.value(sender, 'userInfo'), 'message')); if (!target) return false;
    const app = Application.sharedInstance();
    const active = typeof MNUtil !== 'undefined' && MNUtil.currentWindow || N.value(app, 'focusWindow') || N.value(app, 'window');
    // 链接通知会广播到多个窗口，只在用户当前操作的窗口打开面板。
    if (active !== addon.window) return false;
    if (!addon.panelController) addon.panelController = __JFJC_PANEL__.create(addon);
    __JFJC_PANEL__.openSource(addon.panelController, target); return true;
  }
  function questionLayout(note, addon, context) {
    const comments = N.comments(note), managed = /<!-- JFJC_(?:QUESTION:\d+:\d+|ORDER:[-\d.]+|SOURCE:\d+:\d+) -->/g;
    const identities = comments.join('\n').match(/<!-- JFJC_QUESTION:\d+:\d+ -->/g) || [];
    if (!identities.length || identities.some(function (value) { return value !== identities[0]; })) return false;
    const identity = /JFJC_QUESTION:(\d+):(\d+)/.exec(identities[0]), key = identity[1] + ':' + identity[2];
    if (!validId(identity[1], true) || !validId(identity[2], false)) return false;
    const sourceText = '[查看原题](' + link(Number(identity[1]), Number(identity[2])) + ')';
    // 兼容临时站点旧卡，确认题目身份后改用当前插件入口。
    const oldSources = ['https://bbkaoyan.cn', 'https://bbkaoyan.top'].map(function (origin) {
      const path = Number(identity[1]) ? '/papers/' + identity[1] + '#question-' + identity[2] : '/questions/' + identity[2];
      return '[查看原题](' + origin + path + ')';
    });
    function body(text) { return text.replace(managed, '').trim(); }
    function isLink(text) { return text === sourceText || oldSources.indexOf(text) >= 0; }
    function tagsValid(text) {
      return (text.match(managed) || []).every(function (tag) {
        const order = /^<!-- JFJC_ORDER:([-\d.]+) -->$/.exec(tag);
        return tag === identities[0] || tag === '<!-- JFJC_SOURCE:' + key + ' -->' || Boolean(order && Number.isFinite(Number(order[1])));
      });
    }
    // 身份冲突、自改入口和附加说明不能当成插件元数据搬动。
    if (comments.some(function (text) { return (text.match(managed) || []).length && !tagsValid(text); })) return false;
    const candidates = comments.map(function (text, index) { return { text: text, index: index }; }).filter(function (item) {
      return item.text.indexOf(identities[0]) >= 0 && body(item.text) && !isLink(body(item.text).split('\n\n')[0]);
    });
    if (candidates.length > 1) return false;
    let bodyIndex = candidates.length ? candidates[0].index : -1;
    // 无正文身份时，只识别紧邻第二条身份评论的首条题干。
    if (bodyIndex < 0 && comments[1] && comments[1].indexOf(identities[0]) >= 0
      && (isLink(body(comments[1])) || !body(comments[1]))
      && body(comments[0]) && !/<!-- JFJC_|\[查看原题\]\(/.test(comments[0])) bodyIndex = 0;
    // 兼容旧排序错误中断后的三条评论：两个匹配入口和一条无标记题干。
    // 仅在正文唯一且没有其他个人评论时恢复，避免把个人笔记当成题干。
    if (bodyIndex < 0 && comments.length === 3) {
      const sources = comments.filter(function (text) { return isLink(body(text)); });
      const bodies = comments.map(function (text, index) { return { text: text, index: index }; }).filter(function (item) {
        return body(item.text) && !isLink(body(item.text)) && !/<!-- JFJC_|\[查看原题\]\(/.test(item.text);
      });
      if (sources.length === 2 && sources.some(function (text) { return text.includes(identities[0]); }) && bodies.length === 1) bodyIndex = bodies[0].index;
    }
    if (bodyIndex < 0) return false;
    const original = comments[bodyIndex], blocks = body(original).split('\n\n');
    const sourceBlocks = blocks.filter(isLink);
    if (sourceBlocks.length > 1 || blocks.some(function (block) { return /\[查看原题\]\(/.test(block) && !isLink(block); })) return false;
    const updated = __JFJC_FORMAT__.repairMath(blocks.filter(function (block) { return !isLink(block); }).join('\n\n'));
    if (!updated || /<!-- JFJC_/.test(updated)) return false;
    const extra = [];
    for (let i = 0; i < comments.length; i++) {
      if (i === bodyIndex) continue;
      const text = comments[i], tags = text.match(managed) || [], content = body(text);
      if (tags.length && content && !isLink(content)) return false;
      if (tags.length || isLink(content)) extra.push({ text: text, index: i });
    }
    const annotations = [identities[0]];
    [original].concat(extra.map(function (item) { return item.text; })).forEach(function (text) {
      (text.match(managed) || []).forEach(function (tag) { if (annotations.indexOf(tag) < 0) annotations.push(tag); });
    });
    if (annotations.filter(function (tag) { return /^<!-- JFJC_ORDER:/.test(tag); }).length > 1) return false;
    const metadata = [sourceText, identities[0]].join('\n\n');
    if (updated === original && extra.length === 1 && extra[0].index === bodyIndex + 1 && extra[0].text === metadata) return false;
    N.ensureContext(addon, context);
    N.undo(context, function () {
      // 一次替换先保存完整题干与链接身份，再清理旧元数据；失败后身份仍可识别并允许重试。
      N.replaceMarkdownParts(note, bodyIndex, original, [updated, metadata]);
      extra.reverse().forEach(function (item) {
        const index = item.index + (item.index > bodyIndex ? 1 : 0);
        N.replaceMarkdownParts(note, index, item.text, []);
      });
    });
    return true;
  }
  function repair(addon) {
    const context = N.context(addon), work = [], merges = [], questionNotes = [];
    N.all(context.notebook).forEach(function (note) {
      const identities = N.comments(note).join('\n').match(/<!-- JFJC_QUESTION:\d+:\d+ -->/g) || [];
      if (identities.some(function (value) { return value !== identities[0]; })) return;
      if (N.comments(note).some(function (text) { return /<!-- JFJC_QUESTION:\d+:\d+ -->/.test(text); })) questionNotes.push(note);
      N.comments(note).forEach(function (text, index) {
        const identity = /<!-- JFJC_QUESTION:(\d+):(\d+) -->/.exec(text);
        const source = /<!-- JFJC_SOURCE:(\d+):(\d+) -->/.exec(text);
        const answer = /<!-- JFJC_ANSWER:\d+:\d+ -->/.test(text)
          || /<!-- JFJC_PART:(answer|explanation) -->/.test(text) && N.comments(note).some(function (part) { return /<!-- JFJC_ANSWER:\d+:\d+ -->/.test(part); });
        if (!answer || identity || source) return;
        // 只修复插件管理正文的公式边界，不从网站重取题干，不改用户独立评论。
        const after = __JFJC_FORMAT__.repairMath(text);
        if (after !== text) work.push({ note: note, index: index, before: text, parts: [after] });
      });
      const standalone = N.comments(note).find(function (text) { return /^<!-- JFJC_ANSWER:\d+:\d+ -->$/.test(text.trim()); });
      const identity = standalone && /JFJC_ANSWER:(\d+:\d+)/.exec(standalone)[1];
      const parent = N.value(note, 'parentNote');
      if (identity && parent && N.has(parent, 'QUESTION:' + identity) && N.comments(note).some(function (text) {
        return /<!-- JFJC_PART:(answer|explanation) -->/.test(text) && text.replace(/<!--[\s\S]*?-->/g, '').trim();
      })) merges.push({ note: note, identity: identity });
    });
    // 从后向前替换，拆分评论不会改变尚未处理的索引。
    work.reverse().forEach(function (item) {
      N.ensureContext(addon, context);
      N.undo(context, function () { N.replaceMarkdownParts(item.note, item.index, item.before, item.parts); });
    });
    let relocated = 0; const warnings = [];
    questionNotes.forEach(function (note) {
      if (questionLayout(note, addon, context)) {
        relocated++;
        const warning = __JFJC_COMMENT_FOLD__.automatic(note); if (warning) warnings.push(warning);
      }
    });
    merges.forEach(function (item) {
      N.ensureContext(addon, context);
      N.undo(context, function () {
        const marker = '<!-- JFJC_ANSWER:' + item.identity + ' -->', comments = N.comments(item.note);
        function usable(text, part) { return text.indexOf('<!-- JFJC_PART:' + part + ' -->') >= 0 && text.replace(/<!--[\s\S]*?-->/g, '').trim(); }
        let target = comments.findIndex(function (text) { return usable(text, 'answer'); });
        if (target < 0) target = comments.findIndex(function (text) { return usable(text, 'explanation'); });
        if (target < 0) return;
        // 先把身份存进正文，再移除纯注释；删除失败也不会丢失原答案。
        if (comments[target].indexOf(marker) < 0) N.replaceMarkdown(item.note, target, comments[target], comments[target] + '\n\n' + marker);
        N.comments(item.note).map(function (text, index) { return { text: text, index: index }; }).reverse().forEach(function (comment) {
          if (comment.text.trim() === marker) N.replaceMarkdownParts(item.note, comment.index, comment.text, []);
        });
      });
    });
    return { changed: work.length + merges.length + relocated, warnings: warnings };
  }
  return { link: link, parse: parse, register: register, unregister: unregister, receive: receive, repair: repair };
})();
