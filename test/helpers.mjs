import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { pageScriptSource } from '../scripts/web-bundle.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const source = file => fs.readFileSync(path.join(root, file), 'utf8');
export function envelope() {
  return { paper: { id: 237, subject: 'math1', kind: 'official', title: '2026 年数学一真题' }, questions: [
    { question_number: '2', display_order: 2, section_title: '一、选择题', question: { id: 5075, subject: 'math1', question_type: 'choice', stem: '函数 \\(f(x)\\) 的值', options: { A: '$1$', B: '$2$' }, correct_answer: 'A', explanation_latex: '\\[x=1\\]', assets: [] } },
    { question_number: '1', display_order: 1, section_title: '一、选择题', question: { id: 5074, subject: 'math1', question_type: 'choice', stem_latex: '计算 $x^2$。', options: { A: '$0$', B: '$1$' }, correct_answer: 'B', explanation_latex: '$$x=1$$', assets: [{ id: 369, usage: 'explanation', asset_type: 'image', url: '/api/question-assets/369', sort_order: 1 }] } }
  ] };
}
export function nativeHost() {
  let next = 1;
  const notes = new Map(), files = new Map(), prefs = new Map(), snapshots = [], hud = [];
  const notebook = { topicId: 'book-1', title: '我的学习集', notes: [] };
  let current = 'book-1';
  const notebookController = { get notebookId() { return current; }, focusNote: null };
  const flags = { imageFailure: false, partialImageFailure: false, childFailure: false, saveFailure: false };
  function sync() { notebook.notes = [...notes.values()].filter(n => !n.parentNote); }
  function rawNote(id, title) {
    const note = { noteId: id, noteTitle: title, comments: [], childNotes: [], mediaList: '', notebookId: 'book-1', parentNote: null,
      insertChildBefore(child, before) { detach(child); child.parentNote = note; note.childNotes.splice(note.childNotes.indexOf(before), 0, child); sync(); },
      sortCommentsByNewIndices(destinations) {
        const before = note.comments.slice();
        destinations.forEach((newIndex, oldIndex) => { note.comments[newIndex] = before[oldIndex]; });
      } };
    return note;
  }
  function detach(note) { if (note.parentNote) note.parentNote.childNotes = note.parentNote.childNotes.filter(n => n !== note); note.parentNote = null; }
  const database = {
    getNotebookById(id) { return id === 'book-1' ? notebook : null; },
    getNoteById(id) { return notes.get(id); },
    createNoteWithTitleTopicid(title, topicId) { if (topicId !== 'book-1') throw new Error('错误学习集'); const n = rawNote('note-' + next++, title); notes.set(n.noteId, n); sync(); return n; },
    deleteBookNoteTree(id) { const note = notes.get(id); if (!note) return; note.childNotes.slice().forEach(n => database.deleteBookNoteTree(n.noteId)); detach(note); notes.delete(id); sync(); }
  };
  function wrapper(note) {
    if (typeof note === 'string') note = notes.get(note);
    if (!note || !notes.has(note.noteId)) return undefined;
    return { note,
      appendMarkdownComment(text) { note.comments.push({ text }); },
      removeCommentByIndex(i) { note.comments.splice(i, 1); },
      addChild(child) { if (flags.childFailure) return; child = child.note || child; detach(child); child.parentNote = note; note.childNotes.push(child); sync(); },
      processMarkdownBase64Images() {
        if (flags.imageFailure) return false;
        let changed = false;
        note.comments.forEach(c => { let count = 0; c.text = c.text.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, match => {
          if (flags.partialImageFailure && count++ > 0) return match; changed = true; return 'marginnote-media://' + note.noteId + '/' + count;
        }); }); if (changed) note.mediaList = 'saved-media'; return changed;
      }
    };
  }
  function snapshot() { return [...notes.values()].map(n => ({ id: n.noteId, title: n.noteTitle, comments: structuredClone(n.comments), mediaList: n.mediaList, parent: n.parentNote?.noteId || null })); }
  const host = { console, Promise, Date, Math, JSON,
    MNNote: { new: wrapper },
    MNUtil: { getNoteById: id => notes.get(id), undoGrouping(work, topicId) { if (topicId !== 'book-1') throw new Error('撤销学习集错误'); snapshots.push(snapshot()); work(); }, getLocalDataByKey: key => prefs.get(key), setLocalDataByKey: (v,k) => prefs.set(k,v) },
    Application: { sharedInstance: () => ({ documentPath: '/documents', studyController: () => ({ notebookController }), showHUD: text => hud.push(text) }) },
    Database: { sharedInstance: () => database },
    NSTimer: { scheduledTimerWithTimeInterval(seconds, repeats, callback) { const id = setTimeout(callback, seconds > 1 ? seconds * 1000 : 0); return { invalidate: () => clearTimeout(id) }; } },
    NSUserDefaults: { standardUserDefaults: () => ({ setObjectForKey: (v,k) => prefs.set(k,v), objectForKey: k => prefs.get(k) }) },
    NSFileManager: { defaultManager: () => ({ fileExistsAtPath: p => files.has(p), createDirectoryAtPathWithIntermediateDirectoriesAttributes: p => (files.set(p, true), true) }) },
    NSData: { dataWithContentsOfFile: p => files.has(p) ? { json: files.get(p) } : null },
    NSJSONSerialization: { JSONObjectWithDataOptions: data => JSON.parse(data.json), dataWithJSONObjectOptions: value => ({ writeToFileAtomically(p, atomic) { if (!atomic || flags.saveFailure) return false; files.set(p, JSON.stringify(value)); return true; } }) }
  };
  const context = vm.createContext(host);
  for (const name of ['JifengjincaoNative', 'JifengjincaoNavigationMotion', 'JifengjincaoPanelNavigation', 'JifengjincaoSettingsNavigation', 'JifengjincaoSettings', 'BBKaoyanAdapter', 'BBKaoyanSourceLink', 'JifengjincaoCommentFold', 'BBKaoyanFormat', 'BBKaoyanImportStore', 'BBKaoyanTransport', 'JifengjincaoHandwriting', 'BBKaoyanClipboard', 'BBKaoyanImport', 'JifengjincaoCardLocatorUI', 'JifengjincaoCardLocator', 'JifengjincaoSingleImport', 'WebBridgeCommands']) vm.runInContext(source('src/' + name + '.js'), context, { filename: name });
  function undo() {
    const state = snapshots.pop(); notes.clear();
    state.forEach(s => { const n = rawNote(s.id, s.title); n.comments = s.comments; n.mediaList = s.mediaList; notes.set(s.id,n); });
    state.forEach(s => { if (s.parent) wrapper(notes.get(s.parent)).addChild(notes.get(s.id)); }); sync();
  }
  return { host, context, notes, files, flags, database, notebook, notebookController, snapshots, hud, undo, switchNotebook: id => { current = id; },
    repair(addon) { return context.__JFJC_SOURCE__.repair(addon).changed; },
    native: context.__JFJC_NATIVE__, adapter: context.__JFJC_ADAPTER__, format: context.__JFJC_FORMAT__, importer: context.__JFJC_IMPORT__, store: context.__JFJC_STORE__, transport: context.__JFJC_TRANSPORT__ };
}
export function browserHost(data = envelope(), responseFor, origin = 'https://bbkaoyan.cn') {
  const parsed = parseHTML('<html><head></head><body><header class="topbar"><div class="topbar-actions"><nav class="primary-nav"><div class="primary-nav-group"><button class="primary-nav-trigger">AI 组件</button></div></nav></div></header><article id="question-5074">题目</article></body></html>');
  Object.defineProperty(parsed.document, 'readyState', { value: 'complete', configurable: true });
  const location = { origin, pathname: '/papers/237', search: '', href: origin + '/papers/237' };
  const calls = [], errors = [], frames = [];
  const window = { document: parsed.document, location, innerHeight: 800, addEventListener() {} };
  Object.defineProperty(parsed.window.HTMLSelectElement.prototype, 'value', { configurable: true,
    get() { return Array.from(this.querySelectorAll('option')).find(option => option.hasAttribute('selected'))?.getAttribute('value') || this.querySelector('option')?.getAttribute('value') || ''; },
    set(value) { for (const option of this.querySelectorAll('option')) { if (option.getAttribute('value') === value) option.setAttribute('selected',''); else option.removeAttribute('selected'); } }
  });
  window.document.getElementById('question-5074').getBoundingClientRect = () => ({ top: 100, bottom: 400 });
  class FileReader {
    async readAsDataURL(blob) { try { const b = Buffer.from(await blob.arrayBuffer()); this.result = 'data:' + blob.type + ';base64,' + b.toString('base64'); this.onload(); } catch (e) { this.onerror(); } }
  }
  const fetch = async (url, options) => {
    calls.push({ url, options });
    if (responseFor) { const result = await responseFor(url, options); if (result) return result; }
    if (url.includes('/question-assets/')) return new Response(Buffer.from('png-sample'), { headers: { 'Content-Type': 'image/png' } });
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  };
  window.fetch = fetch;
  window.setTimeout = setTimeout; window.clearTimeout = clearTimeout;
  const append = window.document.body.appendChild.bind(window.document.body);
  window.document.body.appendChild = node => { if (node.tagName === 'IFRAME') frames.push(node.src); return append(node); };
  const context = vm.createContext({ window, document: window.document, MutationObserver: parsed.window.MutationObserver, URL, FileReader, AbortController,
    console: { log: text => errors.push(text), warn: text => errors.push(text) }, Date, Math, JSON, Promise, TypeError });
  vm.runInContext(pageScriptSource(), context);
  return { window, location, context, calls, frames, errors, runtime: window.__JFJC_PAGE__, document: window.document };
}
export async function tick() { await new Promise(resolve => setTimeout(resolve, 0)); }
// 复盘记录编号与题库题号属于不同身份，保持与网站左右分栏结构一致。
export function reviewPageHTML(questionId = 5684, reviewItemId = 29894) {
  return '<div class="review-workspace-grid"><section class="review-question-pane"><article class="review-question-card"><header class="review-question-heading"><h2 class="review-question-kicker">第 23 题 · 题库内容</h2><p class="review-question-source" aria-label="题号 ' + questionId + '"><span>题号：' + questionId + '</span><span> · 三、解答题</span></p></header><p>题干</p></article></section><section class="review-chat-pane"><div class="review-chat-heading"><span>本题对话</span><small>题目上下文 #' + reviewItemId + '</small></div></section></div>';
}
export async function open(browser, scope = 'all') { await browser.runtime.open(scope, { token: 'test-task', target: '我的学习集', content: 'questionAnswer' }); }
export async function packet(browser, start) {
  const accepted = start(); if (accepted !== 'accepted') throw new Error(accepted);
  for (let i=0;i<100;i++) {
    const state = JSON.parse(browser.runtime.read('test-task'));
    if (state.status === 'error') throw new Error(state.error);
    if (state.status === 'ready') { let result=''; for(let offset=0;offset<state.length;offset+=65536) result+=browser.runtime.chunk('test-task',offset); browser.runtime.release('test-task'); return JSON.parse(result); }
    await tick();
  }
  throw new Error('网页任务未完成');
}
