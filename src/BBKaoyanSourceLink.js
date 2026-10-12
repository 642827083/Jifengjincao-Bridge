var __JFJC_SOURCE__ = (function () {
  const N = __JFJC_NATIVE__, KEY = 'jifengjincao-bridge', EVENT = 'AddonBroadcast';
  function validId(id, zero) { return Number.isSafeInteger(Number(id)) && Number(id) >= (zero ? 0 : 1); }
  function link(paperId, questionId) {
    if (!validId(paperId, true) || !validId(questionId, false)) throw new Error('原题编号无效');
    return 'marginnote4app://addon/' + KEY + '?action=open&paper=' + Number(paperId) + '&question=' + Number(questionId);
  }
  function parse(message) {
    const match = /^jifengjincao-bridge\?action=open&paper=(0|[1-9]\d*)&question=([1-9]\d*)$/.exec(String(message || ''));
    if (!match || !validId(match[1], true) || !validId(match[2], false)) return null;
    const paperId = Number(match[1]), questionId = Number(match[2]);
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
  function upgrade(addon) {
    const context = N.context(addon), work = [], merges = [];
    N.all(context.notebook).forEach(function (note) {
      N.comments(note).forEach(function (text, index) {
        const identity = /<!-- JFJC_QUESTION:(\d+):(\d+) -->/.exec(text);
        const source = /<!-- JFJC_SOURCE:(\d+):(\d+) -->/.exec(text);
        const answer = /<!-- JFJC_ANSWER:\d+:\d+ -->/.test(text)
          || /<!-- JFJC_PART:(answer|explanation) -->/.test(text) && N.comments(note).some(function (part) { return /<!-- JFJC_ANSWER:\d+:\d+ -->/.test(part); });
        if (!identity && !answer && !source) return;
        // 只修复插件管理正文的公式边界，不从网站重取题干，不改用户独立评论。
        let after = __JFJC_FORMAT__.repairMath(text);
        let parts;
        const target = identity || source;
        if (target && N.has(note, 'QUESTION:' + target[1] + ':' + target[2])) {
          const paperId = Number(target[1]), questionId = Number(target[2]);
          const oldURL = paperId ? 'https://bbkaoyan.cn/papers/' + paperId + '#question-' + questionId : 'https://bbkaoyan.cn/questions/' + questionId;
          after = after.split('[查看原题](' + oldURL + ')').join('[查看原题](' + link(paperId, questionId) + ')');
          const sourceText = '[查看原题](' + link(paperId, questionId) + ')';
          // 仅拆分受管理题干中的独立链接段落，用户评论和自改链接保留。
          const blocks = after.split('\n\n'), position = blocks.indexOf(sourceText);
          if (identity && position >= 0 && blocks.filter(function (block) { return block === sourceText; }).length === 1) {
            blocks.splice(position, 1);
            const body = blocks.join('\n\n');
            if (body.replace(/<!--[\s\S]*?-->/g, '').trim()) parts = [body, sourceText + '\n\n<!-- JFJC_SOURCE:' + paperId + ':' + questionId + ' -->'];
          }
        }
        if (parts || after !== text) work.push({ note: note, index: index, before: text, parts: parts || [after] });
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
    return work.length + merges.length;
  }
  return { link: link, parse: parse, register: register, unregister: unregister, receive: receive, upgrade: upgrade };
})();
