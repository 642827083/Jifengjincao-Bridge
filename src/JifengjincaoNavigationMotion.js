var __JFJC_NAVIGATION_MOTION__ = (function () {
  function stop(view, key) {
    if (view && view.layer && typeof view.layer.removeAnimationForKey === 'function') view.layer.removeAnimationForKey(key);
  }
  function animate(view, path, from, to, duration, key) {
    const layer = view && view.layer;
    if (!layer || typeof layer.addAnimationForKey !== 'function' || typeof layer.removeAnimationForKey !== 'function'
        || typeof CABasicAnimation === 'undefined' || typeof CABasicAnimation.animationWithKeyPath !== 'function'
        || typeof CAMediaTimingFunction === 'undefined' || typeof CAMediaTimingFunction.functionWithControlPoints !== 'function'
        || typeof CATransaction === 'undefined' || typeof CATransaction.begin !== 'function'
        || typeof CATransaction.commit !== 'function' || typeof CATransaction.setAnimationDuration !== 'function') return;
    try {
      const animation = CABasicAnimation.animationWithKeyPath(path);
      if (!animation) return;
      animation.fromValue = from; animation.toValue = to;
      animation.timingFunction = CAMediaTimingFunction.functionWithControlPoints(0.32, 0.72, 0, 1);
      CATransaction.begin();
      try { CATransaction.setAnimationDuration(duration); layer.addAnimationForKey(animation, key); }
      finally { CATransaction.commit(); }
    } catch (error) { console.log('[Jifengjincao Bridge] 导航动画未启用：' + String(error.message || error)); }
  }
  function move(view, target, animated, key, duration) {
    const previous = view.frame;
    const unchanged = previous.x === target.x && previous.y === target.y && previous.width === target.width && previous.height === target.height;
    if (unchanged && animated) return;
    let from = previous.x + previous.width / 2;
    // 快速连续切换时从屏幕上的实际位置继续，避免跳到上次目标。
    if (animated && typeof view.layer.presentationLayer === 'function') {
      try {
        const presentation = view.layer.presentationLayer();
        if (presentation && presentation.position && Number.isFinite(Number(presentation.position.x))) from = Number(presentation.position.x);
      } catch (_) { /* 呈现层不可用时使用上次布局位置。 */ }
    }
    stop(view, key); view.frame = target;
    if (animated && previous.width > 0) animate(view, 'position.x', from, target.x + target.width / 2, duration, key);
  }
  return { stop: stop, animate: animate, move: move };
})();
