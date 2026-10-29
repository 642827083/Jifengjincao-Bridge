var __JFJC_CLIPBOARD__ = (function () {
  const N = __JFJC_NATIVE__, T = __JFJC_TRANSPORT__, PREFIX = 'window.__JFJC_REVIEW__', MAX = 10 * 1024 * 1024, MAX_TEXT = 1024 * 1024;
  function pasteboard() {
    if (typeof UIPasteboard === 'undefined' || typeof UIPasteboard.generalPasteboard !== 'function') throw new Error('当前 MN 版本缺少剪贴板接口');
    return UIPasteboard.generalPasteboard();
  }
  function encodeImage(image) {
    if (!image) throw new Error('剪贴板中没有图片，请先复制图片');
    let data = N.value(image, 'pngData'), type = 'image/png';
    if (Number(N.value(data, 'length')) > MAX && typeof image.jpegData === 'function') { data = image.jpegData(0.88); type = 'image/jpeg'; }
    const length = Number(N.value(data, 'length'));
    if (!Number.isSafeInteger(length) || length < 1) throw new Error('无法读取剪贴板图片');
    if (length > MAX) throw new Error('图片超过网站 10 MiB 限制，请先裁剪后重试');
    const base64 = String(N.value(data, 'base64Encoding') || '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length !== Math.ceil(length / 3) * 4) throw new Error('剪贴板图片转换失败');
    return { base64: base64, type: type };
  }
  function clipboardImage() { return encodeImage(N.value(pasteboard(), 'image')); }
  function clipboardContent() {
    const board = pasteboard(), image = N.value(board, 'image');
    // 同时包含图片和文本时优先沿用图片附件流程，避免把图片描述粘贴成正文。
    if (image) return encodeImage(image);
    const raw = N.value(board, 'string'), text = raw == null ? '' : String(raw);
    if (!text.length) throw new Error('剪贴板中没有图片或文字，请先复制内容');
    if (text.length > MAX_TEXT) throw new Error('剪贴板文字过长，请分段粘贴');
    return { text: text, type: 'text/plain' };
  }
  function cancel(controller) {
    const operation = controller.clipboardOperation; if (!operation) return;
    controller.clipboardOperation = null;
    if (operation.source) operation.source.cancel();
    T.evaluate(controller, PREFIX + '&&' + PREFIX + '.cancel(' + JSON.stringify(operation.token) + ')').catch(function () {});
  }
  async function start(controller, scope) {
    if (!__JFJC_SETTINGS__.showUpload()) throw new Error('上传已在设置中关闭');
    if (controller.clipboardOperation) throw new Error('上一次上传仍在添加中，请稍候');
    if (!/^composer-[1-9]\d{0,8}$/.test(String(scope))) throw new Error('对话输入框标识无效');
    const selectedSource = __JFJC_SETTINGS__.uploadSource(), handwriting = selectedSource === 'handwriting';
    // 在任何网页异步读取前固定实际单选和最后一条手写批注。
    const source = handwriting ? __JFJC_HANDWRITING__.capture(controller.addon) : null;
    const operation = { token: 'record-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), handwriting: Boolean(source), source: source };
    controller.clipboardOperation = operation;
    const token = JSON.stringify(operation.token);
    function guard() {
      if (controller.clipboardOperation !== operation || !__JFJC_SETTINGS__.showUpload()) throw new Error('上传已取消');
      if (__JFJC_SETTINGS__.uploadSource() !== selectedSource) throw new Error('上传来源已切换，请重新点击上传');
      if (controller.visible === false || controller.activePage && controller.activePage !== 'math') throw new Error('面板已关闭或切换，上传已取消');
      if (source) source.validate();
    }
    let target, type = '';
    async function accepted(code, fallback) {
      guard();
      // 在网页端把布尔结果转换为字符串，避免宿主将 true 桥接为 NSNumber 的 1。
      const result = await T.evaluate(controller, '(function(){return (' + code + ')?"accepted":"rejected";})()'); guard();
      if (String(result) !== 'accepted') {
        const state = JSON.parse(String(await T.evaluate(controller, 'JSON.stringify(' + PREFIX + '.read(' + token + '))'))); guard();
        const problem = String(await T.evaluate(controller, PREFIX + '.reason(' + JSON.stringify(target) + ',' + JSON.stringify(type) + ',' + Boolean(source) + ')') || ''); guard();
        throw new Error(state.status === 'error' && state.error || problem || fallback);
      }
    }
    try {
      target = JSON.parse(String(await T.evaluate(controller, 'JSON.stringify(' + PREFIX + '&&' + PREFIX + '.context(' + JSON.stringify(scope) + '))')));
      guard(); if (!target || target.composer !== String(scope)) throw new Error('请在当前对话打开目标输入框后重试');
      const problem = String(await T.evaluate(controller, PREFIX + '.reason(' + JSON.stringify(target) + ',' + JSON.stringify(source ? 'image/png' : '') + ',' + Boolean(source) + ')') || ''); guard();
      if (problem) throw new Error(problem);
      const content = source ? await source.content(controller) : clipboardContent(); guard(); type = content.type;
      const isText = type === 'text/plain', data = isText ? content.text : content.base64;
      const name = isText ? '粘贴文字' : (source ? '卡片手写-' : '粘贴图片-') + operation.token + (type === 'image/jpeg' ? '.jpg' : '.png');
      await accepted(PREFIX + '.prepare(' + [target, operation.token, type, name, data.length, Boolean(source)].map(JSON.stringify).join(',') + ')', '内容暂时无法接收，请稍候再试');
      for (let offset = 0; offset < data.length; offset += 65536) {
        await accepted(PREFIX + '.append(' + token + ',' + offset + ',' + JSON.stringify(data.slice(offset, offset + 65536)) + ')', '内容分块接收失败，请重新上传');
      }
      await accepted(PREFIX + '.commit(' + token + ')', '内容未能添加，请重新上传');
      const deadline = Date.now() + 65000;
      while (Date.now() < deadline) {
        guard(); const result = JSON.parse(String(await T.evaluate(controller, 'JSON.stringify(' + PREFIX + '.read(' + token + '))'))); guard();
        if (result.status === 'uploaded') { N.show(controller.addon, '图片已上传到当前对话附件，请点击发送'); return true; }
        if (result.status === 'pasted') { N.show(controller.addon, '文字已粘贴到输入框'); return true; }
        if (result.status === 'error' || result.status === 'cancelled') throw new Error(result.error || '上传未完成');
        await N.delay(0.2);
      }
      throw new Error(isText ? '尚未确认文字粘贴，请检查输入框' : '尚未确认图片上传，请检查当前对话附件后再重试');
    } finally {
      if (controller.clipboardOperation === operation) { cancel(controller); }
    }
  }
  return { start: start, cancel: cancel, clipboardImage: clipboardImage, encodeImage: encodeImage };
})();
