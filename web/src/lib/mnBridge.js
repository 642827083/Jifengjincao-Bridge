const MNBridge = (function () {
  const pending = {};
  window.__JFJC_BRIDGE_RECEIVE__ = function (response) {
    const request = pending[response.requestId]; if (!request) return;
    delete pending[response.requestId]; window.clearTimeout(request.timer);
    if (response.error) request.reject(new Error(response.error.message)); else request.resolve(response.payload);
  };
  function send(command, payload) {
    if (window.mn && typeof window.mn.call === 'function') return window.mn.call(command, payload || {});
    const requestId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    return new Promise(function (resolve, reject) {
      // 导入任务持续显示进度，等待原生返回最终结果；普通命令提供超时恢复入口。
      const timer = command === 'importQuestions' ? null : window.setTimeout(function () { delete pending[requestId]; reject(new Error('操作超时，请稍后刷新重试')); }, 200000);
      pending[requestId] = { resolve: resolve, reject: reject, timer: timer };
      const frame = document.createElement('iframe'); frame.hidden = true;
      frame.src = 'mnaddon://bridge?payload=' + encodeURIComponent(JSON.stringify({ requestId: requestId, command: command, payload: payload || {} }));
      document.body.appendChild(frame); window.setTimeout(function () { frame.remove(); }, 800);
    });
  }
  return { send: send };
})();
export default MNBridge;
