# 无限滚动加载

## 1. 现象与场景

列表滚到底部后要停一下才出下一页，等待感明显；或者一次滑动触发了好几个重复请求，列表里出现重复条目。

复现：快速滚到底，观察网络面板连续发出 2~3 个相同分页请求。

## 2. 原理

`IntersectionObserver` 把「元素是否进入视口」的计算交给浏览器合成线程，不需要在主线程监听 `scroll` 再 `getBoundingClientRect()`，因此滚动时不会因频繁布局计算掉帧。

实际用「哨兵元素」：列表底部放一个 1px 高的空 div，它一进入视口就加载下一页。`rootMargin: '0px 0px 200px 0px'` 把触发区域向下扩 200px，用户还没滚到底数据就回来了，形成「秒开下一页」的体感。

哨兵可能在一次滚动中反复相交，必须用 `loading` 门闩防重入；组件卸载时 `disconnect()` 释放观察器。

## 3. 关键代码

```ts
async function loadMore(): Promise<void> {
  // 1. 防重入：哨兵连续相交时，保证同时只有一个请求在飞
  if (loading.value) return
  loading.value = true
  try {
    const page = await fetchNextPage()
    list.value.push(...page)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        // 2. 只处理「进入」的瞬间，加载逻辑自带门闩
        if (entry.isIntersecting) void loadMore()
      }
    },
    // 3. 只向下扩 200px：这就是「提前加载」的来源
    { root: document.getElementById('list') ?? undefined, rootMargin: '0px 0px 200px 0px', threshold: 0 },
  )
  if (sentinel.value) observer.observe(sentinel.value)
})
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 每页条数 / 总页数 | 20 条 / 5 页（共 100 条） |
| 首屏渲染 | 20 条 |
| 预取触发距离 | 距容器底 200px |
| 同时飞行请求 | ≤ 1（loading 门闩） |
| 卸载后观察器 | 0（disconnect） |

测量方式：Chrome headless 1200×900 打开案例，读取「第 1 / 5 页、共 20 条」；滚动到底观察加载事件流只有一次「请求第 1 页」。`rootMargin` 与总条数来自 Demo 配置。

## 5. 追问与边界

**Q：为什么不监听 `scroll` 判断 `scrollTop + clientHeight >= scrollHeight`？**
可以，但滚动事件高频触发，每次读 `scrollHeight` 都可能触发布局；IntersectionObserver 由浏览器异步算，代码也更简单。

**Q：`rootMargin` 设多大合适？**
约一屏的 20%~50%。太小仍会等，太大则首屏就预取好几页，浪费流量。

**Q：加载失败怎么办？**
门闩要在 `finally` 释放，并保留「重试」按钮；不要失败后自动无限重试。

坑：`root` 必须传滚动容器，不传默认是视口；列表在弹窗里滚动时写错会导致永远不触发。边界：数据量很大时不要一直 push，配合虚拟列表只渲染可见项。
