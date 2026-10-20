# 水波纹按钮

## 1. 现象与场景

想给按钮加点击水波纹，用 CSS `:active` 只能做整体缩放；用 JS 改 `left/top/width` 逐帧动画，连点几次就卡，节点还越积越多。

复现：点击不同位置的按钮，波纹从点击点扩散；连续快速点击，动画结束后 DOM 中不残留节点。

## 2. 原理

波纹是一个绝对定位的圆：以点击点为中心，半径取「到按钮最远角」的距离，保证扩散能覆盖整个按钮。用 `currentColor` 让波纹自动跟随文字颜色。

动画用 Web Animations API（`element.animate`），浏览器原生动画引擎走合成层，不占主线程；`onfinish` 里删除节点，连点几十次也不会残留。CSS 只需给按钮 `position: relative; overflow: hidden`。

## 3. 关键代码

```ts
function spawnRipple(e: MouseEvent): void {
  const btn = e.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  // 1. 半径取到最远角的距离，波纹才能盖满按钮
  const radius = Math.max(
    Math.hypot(x, y), Math.hypot(rect.width - x, y),
    Math.hypot(x, rect.height - y), Math.hypot(rect.width - x, rect.height - y),
  )

  const ripple = document.createElement('span')
  ripple.style.cssText = `position:absolute;border-radius:50%;pointer-events:none;
    width:${radius * 2}px;height:${radius * 2}px;left:${x - radius}px;top:${y - radius}px;
    background:currentColor;opacity:0`
  btn.appendChild(ripple)

  // 2. WAAPI 走合成层，不阻塞主线程
  const anim = ripple.animate(
    [{ transform: 'scale(0)', opacity: 0.45 }, { transform: 'scale(1)', opacity: 0 }],
    { duration: 600, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', fill: 'forwards' },
  )
  // 3. 动画结束删节点，避免连点堆积
  anim.onfinish = () => ripple.remove()
}
```

## 4. 数据对比

| 指标 | CSS 伪元素方案 | WAAPI 方案 |
|---|---|---|
| 动画起点 | 固定中心 | 实际点击点 |
| 动画时长 | 固定 | 可动态传参（本例 600ms） |
| 连点 20 次残留节点 | 取决于清理 | 0（onfinish 删除） |
| 主线程占用 | 低 | 低（合成层） |

测量方式：Chrome headless 1200×900 连续点击按钮，观察波纹起点与动画结束后的 DOM 节点数；时长来自 Demo 配置。具体帧率受设备影响。

## 5. 追问与边界

**Q：为什么不用 CSS `@keyframes`？**
固定 keyframes 无法从任意点击点扩散，也不方便动态控制半径与时长；WAAPI 可以在 JS 里直接描述。

**Q：禁用态要加波纹吗？**
不要。`disabled` 按钮提前 return，否则用户会误以为可点。

**Q：波纹颜色怎么适配深色按钮？**
用 `currentColor` 跟随文字色，再调低透明度；纯白波纹在浅色按钮上几乎看不见。

坑：按钮忘记 `overflow: hidden`，波纹会溢出到按钮外。边界：极端连点仍会创建多个动画，可加节流或限制同时存在的波纹数；对性能敏感的场景可只用 `:active` 缩放。
