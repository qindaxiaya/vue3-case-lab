# 定高虚拟列表

## 1. 现象与场景

列表有 10 万条数据，一次性渲染，页面直接卡死；滚动时掉帧，内存占用一路涨。

复现：打开案例，总行数 100,000，DOM 只渲染 18 个节点；滚动时节点数保持恒定。

## 2. 原理

虚拟列表只渲染「视口内 + 上下缓冲」的行。占位层撑出 `total × rowHeight` 的总高度，让滚动条比例与真实列表一致；内容层用 `transform: translateY(startIndex × rowHeight)` 定位到当前起点。

起始行 = `floor(scrollTop / rowH) - buffer`，结束行 = `floor((scrollTop + viewH) / rowH) + buffer`。滚动事件用 rAF 合并，一帧只算一次索引，避免高频 scroll 触发大量重排。

## 3. 关键代码

```ts
// 1. 起始行：当前位置除以行高，减去缓冲
const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / rowH) - buffer),
)
// 2. 结束行：视口底部再加缓冲
const endIndex = computed(() =>
  Math.min(total - 1, Math.floor((scrollTop.value + viewH) / rowH) + buffer),
)

// 3. 占位层撑高，内容层用 transform 偏移（不触发重排）
const spacerStyle = computed(() => ({ height: `${total * rowH}px` }))
const contentStyle = computed(() => ({ transform: `translateY(${startIndex.value * rowH}px)` }))

function onScroll(e: Event): void {
  pending = (e.target as HTMLElement).scrollTop
  if (rafId) return
  rafId = requestAnimationFrame(() => { scrollTop.value = pending; rafId = 0 })
}
```

## 4. 数据对比

| 指标 | 全量渲染 | 虚拟列表 |
|---|---|---|
| 总行数 | 100,000 | 100,000 |
| DOM 行节点 | 100,000 | 18 |
| 可视行 | 13 | 13 |
| 滚动位置 | — | 0px 起步 |
| 缓冲 | — | 上下各 5 行 |

测量方式：Chrome headless 1200×900 打开案例，读取「总行数 100,000 / 渲染节点 18 / 可视行 13」；行高 32px、视口 400px、缓冲 5 来自 Demo 配置。18 = 13 可视 + 上下缓冲，滚动时保持恒定。

## 5. 追问与边界

**Q：为什么 DOM 是 18 而不是 13？**
缓冲行用于快速滚动时避免白屏；可视 13 + 上下各 5，实际会按边界截断，滚动中在 18 左右浮动。

**Q：动态行高怎么办？**
定高公式失效，需要「预估高度 + 测量真实高度 + 前缀和 + 二分查找」，或用 tanstack/virtual、vue-virtual-scroller 的动态模式。

**Q：为什么滚动位置用 rAF 节流？**
scroll 事件频率远高于帧率，每帧只取最后一次位置，减少索引计算与渲染次数。

坑：占位层忘记撑高，滚动条会很短，用户以为只有几行。边界：列表项含图片/异步内容时，行高变化会让定位漂移，需要 ResizeObserver 修正。
