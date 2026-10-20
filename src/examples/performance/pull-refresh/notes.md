# 下拉刷新 + 触底加载

## 1. 现象 / 场景

移动端列表下拉时整页跟着回弹，或者一次下拉触发多次刷新；滚到底部又连续发重复请求。

复现步骤：

1. 打开案例，在列表顶部按住向下拖约 170px，松手，观察首项是否换成新一批。
2. 滚到列表底部，观察是否自动加载下一页。
3. 刷新/加载过程中继续拖动，确认不会重复触发。

## 2. 原理

手势用 Pointer 事件统一鼠标、触屏和触控笔。按下时先判断列表是否在顶部：`scrollTop > 0` 就不接管，否则会和正常滚动打架；再用 `setPointerCapture` 保证手指滑出元素也能收到 `pointerup`。

下拉位移要乘阻尼系数（案例 0.45）并设上限，否则内容会跟着手指跑太远；松手时只有超过阈值（64px）才刷新。刷新期间用 `refreshing` 互斥，避免重复请求。

触底判断同样是「距底距离」：`scrollHeight - scrollTop - clientHeight < 48`，再配合 `loadingMore`、`finished` 两个状态。移动端还要加 `overscroll-behavior: contain`，阻止 iOS 整页橡皮筋和下拉手势冲突。

## 3. 方案：关键代码

```ts
function onPointerDown(e: PointerEvent): void {
  if (refreshing.value) return
  // ① 只有滚到顶部才接管手势，否则会抢走正常滚动
  if (scroller && scroller.scrollTop > 0) return
  startY = e.clientY
  dragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value) return
  const dy = e.clientY - startY
  if (dy <= 0) return
  // ② 阻尼 + 上限：手指拉 100px，内容只走 45px，避免拉过头
  pull.value = Math.min(110, dy * 0.45)
}

async function onPointerUp(): Promise<void> {
  if (!dragging.value) return
  dragging.value = false
  // ③ 未达阈值直接归零，交给 CSS transition 回弹
  if (pull.value >= THRESHOLD && !refreshing.value) await refresh()
  else pull.value = 0
}
```

触底部分：

```ts
async function onScroll(): Promise<void> {
  if (!scroller || loadingMore.value || refreshing.value || finished.value) return
  const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48
  if (!nearBottom) return
  loadingMore.value = true
  await sleep(700)
  // 追加下一页……
  loadingMore.value = false
}
```

## 4. 数据对比

| 指标 | 操作前 | 操作后 | 测量方式 |
|------|--------|--------|----------|
| 下拉 170px 松手 | 12 条，首项 #1 | 12 条，首项 #13 | 页面状态栏 + 首项文本 |
| 触底加载 | 12 条 | 24 条 | `.pr-row` 数量 |
| 状态 | 就绪 | 就绪 / 继续下滑 | 页面状态文本 |

测量说明：

- 环境：Chrome headless 1200×900、Vite dev；下拉用 Pointer 事件模拟，同一操作 3 次结果一致。
- 数据规模：每页 12 条，刷新延迟 900ms，加载更多延迟 700ms。
- 本案例是行为指标，无性能差异；下拉位移 170px 经阻尼后 76.5px，超过 64px 阈值。

## 5. 追问与边界（面试高频）

- Q: 为什么用 Pointer 事件而不是 `touchstart/touchmove`？ → A: Pointer 一套代码同时支持鼠标、触屏和笔，且能配合 capture；touch 事件还要处理 passive 与多指。
- Q: 为什么一定要 `setPointerCapture`？ → A: 手指滑出元素后事件仍发给原元素，否则收不到 `pointerup`，页面会卡在「拖拽中」。
- Q: 为什么下拉要加阻尼？ → A: 手指位移和内容位移 1:1 时很容易拉过头；阻尼让操作有「拉橡皮筋」的手感，也降低误触。

踩坑：

1. 没有「刷新中/加载中」互斥 → 连续触发重复请求；用状态锁或 AbortController。
2. 刷新后忘记重置 `finished` → 永远加载不出新数据。
3. iOS Safari 整页回弹与下拉冲突 → 容器加 `overscroll-behavior: contain`，并限制只有顶部才接管。

边界：本案例对比的是「手势状态处理是否正确」，没有第二套错误实现可切换，故不设「错误/正确」开关，差异通过重复拖拽/触底观察；桌面端下拉刷新不是惯用交互，可以只保留触底加载；复杂手势（惯性、嵌套滚动、多方向）优先用 Vant `PullRefresh`/`List` 或 VueUse 的 `useInfiniteScroll`。
