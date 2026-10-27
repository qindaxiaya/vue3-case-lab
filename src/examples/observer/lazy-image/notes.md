# IntersectionObserver 图片懒加载

## 1. 现象与场景

长列表里 30 张图一起请求，首屏加载慢、流量浪费；滚动到下面时图片还没加载，出现大片空白。

复现：打开案例，未滚动时观察「已加载 6 / 30」；其余 24 张处于「待进入视口加载」状态。事件流默认保留最近 20 条；点「重置列表」会清空日志、恢复未加载状态并滚回顶部。打开「持续观察已加载图片」后，已加载的图片滚入 / 滚出也会记录，能看到完整生命周期。

## 2. 原理

真实 `<img>` 一设置 `src` 浏览器就发起请求，和它是否可见无关。懒加载先用占位图（或空 `src`），把真实地址放在 `data-src`，等元素进入视口再搬运。

`IntersectionObserver` 用 `rootMargin: '100px'` 提前 100px 触发，避免用户看到空白。注意 `unobserve` 的时机：应该等图片加载完成后再停止观察，而不是一进入视口就立刻停止。进入视口只代表「可以开始加载」，如果此时就把观察器撤掉，后续的加载完成、失败都没有回调可接；本案例在模拟加载的 300ms 结束后才 `unobserve`，真实项目则放在 `load` / `error` 回调里。

默认「加载完成即释放」是纯懒加载的常规做法：图片已经显示，再观察它只会产生无用的滚入 / 滚出事件。但曝光统计、埋点这类场景需要知道图片后来有没有再次进入视口，这时可以保留观察；案例用「持续观察已加载图片」开关演示两种策略。相交计算在合成线程完成，比 scroll + `getBoundingClientRect` 便宜。

## 3. 关键代码

```ts
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      // 1. isIntersecting 才是「进入」，ratio 是相交比例
      if (!entry.isIntersecting) continue
      const img = entry.target as HTMLImageElement
      // 2. 同一张图只加载一次：加载中 / 已加载都跳过
      if (img.dataset.state === 'loading' || img.dataset.state === 'loaded') continue
      img.dataset.state = 'loading'

      const real = img.dataset.src
      if (!real) continue
      // 3. 进入视口才把 data-src 搬到 src，浏览器此刻才发请求
      img.src = real

      // 4. 加载完成后才 unobserve：进入只是开始，完成 / 失败还要接
      img.addEventListener(
        'load',
        () => {
          img.dataset.state = 'loaded'
          if (!keepObserving.value) observer.unobserve(img)
        },
        { once: true },
      )
    }
  },
  // rootMargin 100px = 视口外 100px 的预加载带
  { rootMargin: '100px', threshold: 0 },
)

document.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((img) => observer.observe(img))
onUnmounted(() => observer.disconnect())
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 首屏视口内加载 | 6 / 30 张 |
| 未请求 | 24 张（保持占位） |
| 预加载距离 | 视口外 100px |
| 重复加载 | 0（加载完成后 unobserve） |
| 事件流日志上限 | 20 条 |
| 默认释放 | 加载完成即 unobserve，已加载图不再产生滚出事件 |
| 持续观察 | 打开后已加载图的滚入 / 滚出也会记录 |
| 重置列表 | 加载数回到初始、日志清空、滚动回顶部 |

测量方式：Chrome headless 1200×900 打开案例，读取面板「已加载 6 / 30」与事件流「第 1~6 张加载完成」；其余 24 张显示「待进入视口加载」。不同视口高度下首屏数量会变，比例结论不变。重置与持续观察用 `check:ui` 的懒加载场景核对：滚到底后加载数增加，重置后回到初始数量，打开持续观察后日志出现「（已加载）」。案例用 300ms 定时器模拟网络，真实项目应在 `load` / `error` 回调里释放。

## 5. 追问与边界

**Q：为什么不直接用 `<img loading="lazy">`？**
现代浏览器已原生支持，简单场景优先用它；需要自定义预加载距离、曝光统计、占位动画时仍需 IntersectionObserver。

**Q：`threshold` 和 `rootMargin` 怎么选？**
`threshold: 0` + 正 `rootMargin` 适合提前加载；曝光统计常用 `threshold: 0.5`，表示露出一半才算曝光。

**Q：图片加载失败怎么处理？**
监听 `error` 换占位图并提供重试；不要反复设置同一个 `src`，浏览器可能命中缓存失败结果。

**Q：为什么不在 `isIntersecting` 里立刻 `unobserve`？**
进入视口只代表「可以开始加载」，加载完成、失败都还没发生。立刻停止观察会丢掉后续状态，也没法在完成时打日志或做曝光上报。正确时机是 `load` / `error` 回调里；本案例用 300ms 定时器模拟网络，所以在定时器结束时才 `unobserve`。

**Q：持续观察会不会泄漏？**
观察器本身在组件卸载时会 `disconnect`，不会跨页面持有 DOM。持续观察只是让已加载图片继续产生滚入 / 滚出事件，适合曝光统计；纯懒加载不需要这些事件，加载完成就释放更省。日志只留 20 条也是同理：够看清一轮事件流，又不让 DOM 无限增长。

坑：只写 `observer.observe` 不 `disconnect`，组件卸载后观察器仍持有 DOM 引用。边界：首屏关键图（LCP 图）不要懒加载，否则会拖慢最大内容绘制。
