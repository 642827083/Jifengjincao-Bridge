var __JFJC_CLIPBOARD__ = (function () {
  const N = __JFJC_NATIVE__, T = __JFJC_TRANSPORT__, PREFIX = 'window.__JFJC_REVIEW__', MAX = 10 * 1024 * 1024;
  function clipboardImage() {
    if (typeof UIPasteboard === 'undefined' || typeof UIPasteboard.generalPasteboard !== 'function') throw new Error('当前 MN 版本缺少图片剪贴板接口');
    const image = N.value(UIPasteboard.generalPasteboard(), 'image');
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
  function cancel(controller) {
    const operation = controller.clipboardOperation; if (!operation) return;
    controller.clipboardOperation = null;
    T.evaluate(controller, PREFIX + '&&' + PREFIX + '.cancel(' + JSON.stringify(operation.token) + ')').catch(function () {});
  }
  async function start(controller, scope) {
    if (controller.clipboardOperation) throw new Error('上一张图片仍在添加中，请稍候');
    if (!/^composer-[1-9]\d{0,8}$/.test(String(scope))) throw new Error('对话输入框标识无效');
    const operation = { token: 'record-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) };
    controller.clipboardOperation = operation;
    const token = JSON.stringify(operation.token);
    function guard() { if (controller.clipboardOperation !== operation) throw new Error('图片添加已取消'); }
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
      target = JSON.parse(String(await T.evaluate(controller, 'JSON.stringify(' + PREFIX + '&&' + PREFIX + '.context(' + JSON.stringify(scope) + '))')));
      guard(); if (!target || target.composer !== String(scope)) throw new Error('请在当前对话打开目标输入框后重试');
      const problem = String(await T.evaluate(controller, PREFIX + '.reason(' + JSON.stringify(target) + ')') || ''); guard();
      if (problem) throw new Error(problem);
      const image = clipboardImage(), name = '粘贴图片-' + operation.token + (image.type === 'image/png' ? '.png' : '.jpg');
      await accepted(PREFIX + '.prepare(' + [target, operation.token, image.type, name, image.base64.length].map(JSON.stringify).join(',') + ')', '图片暂时无法接收，请稍候再试');
      for (let offset = 0; offset < image.base64.length; offset += 65536) {
        await accepted(PREFIX + '.append(' + token + ',' + offset + ',' + JSON.stringify(image.base64.slice(offset, offset + 65536)) + ')', '图片分块接收失败，请重新粘贴');
      }
      await accepted(PREFIX + '.commit(' + token + ')', '图片未能加入附件，请重新粘贴');
      const deadline = Date.now() + 65000;
      while (Date.now() < deadline) {
        guard(); const result = JSON.parse(String(await T.evaluate(controller, 'JSON.stringify(' + PREFIX + '.read(' + token + '))'))); guard();
        if (result.status === 'uploaded') { N.show(controller.addon, '图片已上传到当前对话附件，请点击发送'); return true; }
        if (result.status === 'error' || result.status === 'cancelled') throw new Error(result.error || '图片上传未完成');
        await N.delay(0.2);
      }
      throw new Error('尚未确认图片上传，请检查当前对话附件后再重试');
    } finally {
      if (controller.clipboardOperation === operation) { cancel(controller); }
    }
  }
  return { start: start, cancel: cancel, clipboardImage: clipboardImage };
})();
