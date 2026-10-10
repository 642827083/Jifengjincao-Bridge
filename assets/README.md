# 插件图标

当前图标源为用户于 2026-10-04 上传的 `plugin-icon-source.png`。保留其轮廓、原有灰色与透明度，裁掉透明留白后等比缩放，生成插件使用的 `src/icon.png`，尺寸为 48×48 像素，四角透明。

`brand-mark-original.svg` 与 `plugin-icon.svg` 为之前的网站矢量图版本，保留作参考，不再用于生成当前图标。前者提取自 [疾风劲草网站](https://bbkaoyan.cn/) 页眉的内嵌 SVG；获取日期为 2026-10-04，对应脚本为 `/assets/index-D8ujbac5.js`。

需要重新生成时，使用已安装的 sharp 模块运行：

```sh
node scripts/make-icon.mjs <sharp 模块绝对路径>
```

图标生成工具不依赖 MN 宿主，不改变插件版本或导入功能。原始标志的权利归其原权利人所有。
