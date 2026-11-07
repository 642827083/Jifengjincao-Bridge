(function () {
  const MAX = 10 * 1024 * 1024, MAX_TEXT = 1024 * 1024;
  function cleanText(text) {
    return text.replace(/<!--[\s\S]*?-->/g, '').replace(/\[查看原题\]\([^\r\n)]*\)/g, '').trim();
  }
  function firstContent(note) {
    const parts = (note.parts || []).filter(function (part) {
      return part.kind !== 'title' && part.source !== 'mindmap' && Number.isSafeInteger(part.index) && part.index >= 0
        && !(part.index === 0 && /^(text|rich_text)$/.test(part.kind) && typeof part.text === 'string' && !part.text.trim() && !part.truncated);
    });
    if (!parts.length) throw new Error('来源卡片首条没有可附带的图文内容');
    const index = Math.min.apply(Math, parts.map(function (part) { return part.index; }));
    const group = parts.filter(function (part) { return part.index === index; }), texts = [], images = [], seen = new Set();
    group.forEach(function (part) {
      if (part.truncated) throw new Error('来源卡片首条文字未完整返回，请缩减内容后重试');
      if (/^(text|rich_text)$/.test(part.kind) && typeof part.text === 'string') texts.push(cleanText(part.text));
      else if (/^(image|excerpt_image|ink)$/.test(part.kind) && !part.source && part.contentId && part.renderable) {
        if (!seen.has(part.contentId)) { images.push(part); seen.add(part.contentId); }
      } else throw new Error('来源卡片首条包含无法读取的图片或不支持的内容');
    });
    let text = texts.filter(Boolean).join('\n\n');
    if (/!\[[^\]]*\]\(/.test(text)) {
      if (!images.length) throw new Error('来源卡片首条图片未通过官方接口返回，请先保存图片');
      text = text.replace(/!\[[^\]]*\]\([^\r\n)]*\)/g, '').trim();
    }
    if (!text && !images.length) throw new Error('来源卡片首条没有可附带的图文内容');
    if (text.length > MAX_TEXT) throw new Error('来源卡片首条文字过长，请缩减后重试');
    if (images.length > 4) throw new Error('首条图片与脑图手写合计超过 5 个附件，请缩减图片后重试');
    const signature = JSON.stringify(group.map(function (part) { return [part.index, part.kind, part.contentId || '', part.text || '', part.renderable, part.truncated, part.source || '']; }));
    return { text: text, images: images, signature: signature };
  }
  function selectedPart(note, input) {
    if (input.source === 'mindmap') {
      const parts = (note.parts || []).filter(function (part) { return part.kind === 'ink' && part.source === 'mindmap'; });
      const part = parts[0];
      if (parts.length !== 1 || !part.contentId || !part.renderable || part.noteid !== input.noteId) throw new Error('来源卡片没有可读取的脑图手写或来源不唯一，请先保存脑图笔迹后重试');
      return part;
    }
    const parts = (note.parts || []).filter(function (part) { return part.kind === 'ink' && !part.source && Number.isSafeInteger(part.index) && part.index > 0; });
    parts.sort(function (a, b) { return a.index - b.index; });
    const part = parts[parts.length - 1];
    if (!part || part.index !== input.index || !part.contentId || !part.renderable) throw new Error('最后一条手写批注已变化或尚未保存，请重新上传');
    return part;
  }
  async function readNote(noteId) {
    const reply = await window.mn.api('/notes/batch-get', { method: 'POST', body: { noteIds: [noteId] } });
    if (reply.error) throw new Error(reply.error.message || reply.error.code);
    const note = reply.items && reply.items[0];
    if (!note || note.noteid !== noteId || note.found === false) throw new Error('所选卡片已删除或无法读取');
    return note;
  }
  async function readPNG(route, allowImage) {
    const response = await fetch('/bridge/v1' + route, { cache: 'no-store' }), blob = await response.blob();
    if (!response.ok || !(allowImage ? /^image\/(png|jpeg|webp|gif)$/.test(blob.type.split(';')[0]) : blob.type.split(';')[0] === 'image/png')) throw new Error('官方接口未返回手写 PNG 或首条图片，请确认内容已保存');
    if (!blob.size || blob.size > MAX) throw new Error('官方手写图片为空或超过 10 MiB');
    return blob;
  }
  async function encodePNG(png) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader(); reader.onload = function () { resolve(String(reader.result).split(',')[1] || ''); }; reader.onerror = function () { reject(new Error('官方手写图片读取失败')); }; reader.readAsDataURL(png);
    });
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
      const note = await readNote(input.noteId), part = input.source === 'clipboard' ? null : selectedPart(note, input), extra = input.attachFirst ? firstContent(note) : null;
      const records = [], files = []; let bytes = 0;
      for (const item of (part ? [part] : []).concat(extra ? extra.images : [])) {
        const route = '/notes/' + encodeURIComponent(input.noteId) + '/content/' + encodeURIComponent(item.contentId) + '?maxEdge=2048';
        await send({ phase: 'progress', stage: 'media' });
        const blob = await readPNG(route, item !== part);
        await send({ phase: 'progress', stage: 'background' });
        const png = await whitePNG(blob); bytes += png.size;
        if (bytes > MAX) throw new Error('本次图片合计超过 10 MiB，请缩减首条图片后重试');
        files.push({ name: item !== part ? '卡片图片' : input.source === 'mindmap' ? '脑图手写' : '卡片手写', base64: await encodePNG(png), bytes: png.size }); records.push({ route: route, blob: blob, allowImage: item !== part });
      }
      if (input.source === 'mindmap' || extra) {
        // 脑图媒体标识不会随笔迹更新；再次读取原始 PNG 比较，避免仅比较标识而漏掉内容变化。
        for (const record of records) {
          await send({ phase: 'progress', stage: 'media' });
          const verified = await readPNG(record.route, record.allowImage), before = new Uint8Array(await record.blob.arrayBuffer()), after = new Uint8Array(await verified.arrayBuffer());
          if (before.length !== after.length || before.some(function (byte, index) { return byte !== after[index]; })) throw new Error('脑图手写已变化或首条图片已变化，请重新上传');
        }
      }
      const currentNote = await readNote(input.noteId), current = part ? selectedPart(currentNote, input) : null;
      if (part && (current.contentId !== part.contentId || current.index !== part.index)) throw new Error('手写来源已变化，请重新上传');
      if (extra && firstContent(currentNote).signature !== extra.signature) throw new Error('卡片首条内容已变化，请重新上传');
      // 附件按题目在前、作答手写在后排列，读取及来源复核顺序保持不变。
      const encoded = extra ? JSON.stringify({ files: part ? files.slice(1).concat(files[0]) : files, text: extra.text }) : files[0].base64;
      await send({ phase: 'begin', noteId: input.noteId, index: input.index, bytes: bytes, length: encoded.length, format: extra ? 'bundle' : 'png' });
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
