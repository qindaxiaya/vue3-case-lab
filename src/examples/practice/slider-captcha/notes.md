# 滑块验证

## 1. 现象与场景

登录页要加滑块验证，图片在高分屏上发虚，拼图和缺口纹理对不上；拖动时页面跟着滚，松手后拼图飞到轨道外。

复现：拖动滑块让拼图对准缺口，误差 ≤5px 通过；点「换一张」重新生成缺口位置。

## 2. 原理

canvas 要按 `devicePixelRatio` 放大画布尺寸、再用 CSS 尺寸还原显示，否则高分屏发虚。先画完整背景到离屏 canvas，再从同一张图扣出拼图并压暗缺口——两者必须同源，否则纹理对不上。

拖动用 Pointer 事件 + `setPointerCapture`，并把偏移夹在 `[0, 轨道宽 - 拼图宽]`。前端比对只能「提高成本」，不能作为安全边界：答案不能写在前端可读的变量里，必须由服务端保存缺口位置并校验轨迹。

## 3. 关键代码

```ts
const dpr = window.devicePixelRatio || 1
canvas.width = CSS_W * dpr
canvas.height = CSS_H * dpr
canvas.style.width = `${CSS_W}px`
canvas.style.height = `${CSS_H}px`
// 1. 逻辑坐标仍用 CSS 像素，绘制前统一缩放
ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

// 2. 拼图从同一张离屏图裁剪，纹理才对得上
pieceCtx.drawImage(off, targetX, pieceY, PIECE, PIECE, 0, 0, PIECE, PIECE)

function onPointerMove(e: PointerEvent): void {
  const dx = e.clientX - startClientX
  // 3. 夹紧上下界，防止拖出轨道
  offset.value = clamp(startOffset + dx, 0, trackWidth - PIECE)
  track.push({ x: offset.value, t: performance.now() - startTime })
}
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 通过容差 | ≤5 px |
| 轨迹采样 | 每次 pointermove 一个点 |
| 机器耗时阈值 | <300ms 高度可疑 |
| 失败处理 | 立即换题，限 3~5 次 |
| 画布缩放 | DPR 倍（1x/2x/3x） |

测量方式：Chrome headless 1200×900 拖动滑块，读取误差与轨迹点；容差、阈值来自 Demo 与风控建议。真机触摸需单独验证手感与 `touch-action`。

## 5. 追问与边界

**Q：前端比对通过就安全了吗？**
不安全。攻击者可直接读 JS 里的 `targetX` 或伪造请求；必须服务端校验缺口、耗时、轨迹。

**Q：怎么防脚本？**
看方向变化次数、加速度曲线、轨迹点密度、设备指纹与历史行为；单一特征都能伪造。

**Q：为什么移动端拖不动？**
容器缺少 `touch-action: none`，浏览器把拖动当成页面滚动；拼图块还要 `pointer-events: none` 防止挡住 move。

坑：缺口和拼图用两次随机绘制，纹理对不上，一眼假。边界：纯图形验证对读屏用户不友好，要提供替代验证方式。
