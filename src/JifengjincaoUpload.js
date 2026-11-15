var __JFJC_UPLOAD__ = (function () {
  const N = __JFJC_NATIVE__, T = __JFJC_TRANSPORT__, PREFIX = 'window.__JFJC_REVIEW__', MAX_TEXT = 1024 * 1024;
  function appendExtraText(content, text, source) {
    let bundle;
    if (content.type === 'application/x-jfjc-upload+json') bundle = JSON.parse(content.text);
    else {
      const base64 = content.base64;
      bundle = { text: '', files: [{ name: { handwriting: '卡片手写', mindmap: '脑图手写' }[source], type: content.type, base64: base64,
        bytes: base64.length / 4 * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0) }] };
    }
    if (text) bundle.text += (bundle.text ? '\n\n' : '') + text;
    if (bundle.text.length > MAX_TEXT) throw new Error('本次文字合计过长，请缩减提示词');
    return { type: 'application/x-jfjc-upload+json', text: JSON.stringify(bundle) };
  }
  function cancel(controller) {
    const operation = controller.uploadOperation; if (!operation) return;
    controller.uploadOperation = null;
    if (operation.source) operation.source.cancel();
    T.evaluate(controller, PREFIX + '&&' + PREFIX + '.cancel(' + JSON.stringify(operation.token) + ')').catch(function () {});
  }
  async function start(controller, scope) {
    if (!__JFJC_SETTINGS__.showUpload()) throw new Error('上传已在设置中关闭');
    if (controller.uploadOperation) throw new Error('上一次上传仍在添加中，请稍候');
    if (!/^composer-[1-9]\d{0,8}$/.test(String(scope))) throw new Error('对话输入框标识无效');
    const selectedSource = __JFJC_SETTINGS__.uploadSource(), handwriting = selectedSource !== 'none';
    const attachFirst = __JFJC_SETTINGS__.attachFirstContent();
    const extraText = __JFJC_SETTINGS__.uploadExtraText();
    if (!handwriting && !attachFirst && !extraText) throw new Error('请选择上传卡片内容、上传手写内容或填写提示词');
    // 先固定学习集和备用单选，再按当前网页题号查找来源卡片。
    const resolveSource = handwriting || attachFirst ? __JFJC_HANDWRITING__.prepare(controller.addon, selectedSource) : null;
    let source = null;
    const operation = { token: 'record-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), source: null };
    controller.uploadOperation = operation;
    const token = JSON.stringify(operation.token);
    function guard() {
      if (controller.uploadOperation !== operation || !__JFJC_SETTINGS__.showUpload()) throw new Error('上传已取消');
      if (__JFJC_SETTINGS__.uploadSource() !== selectedSource) throw new Error('上传手写内容设置已切换，请重新点击上传');
      if (__JFJC_SETTINGS__.attachFirstContent() !== attachFirst) throw new Error('上传卡片内容设置已变化，请重新点击上传');
      if (__JFJC_SETTINGS__.uploadExtraText() !== extraText) throw new Error('提示词设置已变化，请重新点击上传');
      if (controller.visible === false || controller.activePage && controller.activePage !== 'math') throw new Error('面板已关闭或切换，上传已取消');
      if (source) source.validate();
    }
    let target;
    async function accepted(code, fallback) {
      guard();
      // 在网页端把布尔结果转换为字符串，避免宿主将 true 桥接为 NSNumber 的 1。
      const result = await T.evaluate(controller, '(function(){return (' + code + ')?"accepted":"rejected";})()'); guard();
      if (String(result) !== 'accepted') {
        const state = JSON.parse(String(await T.evaluate(controller, 'JSON.stringify(' + PREFIX + '.read(' + token + '))'))); guard();
        const problem = String(await T.evaluate(controller, PREFIX + '.reason(' + JSON.stringify(target) + ')') || ''); guard();
        throw new Error(state.status === 'error' && state.error || problem || fallback);
      }
    }
    try {
      target = JSON.parse(String(await T.evaluate(controller, 'JSON.stringify(' + PREFIX + '&&' + PREFIX + '.context(' + JSON.stringify(scope) + ',' + Boolean(attachFirst || extraText) + '))')));
      guard(); if (!target || target.composer !== String(scope)) throw new Error('请在当前对话打开目标输入框后重试');
      if (target.protocol !== 2) throw new Error('上传设置已更新，请重新加载数学页后再试');
      const problem = String(await T.evaluate(controller, PREFIX + '.reason(' + JSON.stringify(target) + ')') || ''); guard();
      if (problem) throw new Error(problem);
      if (resolveSource) {
        source = await resolveSource(target.question, guard); operation.source = source; guard();
        const changed = String(await T.evaluate(controller, PREFIX + '.reason(' + JSON.stringify(target) + ')') || ''); guard();
        if (changed) throw new Error(changed);
        if (source.notice) N.show(controller.addon, source.notice);
      }
      let content = source ? await source.content(controller, attachFirst) : { type: 'application/x-jfjc-upload+json', text: JSON.stringify({ files: [], text: '' }) }; guard();
      content = appendExtraText(content, extraText, selectedSource);
      const data = content.text;
      await accepted(PREFIX + '.prepare(' + [target, operation.token, data.length].map(JSON.stringify).join(',') + ')', '内容暂时无法接收，请稍候再试');
      for (let offset = 0; offset < data.length; offset += 65536) {
        await accepted(PREFIX + '.append(' + token + ',' + offset + ',' + JSON.stringify(data.slice(offset, offset + 65536)) + ')', '内容分块接收失败，请重新上传');
      }
      await accepted(PREFIX + '.commit(' + token + ')', '内容未能添加，请重新上传');
      const deadline = Date.now() + 65000;
      while (Date.now() < deadline) {
        guard(); const result = JSON.parse(String(await T.evaluate(controller, 'JSON.stringify(' + PREFIX + '.read(' + token + '))'))); guard();
        if (result.status === 'uploaded') { N.show(controller.addon, '上传内容已添加，请检查后点击发送'); return true; }
        if (result.status === 'error' || result.status === 'cancelled') throw new Error(result.error || '上传未完成');
        await N.delay(0.2);
      }
      throw new Error('尚未确认上传结果，请检查当前提问和附件后再重试');
    } finally {
      if (controller.uploadOperation === operation) { cancel(controller); }
    }
  }
  return { start: start, cancel: cancel };
})();
