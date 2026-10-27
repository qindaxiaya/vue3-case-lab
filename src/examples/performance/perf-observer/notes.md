# PerformanceObserver 性能监控面板

## 1. 现象与场景

线上用户说「页面卡」，你本地复现不了；想知道首屏、交互延迟、布局偏移，却只能靠 `performance.timing` 猜。

复现：打开案例点「制造长任务」，FPS 曲线下降、日志出现 77ms 长任务；点「制造布局偏移」，CLS 从 0 变为非 0。点「重置实验」可以把 CLS、历史曲线、日志、偏移块与最近点击交互清回初始态；FP / FCP / LCP / TTFB 是加载期一次性指标，重置不会清掉。偏移块最多保留 5 个，继续注入会移除最早的，避免页面越撑越长。

## 2. 原理

`PerformanceObserver` 订阅浏览器产生的性能条目，回调批量收到 `entries`。常用类型：`paint`（FP/FCP）、`largest-contentful-paint`（LCP）、`layout-shift`（CLS）、`event`（交互延迟，INP 原始数据）、`longtask`（>50ms 的主线程任务）。

`buffered: true` 会先回放注册前的历史条目，所以监控脚本晚加载也能拿到首屏数据；`event` 用 `durationThreshold` 只订阅超过 16ms 的交互，避免噪声。FPS 不是 PerformanceObserver 类型，要用 rAF 按整秒窗口采样。

面板上的指标分两组：FP / FCP / LCP / TTFB 属于加载期指标，页面打开时采集一次，之后基本不再变化；FPS、堆内存、最近点击交互属于实时指标，会持续刷新。CLS 比较特殊：它既可能在加载期产生，也会被后续交互推高，所以案例把它放在加载期卡片里，但允许「重置实验」清零，方便反复制造偏移做对比。重置只清可重复产生的实验数据，不碰已经发生过的加载期指标——那些值清掉也不会重新采集，反而会让面板看起来像坏了。

## 3. 关键代码

```ts
function observe(type: string, callback: (entries: PerformanceEntry[]) => void, buffered = true) {
  try {
    const po = new PerformanceObserver((list) => callback(list.getEntries()))
    // 1. buffered 让浏览器回放历史 entry，首屏指标不丢
    po.observe({ type, buffered })
    observers.push(po)
  } catch {
    // 2. 不支持的类型会抛 TypeError，降级但不能阻断其他指标
    console.warn(`当前浏览器不支持 ${type}`)
  }
}

observe('layout-shift', (entries) => {
  for (const entry of entries) {
    const shift = entry as unknown as { value: number; hadRecentInput: boolean }
    // 3. 规范要求跳过「近期输入引起」的偏移，否则 CLS 虚高
    if (!shift.hadRecentInput) cls.value += shift.value
  }
})

// 卸载时统一 disconnect，停止推送
onUnmounted(() => observers.forEach((po) => po.disconnect()))

// 重置实验：只清本次交互产生的数据，方便反复对比
function resetExperiment() {
  cls.value = 0
  clsHistory.value = []
  fpsHistory.value = []
  live.lastClickInp = null
  shiftZone.value?.replaceChildren()
  logEntries.value = []
  // FP / FCP / LCP / TTFB 不清：页面打开时的一次性指标，清了也不会重新产生
}
```

## 4. 数据对比

| 指标 | 实测值 |
|---|---|
| FP / FCP / LCP | 396.0 / 396.0 / 396.0 ms |
| TTFB | 5.6 ms |
| JS 堆内存 | 23.3 MB |
| 长任务（点一次） | 77 ms |
| CLS（制造偏移后） | 0.000 → 0.001 |
| 重置实验后的加载期指标 | FP / FCP / LCP / TTFB 保持原值 |
| 重置实验后的实验数据 | CLS 0.000、日志只剩重置记录、偏移块 0 个 |
| 偏移块上限 | 5 个（超过移除最早的） |

测量方式：Chrome headless 1200×900 打开案例读取面板；点「制造长任务/制造布局偏移」后再读。重置行为用 `check:ui` 的「布局偏移注入与重置」场景核对：注入后计数为 1 / 5，重置后偏移块 0 个、计数 0 / 5、日志含重置记录。headless 下 FPS 可能显示 0（页面不可见时 rAF 被节流），此时以 longtask 与 CLS 为准。

## 5. 追问与边界

**Q：LCP 为什么一直变？**
LCP 在页面加载过程中会随更大的元素出现而更新，用户首次交互后冻结；监控取最终值。

**Q：CLS 为什么要跳过 `hadRecentInput`？**
用户主动点击/输入导致的布局变化不算「意外偏移」，规范明确排除，否则交互多的页面 CLS 失真。

**Q：这些指标能直接当性能评分吗？**
不能。它们受设备、网络、缓存影响，要按分位数（P75）看趋势，而不是单次绝对值。

**Q：为什么重置实验不清 FP / FCP / LCP / TTFB？**
这些是加载期一次性指标，页面打开时已经发生；清掉之后浏览器不会重新采集，面板会永远显示占位符，看起来像坏了。重置只清可以重复制造的实验数据：CLS、历史曲线、日志、偏移块、最近点击交互。

**Q：偏移块为什么要限量？**
每插入一个块都会推挤下方内容，块越多页面越长，演示区会被撑得很难操作。保留最近 5 个足够观察 CLS 增长，也方便反复点「重置实验」重来。

坑：`event` 条目只有带 `interactionId` 的才算真实交互；hover 等不产生。边界：`longtask` 只支持部分浏览器，Safari 需用其他方式估算；生产环境建议接 web-vitals 统一口径。
