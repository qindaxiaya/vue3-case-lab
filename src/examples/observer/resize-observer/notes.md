# ResizeObserver 容器尺寸监听

## 1. 现象与场景

侧边栏折叠后图表没跟着变宽，文字溢出；监听 `window.resize` 没用，因为窗口尺寸根本没变。

复现：拖动案例面板右下角，容器从初始尺寸变化，面板的「内容区 / 边框盒 / 触发次数」实时更新。

## 2. 原理

`window.resize` 只报告视口变化；元素因 flex/grid、父级折叠、字体变化导致的尺寸改变，它完全不知道。

`ResizeObserver` 监听任意元素，回调在布局完成后异步触发。`contentRect` 是内容区尺寸（不含 padding/border），最常用于图表重绘；`borderBoxSize` 含 padding/border，算占位、外边距时用。回调只在实际尺寸变化时触发，不会因为「观察」本身造成死循环。

## 3. 关键代码

```ts
observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    // 1. contentRect：内容区尺寸，图表按它重绘最准
    width.value = Math.round(entry.contentRect.width)
    height.value = Math.round(entry.contentRect.height)

    // 2. borderBoxSize 含 padding/border，算占位时用它
    const bb = entry.borderBoxSize?.[0]
    if (bb) borderSize.value = `${bb.inlineSize}×${bb.blockSize}`
  }
})

// 3. box 决定测量基准，默认 content-box
observer.observe(el.value!, { box: 'content-box' })
onUnmounted(() => observer?.disconnect())
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 内容区 | 243 × 143 |
| 边框盒 | 260 × 160 |
| 差值 | 17px（padding + border） |
| 初始触发次数 | 1 |

测量方式：Chrome headless 1200×900 打开案例，读取面板与「尺寸变化日志：Δ+243px × +143px → 243×143」。静止时只触发一次，拖动改变尺寸才会继续触发。

## 5. 追问与边界

**Q：为什么内容区和边框盒差 17px？**
面板有 padding 与 1px 边框，`contentRect` 不含它们，`borderBoxSize` 含。选错会导致图表比容器小一圈。

**Q：回调里改被观察元素的尺寸会死循环吗？**
浏览器会在下一帧检测到尺寸再次变化再回调，可能形成循环；避免在回调里直接改同一元素的宽高，必要时加防抖或比较阈值。

**Q：和 `window.resize` 能一起用吗？**
不需要。元素尺寸变化已覆盖视口变化（视口变时元素通常也变），除非你只关心视口本身。

坑：`entry.contentRect` 是 `DOMRectReadOnly`，别直接当普通对象序列化。边界：ResizeObserver 不监听「元素被移出 DOM」，卸载仍需 `disconnect()`。
