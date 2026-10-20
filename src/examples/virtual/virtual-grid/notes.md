# 虚拟网格

## 1. 现象 / 场景

图片墙一次要展示 5000 张卡片。直接铺出来，首屏要等将近一百毫秒才出现，滚动时浏览器要维护五千个节点，内存和重排压力都很大；可屏幕一次明明只看得到几十张。

复现步骤：

1. 打开案例，默认是虚拟网格，读取「已渲染」应为几十张。
2. 点「全量渲染 5000 张」，等列表重建，读取「已渲染」变成 5000，滚动明显变重。
3. 点「跳到中间」或手动滚动，观察虚拟模式的「行窗口」随位置变化，节点数基本不变。

## 2. 原理

虚拟滚动的核心是「用少量节点模拟完整列表」。外层容器用总高度撑出滚动条：1250 行 × 90px = 112500px。滚动时读取 `scrollTop`，除以行高得到当前第一行，再上下各留两行缓冲，窗口之外的内容不渲染。

渲染出的窗口用绝对定位或 `translateY` 放到 `startRow * rowHeight` 的位置，视觉上就接上了。因为总高度始终不变，滚动条长度和滚动位置不会跳动。

网格比单列多一步：先按列数把数据切成行，每行再切出 4 张卡片。案例固定 4 列、卡片 90px 一行，所以行号、行高、总行数都能直接算。列数或行高变化时，这套除法要重算，否则窗口会错位。

## 3. 方案：关键代码

```ts
const COLUMNS = 4
const ROW_HEIGHT = 90
const BUFFER = 2
const totalRows = Math.ceil(TOTAL / COLUMNS)

// ① 偏移量除以行高得到当前行，上下各留两行缓冲，快速滚动不露白
const startRow = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - BUFFER))
const endRow = computed(() =>
  Math.min(totalRows, startRow.value + Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + 1 + BUFFER * 2),
)

// ② 只切出窗口内的数据，模板里的 v-for 只有几十个节点
const visibleRows = computed(() => {
  const rows = []
  for (let row = startRow.value; row < endRow.value; row++) {
    rows.push({ row, items: cells.slice(row * COLUMNS, (row + 1) * COLUMNS) })
  }
  return rows
})

function onScroll(): void {
  // ③ 只记偏移，窗口交给 computed 自动重算
  scrollTop.value = viewport.value?.scrollTop ?? 0
}
```

```vue
<div class="spacer" :style="{ height: `${totalRows * ROW_HEIGHT}px` }">
  <div class="window" :style="{ transform: `translateY(${startRow * ROW_HEIGHT}px)` }">
    <div v-for="row in visibleRows" :key="row.row" class="row">
      <article v-for="cell in row.items" :key="cell.id" class="cell">{{ cell.id }}</article>
    </div>
  </div>
</div>
```

## 4. 数据对比

| 指标 | 全量渲染 | 虚拟网格 | 测量方式 |
|------|----------|----------|----------|
| 已渲染卡片 | 5000 | 44 | `querySelectorAll('.cell').length` |
| 行窗口 | 全部 | 1–11 / 1250（顶部） | 案例统计 |
| 滚动到 30000px | 5000 节点 | 44 节点，窗口 332–342 | 设置 `scrollTop` 后读取 |
| 重建耗时 | 97.5 ms | 14 ms | 切换模式到两帧结束，3 次中位数 |

测量说明：

- 环境：Chrome headless 155、1200×900、Vite dev；5000 张卡片、4 列、每行 90px。
- 取样：全量重建 98.1 / 95.8 / 97.5ms，虚拟重建 8.5 / 15.4 / 14ms，取中位数。
- 两种模式 `scrollHeight` 都是 112500px，说明滚动条由总高度撑开，而不是靠渲染全部内容。

## 5. 追问与边界（面试高频）

- Q: 为什么上下要留缓冲行？ → A: 快速滚动时浏览器可能来不及在下一帧前渲染，缓冲行能避免底部先露白再补内容。
- Q: 节点会被复用吗？ → A: Vue 会按 key 复用窗口内仍存在的卡片；滚出窗口的节点会被卸载，新进入的节点重新创建。要真正复用很少的 DOM，需要更激进的池化方案。
- Q: 卡片高度不固定怎么办？ → A: 需要测量并缓存每行高度、用前缀和定位；也可以改用按行估算 + 动态校正的方案。

踩坑：

1. 外层没设总高度 → 滚动条只有一屏，根本滚不动。
2. 窗口定位忘了减去 `startRow * rowHeight` → 内容看起来「飞」到列表顶部。
3. 列数随窗口变化但计算仍写死 4 → 窗口错位、卡片重叠。

边界：固定行高、固定列数时这套除法最稳；瀑布流、不定高、可展开的行需要更复杂的测量缓存。若列表同时需要无障碍完整语义或浏览器查找（Ctrl+F）命中屏外内容，虚拟化会丢失这些能力，要评估取舍。
