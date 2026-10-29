(function () {
  const MAX = 10 * 1024 * 1024;
  function latest(note, index) {
    const parts = (note.parts || []).filter(function (part) { return part.kind === 'ink' && !part.source && Number.isSafeInteger(part.index) && part.index > 0; });
    parts.sort(function (a, b) { return a.index - b.index; });
    const part = parts[parts.length - 1];
    if (!part || part.index !== index || !part.contentId || !part.renderable) throw new Error('最后一条手写批注已变化或尚未保存，请重新上传');
    return part;
  }
  async function readNote(noteId) {
    const reply = await window.mn.api('/notes/batch-get', { method: 'POST', body: { noteIds: [noteId] } });
    if (reply.error) throw new Error(reply.error.message || reply.error.code);
    const note = reply.items && reply.items[0];
    if (!note || note.noteid !== noteId || note.found === false) throw new Error('所选卡片已删除或无法读取');
    return note;
  }
  async function whitePNG(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const image = await new Promise(function (resolve, reject) {
        const picture = new Image(); picture.onload = function () { resolve(picture); }; picture.onerror = function () { reject(new Error('官方手写图片无法解码')); }; picture.src = url;
      });
      const width = image.naturalWidth, height = image.naturalHeight;
      if (!width || !height || width > 4096 || height > 4096) throw new Error('官方手写图片尺寸无效');
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const painter = canvas.getContext('2d'); if (!painter) throw new Error('无法处理手写图片透明背景');
      // 官方已完成笔迹渲染，此处只补白底，不解析或重画笔迹。
      painter.fillStyle = '#ffffff'; painter.fillRect(0, 0, width, height); painter.drawImage(image, 0, 0);
      const png = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); });
      if (!png || png.type !== 'image/png' || !png.size || png.size > MAX) throw new Error('手写图片生成失败或超过网站 10 MiB 限制');
      return png;
    } finally { URL.revokeObjectURL(url); }
  }
  async function read() {
    let input;
    function send(data) { return MNBridge.send('receiveHandwriting', Object.assign({ token: input.token }, data)); }
    try {
      if (!window.mn || typeof window.mn.api !== 'function') throw new Error('当前 MN 缺少官方媒体接口，请更新 MN');
      // 页面先握手获取固定来源，避免把读取任务投递给尚未初始化的页面。
      input = await MNBridge.send('receiveHandwriting', { phase: 'ready' });
      if (!input || typeof input.token !== 'string') throw new Error('官方媒体页面未能连接插件，请重新打开插件后重试');
      const note = await readNote(input.noteId), part = latest(note, input.index);
      const route = '/notes/' + encodeURIComponent(input.noteId) + '/content/' + encodeURIComponent(part.contentId) + '?maxEdge=2048';
      await send({ phase: 'progress', stage: 'media' });
      const response = await fetch('/bridge/v1' + route), blob = await response.blob();
      if (!response.ok || blob.type.split(';')[0] !== 'image/png') throw new Error('官方接口未返回手写 PNG，请确认笔迹已保存');
      if (!blob.size || blob.size > MAX) throw new Error('官方手写图片为空或超过 10 MiB');
      await send({ phase: 'progress', stage: 'background' });
      const png = await whitePNG(blob), current = latest(await readNote(input.noteId), input.index);
      if (current.contentId !== part.contentId) throw new Error('手写批注已变化，请重新上传');
      const encoded = await new Promise(function (resolve, reject) {
        const reader = new FileReader(); reader.onload = function () { resolve(String(reader.result).split(',')[1] || ''); }; reader.onerror = function () { reject(new Error('官方手写图片读取失败')); }; reader.readAsDataURL(png);
      });
      await send({ phase: 'begin', noteId: input.noteId, index: input.index, bytes: png.size, length: encoded.length });
      for (let offset = 0; offset < encoded.length; offset += 65536) await send({ phase: 'chunk', offset: offset, text: encoded.slice(offset, offset + 65536) });
      await send({ phase: 'finish' });
    } catch (error) {
      document.getElementById('status').textContent = String(error.message || error);
      try { if (input && input.token) await send({ phase: 'error', message: String(error.message || error) }); } catch (ignored) {}
    }
  }
  if (document.readyState === 'complete') read();
  else window.addEventListener('load', read, { once: true });
})();
