import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const webSourceNames = ['BBKaoyanHeader.js', 'BBKaoyanLayout.js', 'BBKaoyanSelection.js', 'BBKaoyanPage.js', 'BBKaoyanReview.js', 'BBKaoyanQuestionTools.js'];
export function webBundleFiles() {
  const files = new Map();
  files.set('BBKaoyanDialogStyle.js', 'window.__JFJC_DIALOG_CSS__ = ' + JSON.stringify(fs.readFileSync(path.join(root, 'web/src/BBKaoyanDialog.css'), 'utf8')) + ';\n');
  for (const name of webSourceNames) files.set(name, fs.readFileSync(path.join(root, 'web/src', name), 'utf8'));
  return files;
}
export function pageScriptSource() { return Array.from(webBundleFiles().values()).join('\n'); }
export function importPageHTML() {
  const bridge = fs.readFileSync(path.join(root, 'web/src/lib/mnBridge.js'), 'utf8').replace('export default MNBridge;', '');
  const script = fs.readFileSync(path.join(root, 'web/src/ImportPage.mjs'), 'utf8').replace("import MNBridge from './lib/mnBridge.js';", '');
  return fs.readFileSync(path.join(root, 'web/src/ImportPage.html'), 'utf8')
    .replace('/* 导入样式 */', fs.readFileSync(path.join(root, 'web/src/ImportPage.css'), 'utf8'))
    .replace('/* 导入脚本 */', () => bridge + '\n' + script);
}
export function handwritingPageHTML() {
  const bridge = fs.readFileSync(path.join(root, 'web/src/lib/mnBridge.js'), 'utf8').replace('export default MNBridge;', '');
  const script = fs.readFileSync(path.join(root, 'web/src/HandwritingPage.js'), 'utf8');
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><p id="status" style="font:14px system-ui;padding:12px">正在读取卡片手写…</p><script>' + bridge + '\n' + script + '</script></body></html>';
}
export function extraTextPageHTML() {
  const bridge = fs.readFileSync(path.join(root, 'web/src/lib/mnBridge.js'), 'utf8').replace('export default MNBridge;', '');
  const script = fs.readFileSync(path.join(root, 'web/src/ExtraTextPage.js'), 'utf8');
  return fs.readFileSync(path.join(root, 'web/src/ExtraTextPage.html'), 'utf8').replace('/* 提示词脚本 */', () => bridge + '\n' + script);
}
