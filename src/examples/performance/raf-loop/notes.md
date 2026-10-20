# 逐帧动画（requestAnimationFrame）

## 1. 现象与场景

用 `setInterval(fn, 16)` 做往返动画，画面还是一顿一顿；切到后台标签页，定时器仍在跑，笔记本发热。

复现：打开案例点「启动」，方块在轨道上正弦往返；面板帧率稳定在 60 左右，帧间隔约 16.6 毫秒。

## 2. 原理

逐帧回调（`requestAnimationFrame`）排在下一次画面重绘之前执行，天然对齐屏幕刷新；页面不可见时浏览器会自动暂停或降频，不浪费电。回调参数是当前时间戳，动画必须「按时间算进度」而不是「每帧走固定距离」，否则掉帧时速度会变慢。

正弦缓动的意义：正弦曲线在两端斜率为 0，位移到端点时速度自然归零，折返不会突然反向；线性三角波在端点速度瞬间反向，看起来生硬。

## 3. 关键代码

```ts
let rafId = 0
let running = false
let startTs = 0

function loop(now: number) {
  // 1. 用「当前时间 - 开始时间」算进度，掉帧也不会变慢
  const elapsed = (now - startTs) / 1000
  const phase = (elapsed % PERIOD) / PERIOD // 0..1
  // 2. 正弦映射到 0..1：两端速度归零，折返平滑
  const wave = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2
  // 3. 只改位移变换，不触发布局与重绘
  box.style.transform = `translateX(${wave * TRACK}px)`

  // 4. 续订由 running 控制，暂停后循环自然终止
  if (running) rafId = requestAnimationFrame(loop)
}

function stop() {
  running = false
  // 5. 必须与 requestAnimationFrame 成对，只停调度会泄漏句柄
  cancelAnimationFrame(rafId)
}
```

## 4. 数据对比

| 指标 | 启动前 | 启动后约 1.2 秒 |
|---|---|---|
| 帧率 | 0 | 60 |
| 帧间隔 | 0.0 ms | 16.6 ms |
| 累计帧数 | 0 | 约 74 |

测量方式：在页面点「启动」，等 1.2 秒读取面板。页面可见时回调正常执行；切到后台会降频甚至暂停，属于预期行为。

## 5. 追问与边界

**Q：为什么不用 `setInterval`？**
定时器与屏幕刷新不同步，容易错拍；且后台不自动停，持续耗电。

**Q：动画速度为什么不用「每帧 +2px」？**
不同设备刷新率不同（60 / 120 赫兹），固定步长会导致快慢不一致；用时间差算进度才稳定。

**Q：`transform` 和 `left` 选哪个？**
`transform` 只触发合成，不触发布局与重绘；`left` 每帧都可能让浏览器重新排版。

坑：暂停只把 `running = false` 而不取消回调，已排队的那一帧仍会执行。边界：逐帧回调不适合精确计时（后台会停），也不适合驱动服务端定时任务。
