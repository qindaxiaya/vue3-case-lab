# PerformanceObserver 性能监控面板

## 1. 现象与场景

线上用户说「页面卡」，你本地复现不了；想知道首屏、交互延迟、布局偏移，却只能靠 `performance.timing` 猜。

复现：打开案例点「制造长任务」，FPS 曲线下降、日志出现 77ms 长任务；点「制造布局偏移」，CLS 从 0 变为非 0。

## 2. 原理

`PerformanceObserver` 订阅浏览器产生的性能条目，回调批量收到 `entries`。常用类型：`paint`（FP/FCP）、`largest-contentful-paint`（LCP）、`layout-shift`（CLS）、`event`（交互延迟，INP 原始数据）、`longtask`（>50ms 的主线程任务）。

`buffered: true` 会先回放注册前的历史条目，所以监控脚本晚加载也能拿到首屏数据；`event` 用 `durationThreshold` 只订阅超过 16ms 的交互，避免噪声。FPS 不是 PerformanceObserver 类型，要用 rAF 按整秒窗口采样。

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
```

## 4. 数据对比

| 指标 | 实测值 |
|---|---|
| FP / FCP / LCP | 396.0 / 396.0 / 396.0 ms |
| TTFB | 5.6 ms |
| JS 堆内存 | 23.3 MB |
| 长任务（点一次） | 77 ms |
| CLS（制造偏移后） | 0.000 → 0.001 |

测量方式：Chrome headless 1200×900 打开案例读取面板；点「制造长任务/制造布局偏移」后再读。headless 下 FPS 可能显示 0（页面不可见时 rAF 被节流），此时以 longtask 与 CLS 为准。

## 5. 追问与边界

**Q：LCP 为什么一直变？**
LCP 在页面加载过程中会随更大的元素出现而更新，用户首次交互后冻结；监控取最终值。

**Q：CLS 为什么要跳过 `hadRecentInput`？**
用户主动点击/输入导致的布局变化不算「意外偏移」，规范明确排除，否则交互多的页面 CLS 失真。

**Q：这些指标能直接当性能评分吗？**
不能。它们受设备、网络、缓存影响，要按分位数（P75）看趋势，而不是单次绝对值。

坑：`event` 条目只有带 `interactionId` 的才算真实交互；hover 等不产生。边界：`longtask` 只支持部分浏览器，Safari 需用其他方式估算；生产环境建议接 web-vitals 统一口径。
