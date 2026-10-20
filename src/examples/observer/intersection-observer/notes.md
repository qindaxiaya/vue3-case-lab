# 交叉观察器曝光统计

## 1. 现象 / 场景

商品列表要统计「卡片进入视口」的曝光。旧写法在滚动事件里对每张卡片调用 `getBoundingClientRect()`，卡片一多，滚动就发涩；同一个卡片来回滚动还会重复计数。

复现步骤：

1. 打开案例，切换到「滚动 + 位置计算（旧）」。
2. 点「自动滚动一轮」，观察「布局读取」和「滚动帧」快速上涨。
3. 切到「交叉观察器（推荐）」再滚一轮，对比两者的计数与曝光结果。

## 2. 原理

滚动事件每秒可以触发上百次。旧方案在每次滚动帧里读取 12 张卡片的尺寸，每次读取都可能让浏览器先完成样式计算和布局；读到的位置还要和滚动容器再算一次相交比例，成本随卡片数量线性增长。

`IntersectionObserver` 把「元素是否进入视口」交给浏览器统一计算。观察器内部维护 root（这里是滚动容器）、threshold（0 / 25% / 50% / 75% / 100%）和 rootMargin；只有相交状态跨过阈值时，才把一批 entry 交给回调。回调里直接拿 `intersectionRatio` 和 `isIntersecting`，不需要自己读布局。

Vue 这边只负责把回调结果写进响应式状态：`ratioMap` 驱动百分比条，`exposed` 集合保证同一卡片只计一次曝光。观察器在 `onMounted` 建立、`onUnmounted` 断开，节点用函数 ref 登记到 Map，避免模板里到处写 `$refs`。

## 3. 方案：关键代码

```ts
// 建立观察器：root 用滚动容器，阈值覆盖 0 到 1，重点看 50%
observer = new IntersectionObserver(
  (entries) => {
    callbackCount.value++
    for (const entry of entries) {
      const id = Number((entry.target as HTMLElement).dataset.id)
      ratioMap[id] = entry.intersectionRatio
      // ① 半可见即曝光：阈值 0.5 与业务口径对齐，避免露一条边就算
      if (entry.intersectionRatio >= 0.5) exposed.add(id)
      if (!entry.isIntersecting) ratioMap[id] = 0
    }
  },
  { root, threshold: [0, 0.25, 0.5, 0.75, 1] },
)

// ② 旧方案每帧读全部卡片，这正是要对比的成本
function measureByScroll(): void {
  const rootRect = root.getBoundingClientRect()
  for (const [id, el] of cardEls) {
    layoutReads.value++
    const rect = el.getBoundingClientRect()
    const visible = Math.min(rect.bottom, rootRect.bottom) - Math.max(rect.top, rootRect.top)
    ratioMap[id] = Math.max(0, Math.min(1, visible / rect.height))
  }
}

// ③ 卸载时断开，否则观察器会一直持有节点，路由来回切换会累积
onUnmounted(() => observer?.disconnect())
```

## 4. 数据对比

| 指标 | 滚动 + 位置计算 | 交叉观察器 | 测量方式 |
|------|-----------------|------------|----------|
| 布局读取 | 888 次 | 0 次 | 案例「布局读取」计数 |
| 相交回调 | 0 次 | 28 次 | 案例「相交回调」计数 |
| 滚动帧 | 74 帧 | 0 帧 | 案例「滚动帧」计数 |
| 曝光结果 | 12 / 12 | 12 / 12 | 案例「曝光」计数 |

测量说明：

- 环境：Chrome headless 155、1200×900、Vite dev；12 张卡片，自动滚动 1.2 秒后回顶。
- 取样：同一流程重复 3 次，计数完全一致（888 / 74 / 28），表中为其中一次。
- 旧方案 74 帧 × 12 张 = 888 次读取；观察器只在跨阈值时回调，共 28 次。

## 5. 追问与边界（面试高频）

- Q: 观察器回调是同步的吗？ → A: 不是。回调在渲染前的微任务批次里执行，适合写状态，不适合在里面做重计算。
- Q: `rootMargin` 有什么用？ → A: 提前或延后触发，比如图片懒加载常用 `200px` 提前开始加载。
- Q: 曝光为什么要用 Set？ → A: 同一卡片多次进入视口只计一次；如果需要「每次进入都计数」，改成数组或计数 Map。

踩坑：

1. root 配错成 `null` → 以整个页面为视口，滚动容器内部滚动时永远不会触发。
2. 曝光按「可见比例 > 0」算 → 只露一条边就计数，业务口径通常要 50% 或停留时长。
3. 忘记 `disconnect` → 路由切换后旧观察器还在观察旧节点，计数虚高。

边界：需要精确知道「可见了多少像素」时，观察器只给比例，仍要读一次尺寸；需要在滚动中实时做吸顶、联动动画时，观察器不够，配合 `scroll` 或 `ResizeObserver` 更合适。本案例的曝光口径是「半可见一次」，不同业务要改 threshold 或加停留时间。
