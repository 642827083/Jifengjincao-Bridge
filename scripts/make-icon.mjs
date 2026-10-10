import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// 可传入本机 sharp 模块路径；图标生成工具不参与插件运行或常规构建。
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const original = await fs.readFile(path.join(root, 'assets/plugin-icon-source.png'));
// 按透明度裁掉源图留白，保持用户上传图的轮廓、颜色与半透明细节。
const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let left = info.width, top = info.height, right = -1, bottom = -1;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * info.channels + 3] === 0) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
}
if (right < left) throw new Error('原始图标没有可见轮廓');
const png = await sharp(original)
  .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
  .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toBuffer();
const result = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (result.info.width !== 48 || result.info.height !== 48 || result.info.channels !== 4) throw new Error('图标尺寸或通道不符');
for (const pixel of [0, 47, 48 * 47, 48 * 48 - 1]) {
  if (result.data[pixel * 4 + 3] !== 0) throw new Error('图标四角应完全透明');
}
await fs.writeFile(path.join(root, 'src/icon.png'), png);
console.log('图标已生成并验证：用户上传图片，48×48，原有颜色，RGBA 透明背景');
