(function () {
  const editor = document.getElementById('extra-text');
  let saved = '', revision = 0, ready = false, saving = false;
  editor.addEventListener('input', function () { revision++; });
  function sync(text) {
    // 原生刷新其他设置时，仅同步没有未保存修改的输入框。
    if (!ready || editor.value === saved) { editor.value = text; revision++; }
    saved = text;
  }
  async function submit() {
    if (!ready || saving) return;
    saving = true;
    const value = editor.value;
    try {
      const result = await MNBridge.send('saveExtraText', { revision: revision });
      saved = result.text;
      if (editor.value === value) { editor.value = saved; revision++; editor.blur(); }
    } catch (ignored) {
      // 保存失败由原生提示，保留当前草稿用于重试。
    } finally { saving = false; }
  }
  window.__JFJC_EXTRA_TEXT__ = { sync: sync, submit: submit, read: function (expectedRevision) {
    if (!ready || revision !== expectedRevision) throw new Error('文字已变化，请重新保存');
    return editor.value;
  } };
  MNBridge.send('getExtraText').then(function (result) {
    sync(result.text); ready = true; editor.disabled = false;
  }).catch(function () { editor.placeholder = '读取文字失败，请重新打开设置'; });
})();
