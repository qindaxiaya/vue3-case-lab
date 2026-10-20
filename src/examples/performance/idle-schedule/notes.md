# requestIdleCallback 空闲调度

## 1. 现象与场景

首屏后要解析 200 条数据，直接同步跑，页面卡住半秒，用户点按钮没反应；放进 `setTimeout` 也只是换了个时间卡。

复现：点「立即执行」，主线程被占满，进度条从 0 直接跳到 200；点「空闲执行」，进度条分多片推进，期间仍可交互。

## 2. 原理

`requestIdleCallback` 把任务排到浏览器「空闲帧」执行，回调收到 `deadline`，用 `deadline.timeRemaining()` 判断本帧还剩多少预算。每片只干到剩余 <2ms 就让出主线程，下一帧空闲再续，长任务被拆成多个短任务。

`timeout` 不是预算，而是等待上限：主线程一直忙时，最多等 200ms 就强制调用（`didTimeout = true`），防止任务被饿死。分片必须可续订、可取消，否则切页后还会继续跑。

## 3. 关键代码

```ts
function onIdle(deadline: IdleDeadline) {
  const start = processed
  // 1. 预算内尽量多干，剩余不足 2ms 就让出主线程
  while (processed < TOTAL && deadline.timeRemaining() > 2) {
    doOneUnit(processed++)
  }
  // 2. 没做完就续订下一片，形成分片循环
  if (processed < TOTAL) {
    idleHandle = requestIdleCallback(onIdle, { timeout: 200 })
  }
}

// 3. timeout 只是防饿死兜底；取消必须与预约成对
function cancelIdleWork() {
  cancelIdleCallback(idleHandle)
}
```

## 4. 数据对比

| 指标 | 立即执行 | 空闲执行 |
|---|---|---|
| 任务总量 | 200 条 | 200 条 |
| 主线程占用 | 1 次连续长任务 | 多次短任务（每片剩余 <2ms 即停） |
| 交互响应 | 期间冻结 | 分片间隙可响应 |
| 最坏等待 | 无 | `timeout: 200ms` 兜底 |

测量方式：Chrome headless 1200×900 打开案例，读取「0 / 200」初始进度；两种模式各跑一次，观察分片日志的片数与耗时。具体阻塞毫秒随设备性能波动，结论看「单次长任务 vs 多片短任务」。

## 5. 追问与边界

**Q：为什么不用 `setTimeout(fn, 0)` 分片？**
`setTimeout` 最小延迟被钳制到 4ms 左右，且不区分忙闲；rIC 真正利用空闲时间，忙时让路。

**Q：`timeRemaining()` 为什么刚进回调就可能接近 0？**
`didTimeout = true` 的兜底调用没有空闲预算，这时应立即做最小工作并尽快退出。

**Q：Safari 不支持怎么办？**
用 `setTimeout` 造一个假 `deadline`（`timeRemaining: () => 8`）降级，业务代码路径不变。

坑：回调里做 DOM 写入会触发布局，预算很快耗尽；重活放计算，渲染留给 Vue。边界：对时效敏感的任务（动画、输入反馈）不要用 rIC，它可能等很久。
