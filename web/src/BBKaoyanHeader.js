(function () {
  'use strict';
  if (window.location.origin !== 'https://bbkaoyan.cn') return;
  if (window.__JFJC_HEADER__) { window.__JFJC_HEADER__.refresh(); return; }
  const css = `
    .topbar[data-jfjc-compact] { flex-direction:row; flex-wrap:nowrap; align-items:center; justify-content:flex-start; gap:10px; padding:6px 16px; min-height:56px; }
    .topbar[data-jfjc-compact]>.brand { flex:0 0 auto; gap:6px; order:0; white-space:nowrap; }
    .topbar[data-jfjc-compact] .brand-mark { width:30px; height:30px; flex:0 0 30px; }
    .topbar[data-jfjc-compact] .brand-wordmark { width:100px; height:auto; }
    .topbar[data-jfjc-compact]>.topbar-actions { display:flex; flex:1 1 auto; width:auto; min-width:0; gap:12px; margin-left:auto; order:1; }
    .topbar[data-jfjc-compact] .topbar-actions>.primary-nav { display:flex!important; flex-wrap:nowrap; gap:4px; }
    .topbar[data-jfjc-compact] .primary-nav-group { flex:0 0 auto; }
    .topbar[data-jfjc-compact] .primary-nav-trigger,.topbar[data-jfjc-compact] .primary-nav>a { white-space:nowrap; word-break:keep-all; flex:0 0 auto; padding:0 8px; min-height:42px; font-size:14px; }
    .topbar[data-jfjc-compact] #jfjc-toolbar { flex:0 0 auto; }
    .topbar[data-jfjc-compact] #jfjc-toolbar button { white-space:nowrap; padding:6px 8px; }
    .topbar[data-jfjc-compact]>.jfjc-search-toggle { display:inline-flex; align-items:center; justify-content:center; flex:0 0 42px; width:42px; height:42px; padding:10px; border:0; border-radius:9px; background:transparent; color:inherit; order:2; cursor:pointer; }
    .topbar[data-jfjc-compact]>.jfjc-search-toggle svg { width:20px; height:20px; }
    .topbar[data-jfjc-compact]>.topbar-search-slot { position:absolute; top:calc(100% + 8px); right:16px; left:auto; width:min(420px,calc(100vw - 32px)); min-width:0; margin:0; z-index:40; visibility:hidden; pointer-events:none; }
    .topbar[data-jfjc-compact][data-jfjc-search-open]>.topbar-search-slot { visibility:visible; pointer-events:auto; }
    .topbar[data-jfjc-compact] .topbar-search { width:100%; height:44px; background:var(--background,#fff); box-shadow:0 8px 24px rgba(30,45,60,.12); }
    .topbar[data-jfjc-compact] .topbar-search-input { font-size:16px; }
    .topbar[data-jfjc-compact]>.topbar-notices { flex:0 1 auto; margin:0; order:3; }
    .topbar[data-jfjc-compact] [data-jfjc-group-notice],.topbar[data-jfjc-compact]>.topbar-notices[data-jfjc-empty-notices] { display:none!important; }
    @media(max-width:760px) {
      .topbar[data-jfjc-compact] { flex-wrap:wrap; gap:4px 10px; padding:6px 12px; }
      .topbar[data-jfjc-compact]>.jfjc-search-toggle { margin-left:auto; }
      .topbar[data-jfjc-compact]>.topbar-actions { order:4; flex:1 0 100%; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:4px 6px; }
      .topbar[data-jfjc-compact] .topbar-actions>.primary-nav { grid-column:1 / -1; grid-row:1; flex-wrap:wrap; gap:2px; }
      .topbar[data-jfjc-compact] .topbar-actions>#jfjc-toolbar { grid-column:1; grid-row:2; }
      .topbar[data-jfjc-compact] .topbar-actions>.topbar-user { grid-column:2; grid-row:2; justify-self:end; }
    }
  `;
  let scheduled = false;
  function mark(node, name, on) {
    if (on && !node.hasAttribute(name)) node.setAttribute(name, '');
    else if (!on && node.hasAttribute(name)) node.removeAttribute(name);
  }
  function setOpen(header, open) {
    if (open) header.setAttribute('data-jfjc-search-open', ''); else header.removeAttribute('data-jfjc-search-open');
    const toggle = header.querySelector('.jfjc-search-toggle');
    if (toggle) { toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? '收起搜索' : '展开搜索'); }
    if (open) { const input = header.querySelector('.topbar-search-slot input'); if (input) input.focus(); }
  }
  function refresh() {
    const header = document.querySelector('.topbar'); if (!header) return;
    if (!document.getElementById('jfjc-header-style')) {
      const style = document.createElement('style'); style.id = 'jfjc-header-style'; style.textContent = css; document.head.appendChild(style);
    }
    mark(header, 'data-jfjc-compact', true);
    const slot = header.querySelector('.topbar-search-slot'), input = slot && slot.querySelector('input');
    let toggle = header.querySelector('.jfjc-search-toggle');
    if (input && !toggle) {
      toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'jfjc-search-toggle';
      const icon = slot.querySelector('.topbar-search-icon,svg');
      if (icon && icon.querySelector('path,circle,line,polyline,use')) { const copy = icon.cloneNode(true); copy.setAttribute('aria-hidden', 'true'); toggle.appendChild(copy); } else toggle.textContent = '搜';
      toggle.addEventListener('click', function () { setOpen(header, !header.hasAttribute('data-jfjc-search-open')); });
      header.appendChild(toggle);
      setOpen(header, header.hasAttribute('data-jfjc-search-open'));
    }
    if (!input && toggle) { toggle.remove(); header.removeAttribute('data-jfjc-search-open'); }
    // 只隐藏明确的群信息，轮播中的赞助及其他通知仍由网站展示。
    const notices = header.querySelector('.topbar-notices');
    if (notices) {
      const rows = Array.from(notices.querySelectorAll('.topbar-support'));
      rows.forEach(function (row) {
        mark(row, 'data-jfjc-group-notice', /(?:交流|售后|QQ|Q Q)群|群号/.test(row.textContent || ''));
      });
      mark(notices, 'data-jfjc-empty-notices', rows.length && rows.every(function (row) { return row.hasAttribute('data-jfjc-group-notice'); }));
    }
  }
  function schedule() {
    if (scheduled) return; scheduled = true;
    window.setTimeout(function () { scheduled = false; refresh(); }, 50);
  }
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    const header = document.querySelector('.topbar[data-jfjc-search-open]');
    if (header) { setOpen(header, false); const button = header.querySelector('.jfjc-search-toggle'); if (button) button.focus(); }
  });
  document.addEventListener('pointerdown', function (event) {
    const header = document.querySelector('.topbar[data-jfjc-search-open]');
    if (header && !header.contains(event.target)) setOpen(header, false);
  });
  // 原站 React 重建导航时重用原输入框和事件，不自行接管搜索请求。
  new MutationObserver(function (records) {
    if (records.some(function (record) {
      const node = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      return node && (node.closest('.topbar') || Array.from(record.addedNodes || []).some(function (added) { return added.nodeType === 1 && (added.matches('.topbar') || added.querySelector('.topbar')); }));
    })) schedule();
  }).observe(document.documentElement, { childList:true, subtree:true, characterData:true });
  window.__JFJC_HEADER__ = { refresh:refresh }; refresh();
})();
