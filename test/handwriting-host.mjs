import vm from 'node:vm';
import fs from 'node:fs';
import { handwritingPageHTML } from '../scripts/web-bundle.mjs';

// 运行安装包实际的官方媒体页面；只替换宿主、网络和画布边界。
export function officialMediaHost(h, note, png) {
  const fixture = { reads: [], panels: [], calls: [], revoked: [], painted: [], images: new Map(), beforeImage() {}, responseType: 'image/png', status: 200, mindmapPNG: png, mindmapContentId: 'mindmap-ink' };
  h.database.getMediaByHash = () => { throw new Error('官方读取不应访问 drawing 媒体'); };
  h.host.AddonWebPanel = { panel() {
    const panel = {
      closed: false,
      loadPanel() {
        const manifest = JSON.parse(fs.readFileSync(new URL('../src/mnaddon.json', import.meta.url)));
        if (manifest.panel !== 'web-dist/HandwritingPage.html') return false;
        return panel.loadHTML(handwritingPageHTML());
      },
      loadHTML(html) {
        if (fixture.requirePresentation && !panel.shown) { panel.pendingHTML = html; return true; }
        const window = {
          addEventListener(name, callback) {
            if (name !== 'load') throw new Error('Unexpected page event: ' + name);
            queueMicrotask(callback);
          },
          mn: {
            async api(route, options) {
              fixture.calls.push({ route, options });
              if (fixture.apiError) return { error: { message: fixture.apiError } };
              const live = h.database.getNoteById(note.noteId);
              const parts = live ? live.comments.flatMap((c, index) => c.drawing ? [{ kind: 'ink', index: index + 1, contentId: 'sub-' + (index + 1) + '-image', renderable: true }] : typeof c.text === 'string' ? [{ kind: 'text', index: index + 1, contentId: 'sub-' + (index + 1) + '-text', text: c.text, format: 'markdown' }] : []) : [];
              if (!fixture.mindmapMissing) parts.push({ kind: 'ink', index: 99, noteid: note.noteId, source: 'mindmap', contentId: fixture.mindmapContentId, renderable: true });
              if (fixture.parts) fixture.parts(parts);
              return { items: [{ noteid: note.noteId, found: Boolean(live), parts }] };
            },
            async call(name, payload) { if (fixture.paused) return new Promise(() => {}); return panel.onMessage(name, payload); }
          }
        };
        class Image {
          constructor() { this.naturalWidth = fixture.width || 1024; this.naturalHeight = fixture.height || 787; }
          set src(value) { queueMicrotask(() => { fixture.beforeImage(); if (fixture.decodeError) this.onerror(); else this.onload(); }); }
        }
        class FileReader {
          async readAsDataURL(blob) {
            this.result = 'data:image/png;base64,' + Buffer.from(await blob.arrayBuffer()).toString('base64'); this.onload();
          }
        }
        const document = { getElementById: () => ({ textContent: '' }), createElement(tag) {
          if (tag !== 'canvas') throw new Error('Unexpected element: ' + tag);
          const canvas = {
            getContext: () => fixture.canvasError ? null : { fillRect(...args) { fixture.painted.push(['white', ...args]); }, drawImage(...args) { fixture.painted.push(['image', ...args.slice(1)]); } },
            toBlob(callback) { callback(fixture.blobError ? null : fixture.oversize ? { type: 'image/png', size: 11 * 1024 * 1024 } : new Blob([fixture.lastKind === 'mindmap' ? fixture.mindmapPNG : fixture.images.get(fixture.lastKind) || png], { type: 'image/png' })); }
          }; return canvas;
        } };
        const fetch = async (route, options) => {
          const expected = '/bridge/v1/notes/' + encodeURIComponent(note.noteId) + '/content/sub-3-image?maxEdge=2048';
          const brain = '/bridge/v1/notes/' + encodeURIComponent(note.noteId) + '/content/' + encodeURIComponent(fixture.mindmapContentId) + '?maxEdge=2048';
          const contentId = decodeURIComponent(route.split('/content/')[1]?.split('?')[0] || '');
          if (route !== expected && route !== brain && !fixture.images.has(contentId)) throw new Error('Unexpected media route: ' + route);
          if (options?.cache !== 'no-store') throw new Error('Media reads must bypass stale cache');
          fixture.lastKind = route === brain ? 'mindmap' : fixture.images.has(contentId) ? contentId : 'last'; fixture.reads.push(fixture.lastKind);
          return new Response(route === brain ? fixture.mindmapPNG : fixture.images.get(contentId) || png, { status: fixture.status, headers: { 'Content-Type': fixture.responseType } });
        };
        const URL = { createObjectURL: () => 'blob:official-ink', revokeObjectURL(url) { fixture.revoked.push(url); } };
        vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1], { window, document, Image, FileReader, URL, fetch });
      },
      showFloatingIn(study) {
        if (!study) throw new Error('缺少学习窗口');
        panel.shown = true;
        if (panel.pendingHTML) { const html = panel.pendingHTML; panel.pendingHTML = null; panel.loadHTML(html); }
      },
      hideFloating() { panel.hidden = true; panel.teardown(); },
      teardown() { panel.closed = true; }
    };
    fixture.panels.push(panel); return panel;
  } };
  return fixture;
}
