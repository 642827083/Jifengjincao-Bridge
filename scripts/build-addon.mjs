import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { webBundleFiles, importPageHTML } from './web-bundle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const release = process.argv.includes('--release');
if (release === process.argv.includes('--test')) throw new Error('必须且只能指定 --test 或 --release');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')));
const addon = JSON.parse(fs.readFileSync(path.join(root, 'src/mnaddon.json')));
if ([lock.version, lock.packages[''].version, addon.version].some(v => v !== pkg.version)) throw new Error('版本元数据不一致');
if (release && pkg.version === '0.0.0') throw new Error('测试元数据不能正式发布，请先按用户指定版本更新');
const output = path.join(root, release ? `Jifengjincao Bridge-v${pkg.version}.mnaddon` : 'Jifengjincao Bridge Test.mnaddon');
if (release && fs.existsSync(output)) throw new Error('正式包已存在，禁止覆盖');
const stage = path.join(root, release ? 'dist-release' : 'dist-test');
for (const target of [stage, path.join(root, 'src/web-dist')]) {
  const resolved = path.resolve(target);
  if (!resolved.startsWith(root + path.sep)) throw new Error('构建目录越界');
  fs.rmSync(resolved, { recursive: true, force: true });
}
fs.mkdirSync(path.join(root, 'src/web-dist'), { recursive: true });
const webFiles = webBundleFiles();
for (const [file, content] of webFiles) fs.writeFileSync(path.join(root, 'src/web-dist', file), content);
const pageScript = Array.from(webFiles.values()).join('\n');
fs.writeFileSync(path.join(root, 'src/web-dist/BBKaoyanPageScript.js'), 'var __JFJC_PAGE_SCRIPT__ = ' + JSON.stringify(pageScript) + ';\n');
fs.writeFileSync(path.join(root, 'src/web-dist/ImportPageResource.js'), 'var __JFJC_IMPORT_HTML__ = ' + JSON.stringify(importPageHTML()) + ';\n');
const check = spawnSync(process.execPath, ['scripts/check.mjs'], { cwd: root, stdio: 'inherit' });
if (check.status !== 0) throw new Error('语法检查失败');
// 网页单文件产物只用于开发核对，安装包仅保留原生入口实际加载的合并脚本。
const generated = path.join(root, 'src/web-dist');
fs.cpSync(path.join(root, 'src'), stage, { recursive: true,
  filter: source => !source.startsWith(generated + path.sep) || ['BBKaoyanPageScript.js', 'ImportPageResource.js'].some(name => source === path.join(generated, name))
});
for (const file of ['main.js', 'mnaddon.json', 'icon.png', 'web-dist/BBKaoyanPageScript.js', 'web-dist/ImportPageResource.js']) {
  if (!fs.existsSync(path.join(stage, file))) throw new Error(`缺少安装资源：${file}`);
}
const hashes = {};
function inspect(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) inspect(path.join(dir, entry.name), name + '/');
    else hashes[name] = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, entry.name))).digest('hex');
  }
}
inspect(stage);
fs.writeFileSync(path.join(stage, 'build-manifest.json'), JSON.stringify({ title: addon.title, version: pkg.version, files: hashes }, null, 2));
const zip = output + '.zip';
const archive = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "Compress-Archive -Path (Join-Path $env:JFJC_BUILD_STAGE '*') -DestinationPath $env:JFJC_BUILD_ZIP -Force"], {
  cwd: root, stdio: 'inherit', env: { ...process.env, JFJC_BUILD_STAGE: stage, JFJC_BUILD_ZIP: zip }
});
if (archive.status !== 0 || !fs.existsSync(zip)) throw new Error('创建测试安装包失败');
const verify = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts/verify-package.ps1'), '-PackagePath', zip], { cwd: root, stdio: 'inherit' });
if (verify.status !== 0) throw new Error('安装包内容核验失败');
// 正式包存在时不允许覆盖；核验后再替换测试包。
fs.renameSync(zip, output);
console.log(`已生成：${path.basename(output)}（${Object.keys(hashes).length} 个资源）`);
