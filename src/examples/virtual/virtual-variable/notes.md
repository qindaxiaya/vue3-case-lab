# 虚拟列表（不定行高）

## 1. 现象 / 场景

聊天记录或评论区每行高度不一样，全量渲染 2000 条后滚动发涩，DOM 节点数直接顶到 2000。

复现步骤：

1. 打开案例，默认「虚拟渲染」，看 DOM 行数。
2. 切到「全量渲染 2000 行」，滚动列表，观察卡顿与 DOM 数。
3. 切回虚拟模式，滚到中段，确认区间与 DOM 数仍然很小。

## 2. 原理

定高列表可以直接用 `scrollTop / rowHeight` 算起始行；行高不等时这个除法失效，因为每一行的顶部位置都不同。

做法是先算前缀和：`offsets[i]` 表示前 i 行的总高度，也就是第 i 行的顶部坐标。滚动时用二分查找找到第一个「底边超过 `scrollTop`」的行，再从它往后数到视口底部，只渲染这个窗口加少量 overscan。

不定高不能用 `top` 逐行定位，否则滚动时每帧都在改布局；用一层 `height = totalHeight` 的占位元素撑出正确滚动条，再用 `translateY(offsets[start])` 把可视窗口整体平移，只触发合成，不触发重排。

## 3. 方案：关键代码

```ts
// ① 前缀和：offsets[i] 是第 i 行的顶部位置，不定高只能靠它定位
const offsets: number[] = [0]
for (const row of rows) {
  offsets.push(offsets[offsets.length - 1] + row.height)
}

function findStart(top: number): number {
  let lo = 0
  let hi = rows.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    // ② 二分：底边 <= scrollTop 说明整行在视口上方，O(log n) 找到起点
    if (offsets[mid + 1] <= top) lo = mid + 1
    else hi = mid
  }
  return lo
}

const start = computed(() => Math.max(0, findStart(scrollTop.value) - OVERSCAN))
const end = computed(() => {
  const bottom = scrollTop.value + VIEWPORT_H
  let i = start.value
  while (i < rows.length && offsets[i] < bottom) i++
  return Math.min(rows.length, i + OVERSCAN)
})
```

模板侧：

```html
<div class="scroller" @scroll="onScroll">
  <!-- ③ 占位层撑出总高度；窗口用 transform 平移，避免逐行改 top 触发重排 -->
  <div :style="{ height: totalHeight + 'px' }">
    <div :style="{ transform: `translateY(${offsets[start]}px)` }">
      <Row v-for="row in visibleRows" :key="row.id" />
    </div>
  </div>
</div>
```

## 4. 数据对比

| 指标 | 全量渲染 | 虚拟渲染 | 测量方式 |
|------|---------|---------|----------|
| DOM 行数（顶部） | 2000 | 9 | 页面面板 + `document.querySelectorAll('.vv-row').length` |
| DOM 行数（滚到 5000px） | 2000 | 11 | 同上 |
| 渲染区间 | 0 – 2000 | 63 – 74 | Demo 面板 `start – end` |
| 占位总高度 | 152045 px | 152045 px | `.vv-scroller.scrollHeight` |

测量说明：

- 环境：Chrome headless 1200×900、Vite dev；同一操作 3 次结果一致。
- 数据规模：2000 条，行高 44~108px 循环，视口 340px，overscan 3。
- 对比只看 DOM 数与滚动区间；帧率受 headless 环境影响，未作为结论。

## 5. 追问与边界（面试高频）

- Q: 行高未知怎么办？ → A: 先按估算值渲染，挂载后用 `ResizeObserver`/`getBoundingClientRect` 测量并回填缓存，重算 `offsets`；未测区域用锚点补偿，避免滚动条跳动。
- Q: 为什么用 `transform` 而不是逐行 `top`？ → A: `transform` 只触发合成，`top` 会触发布局；滚动时每帧改布局会明显掉帧。
- Q: overscan 取多少？ → A: 一般 3~8 行。太小快速滚动会白屏，太大就失去虚拟化意义。

踩坑：

1. 容器忘了 `overflow-y: auto` → 永远不滚动；高度也要固定或受控。
2. 字体加载、图片撑高后没有重算 `offsets` → 行错位、滚动条长度不对。
3. 用 `index` 当 key 且数据前插 → 复用错行；必须用稳定 id。

边界：行高频繁变化、图片未加载、需要反向无限滚动时，自己写很容易抖；优先用 `@tanstack/vue-virtual`、`vue-virtual-scroller` 等成熟库。数据少于 100 条时虚拟化收益很低。
