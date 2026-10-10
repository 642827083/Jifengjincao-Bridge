(function () {
  'use strict';
  if (window.__JFJC_LAYOUT__) return;
  const css = `
    .paper-center-page[data-jfjc-library] .paper-stack-directory[data-jfjc-directory] .paper-stack-group[data-jfjc-stack] .paper-stack-stage:not(.jfjc-measure-stage) {
      height: var(--jfjc-stack-height, 320px);
      --stack-row-rest-step: 0px;
    }
    .paper-center-page[data-jfjc-library] .paper-stack-directory[data-jfjc-directory] .paper-stack-group.jfjc-row-expanded .paper-stack-stage:not(.jfjc-measure-stage) {
      height: var(--jfjc-stack-open-height, 426px);
      --stack-row-rest-step: var(--jfjc-row-rest-step, 14px);
    }
    .paper-center-page[data-jfjc-library] .paper-stack-directory[data-jfjc-directory] .paper-stack-meta h2 {
      min-height: 1.2em;
    }
    .paper-center-page[data-jfjc-library] .paper-stack-directory[data-jfjc-directory] .paper-stack-entries {
      width: min(100%, calc(360px * var(--desktop-ui-density, 1)));
      min-width: 0;
    }
    .paper-center-page[data-jfjc-library] .paper-stack-directory[data-jfjc-directory] .paper-stack-entry-list {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(44px, calc((100% - (var(--jfjc-entry-columns, 5) - 1) * 8px) / var(--jfjc-entry-columns, 5)));
      justify-content: start;
      gap: 8px;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      padding: 3px 0;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
    }
    .paper-center-page[data-jfjc-library] .paper-stack-directory[data-jfjc-directory] .paper-stack-entry-list .paper-stack-entry {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      min-height: 44px;
      padding: 8px 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-variant-numeric: tabular-nums;
    }
  `;
  let observer, installed = false, scheduled = false;
  function readStyle(element) { return typeof window.getComputedStyle === 'function' ? window.getComputedStyle(element) : null; }
  function setAttribute(element, key, value) { if (element.getAttribute(key) !== value) element.setAttribute(key, value); }
  function setProperty(element, key, value) { if (element.style.getPropertyValue(key) !== value) element.style.setProperty(key, value); }
  function measure(group, twoRows) {
    // 在原网站样式下测量空封面区，不复制图片，也不把探针纳入本插件的覆盖规则。
    const probe = document.createElement('div');
    probe.className = 'paper-stack-stage jfjc-measure-stage' + (twoRows ? ' has-two-rows' : '');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
    group.appendChild(probe);
    const style = readStyle(probe), height = style && parseFloat(style.height);
    const rest = style && style.getPropertyValue('--stack-row-rest-step');
    probe.remove();
    return { height: height > 0 ? height : twoRows ? 426 : 320, rest: rest || '14px' };
  }
  function expandRows(directory) {
    const groups = Array.from(directory.children).filter(function (group) { return group.matches('.paper-stack-group'); });
    const hover = typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const rows = groups.filter(function (group) {
      const stage = group.querySelector('.paper-stack-stage.has-two-rows');
      if (!stage) return false;
      // 触屏网站会把选择模式的封面也叠在一起，实际没有第二排时继续保持同高。
      const first = stage.querySelector('article');
      const visibleRow = first && Array.from(stage.children).some(function (card) {
        const style = readStyle(card);
        return card.tagName === 'ARTICLE' && card.style.getPropertyValue('--stack-row') === '1' && style && style.visibility !== 'hidden' && card.getBoundingClientRect().top > first.getBoundingClientRect().top + 30;
      });
      const focused = document.activeElement && group.contains(document.activeElement);
      return (stage.classList.contains('is-selection-mode') && (hover || visibleRow)) || (hover && (stage.matches(':hover') || focused || group.classList.contains('is-open')));
    }).map(function (group) { return group.getBoundingClientRect().top; });
    groups.forEach(function (group) {
      const top = group.getBoundingClientRect().top;
      group.classList.toggle('jfjc-row-expanded', rows.some(function (row) { return Math.abs(row - top) < 2; }));
    });
  }
  function observe() {
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-expanded'] });
  }
  function refresh() {
    if (!installed || !document.body) return;
    observer.disconnect();
    try {
      document.querySelectorAll('.paper-center-page .paper-stack-directory').forEach(function (directory) {
        const group = directory.querySelector('.paper-stack-group'); if (!group) return;
        setAttribute(directory.closest('.paper-center-page'), 'data-jfjc-library', '');
        setAttribute(directory, 'data-jfjc-directory', '');
        const base = measure(group, false), expanded = measure(group, true);
        setProperty(directory, '--jfjc-stack-height', base.height + 'px');
        setProperty(directory, '--jfjc-stack-open-height', Math.max(base.height, expanded.height) + 'px');
        setProperty(directory, '--jfjc-row-rest-step', expanded.rest);
        directory.querySelectorAll('.paper-stack-group').forEach(function (item) { setAttribute(item, 'data-jfjc-stack', ''); });
        directory.querySelectorAll('.paper-stack-entry-list').forEach(function (list) {
          setProperty(list, '--jfjc-entry-columns', String(Math.max(1, Math.min(5, list.children.length))));
        });
        expandRows(directory);
      });
    } finally { observe(); }
  }
  function schedule() {
    if (scheduled) return; scheduled = true;
    window.setTimeout(function () { scheduled = false; refresh(); }, 50);
  }
  function install() {
    if (installed) { refresh(); return; }
    if (!document.body) return;
    const style = document.createElement('style'); style.id = 'jfjc-library-style'; style.textContent = css; document.head.appendChild(style);
    observer = new MutationObserver(schedule); installed = true;
    // 只在布局或交互变化时重新测量，避免导入进度刷新引发重复工作。
    document.addEventListener('mouseover', schedule, true); document.addEventListener('mouseout', schedule, true);
    document.addEventListener('focusin', schedule, true); document.addEventListener('focusout', schedule, true);
    window.addEventListener('resize', schedule); window.addEventListener('orientationchange', schedule);
    refresh();
  }
  window.__JFJC_LAYOUT__ = { install: install, refresh: refresh };
})();
