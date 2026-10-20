# requestAnimationFrame 渲染循环

## 1. 现象与场景

用 `setInterval(fn, 16)` 做动画，画面还是一顿一顿；页面切到后台，定时器仍在跑，笔记本发热。

复现：打开案例点「启动」，FPS 稳定 60、帧间隔 16.6ms；快速来回移动鼠标观察节流点位置平滑跟随。

## 2. 原理

`requestAnimationFrame` 的回调在浏览器「即将重绘」前执行，天然与屏幕刷新率对齐；后台标签页会自动暂停或降频，不浪费 CPU。回调参数是 `performance.now()` 时间戳，动画应基于时间差计算，而不是每帧加固定值，否则掉帧时速度会变慢。

高频事件（mousemove）不要每次直接改样式：事件里只暂存最新值，用 `pending` 标志保证一帧只挂一次 rAF，把「每秒几百次」合并成「每秒 60 次」。

## 3. 关键代码

```ts
let latestX = 0
let pending = false

function onMouseMove(e: MouseEvent) {
  // 1. 事件里只暂存，绝不直接渲染
  latestX = e.offsetX
  if (pending) return
  pending = true
  requestAnimationFrame(() => {
    // 2. 本帧所有 move 共享这一次渲染
    pending = false
    dot.style.transform = `translateX(${latestX}px)`
  })
}

// 3. 续订由 running 控制，暂停后循环自然终止
function loop(now: number) {
  render(now)
  if (running) rafId = requestAnimationFrame(loop)
}
onUnmounted(() => cancelAnimationFrame(rafId))
```

## 4. 数据对比

| 指标 | 启动前 | 启动后 |
|---|---|---|
| FPS | 0 | 60 |
| 帧间隔 | 0.0 ms | 16.6 ms |
| 累计帧数（约 1.2s） | 0 | 74 |
| mousemove 渲染次数 | 每次事件 | 每帧最多 1 次 |

测量方式：Chrome headless 1200×900 点「启动」，等 1.2s 读取面板。headless 页面可见时 rAF 正常；切到后台会降频，属于预期行为。

## 5. 追问与边界

**Q：为什么不用 `setInterval`？**
定时器与屏幕刷新不同步，容易错拍；且后台不自动停，持续耗电。

**Q：动画速度为什么不用「每帧 +2px」？**
不同设备帧率不同（60/120Hz），固定步长会导致快慢不一致；用 `now - start` 计算进度才稳定。

**Q：`transform` 和 `left` 选哪个？**
`transform` 只触发合成，不触发布局与重绘；`left` 每帧都可能重排。

坑：暂停只把 `running = false` 而不 `cancelAnimationFrame`，已排队的那一帧仍会执行。边界：rAF 不适合精确计时（后台会停），也不适合驱动服务端定时任务。
