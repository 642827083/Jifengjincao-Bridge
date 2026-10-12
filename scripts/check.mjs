import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let count = 0;
function inspect(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) inspect(name);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      if (name.includes('lib') || entry.name.endsWith('.mjs')) {
        const result = spawnSync(process.execPath, ['--check', path.join(root, name)], { stdio: 'inherit' });
        if (result.status !== 0) throw new Error('模块语法检查失败：' + name);
      } else new vm.Script(fs.readFileSync(path.join(root, name), 'utf8'), { filename: name });
      count++;
    }
  }
}
for (const dir of ['src', 'web/src']) inspect(dir);
console.log(`JavaScript 语法检查通过：${count} 个文件`);
