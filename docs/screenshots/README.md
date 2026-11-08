# 案例演示区截图

这里存放**新案例 / 明显视觉改动**的 375px 演示区截图，作为 DoD §6 的可见证据。
存量 103 个案例不要求补齐；截图只用于人工比对，不参与 CI 断言。

## 目录与命名

```
docs/screenshots/<分类>/<案例>/<分类>-<案例>-375.png
docs/screenshots/<分类>/<案例>/<分类>-<案例>-375-dark.png
```

文件名由 `check:ui --shot` 自动生成（分类与案例之间的 `/` 换成 `-`）。

## 生成命令

先启动 dev 或 preview，然后：

```bash
# 浅色
npm run check:ui -- --shot composables/use-keyboard-shortcut \
  --width 375 --out docs/screenshots/composables/use-keyboard-shortcut

# 暗色（同一个目录，文件名自动带 -dark）
npm run check:ui -- --shot composables/use-keyboard-shortcut \
  --width 375 --dark --out docs/screenshots/composables/use-keyboard-shortcut
```

- `--width 375` 只出窄屏图；不传则同时出 1280 + 375。
- `--out` 不传时仍写到 `node_modules/.tmp/shots`（临时目录，不入库）。
- `--shot` 只截图、不做断言，跑完退出码永远是 0；提交前请自己打开图片确认。
- 脚本会先写 `moyu-theme` 再刷新页面，保证 Naive UI 的暗色主题也跟着切换。

## 约定

- 新增案例或改动了演示区视觉时，提交浅色 + 暗色两张 375px 图。
- 截图放在案例自己的目录下，PR 里直接引用，方便 reviewer 不启动项目也能看。
- 不要提交 1280px 大图（除非该案例的布局只在宽屏出现）。
