# 长列表时间切片

## 1. 现象 / 场景

报表页一次渲染 1 万行，打开先白屏，渲染期间点按钮没反应，用户以为页面卡死。

复现步骤：

1. 打开案例，点「一次性全量」，记录首帧与总耗时。
2. 渲染期间点「测主线程响应」，观察点击延迟。
3. 点「时间切片（300 / 帧）」重跑同一批数据，对比首帧与可交互时间。

## 2. 原理

Vue 侧：`rows.value = 一万条` 只触发一次更新，但 renderer 会在同一个宏任务里同步创建一万个 vnode 和真实 DOM。任务不结束，浏览器就没有机会插入渲染帧，也没机会处理输入事件。

浏览器侧：主线程的事件循环是「一个任务做完再做下一个」。超过 50ms 的任务就是长任务，期间布局、绘制、点击回调全部排队；用户看到的就是白屏和「点不动」。

切片把一次长任务拆成 34 个短任务：每帧只 push 300 条，然后通过 `requestAnimationFrame` 主动交还主线程，浏览器在两帧之间完成绘制和输入处理。代价是总耗时变长（每帧都有调度与重复渲染开销），换来的是首帧更快、页面始终能响应。

注意 `nextTick` 是微任务，仍在当前宏任务里清空，不能真正让出主线程；要分片必须用 rAF、`setTimeout` 或 `requestIdleCallback`。

## 3. 方案：关键代码

```ts
function renderSlice(): void {
  const t0 = performance.now()
  let produced = 0

  const step = (): void => {
    rows.value.push(...makeRows(BATCH, produced))
    produced += BATCH
    frames.value++

    if (produced < TOTAL) {
      // ① 用 rAF 而不是 while/nextTick：每帧只做一批，然后交还主线程
      rafId = requestAnimationFrame(step)
    } else {
      totalMs.value = performance.now() - t0
      rendering.value = false
    }
  }

  // ② 从 rAF 开始，保证第一批也落在下一帧，首屏先出现
  rafId = requestAnimationFrame(step)
}

onBeforeUnmount(() => {
  // ③ 卸载时取消，否则组件销毁后回调还会继续追加数据
  cancelAnimationFrame(rafId)
})
```

## 4. 数据对比

| 指标 | 一次性全量 | 时间切片（300 / 帧） | 测量方式 |
|------|-----------|---------------------|----------|
| 首帧耗时 | 20 ms | 5 ms | Demo 面板 `firstPaintMs`，`performance.now()` |
| 总耗时 | 21 ms | 894 ms | 1 万条全部挂载完成 |
| 帧数 | 0 | 34 | rAF 回调次数 |
| 点击响应 | 36 ms | 35 ms | `ping()`：`setTimeout(0)` 排队延迟 |

测量说明：

- 环境：Chrome headless 1200×900、Vite dev、Windows，未开 CPU 节流；同一操作 3 次取中位数。
- 数据规模：10,000 条，每批 300 条。
- 局限：headless 下全量渲染只有 21ms（本次中位数），没有形成 >50ms 的长任务，所以点击延迟接近；低端手机或更大数据量下差距会明显放大。总耗时不能作为切片优劣的唯一指标。

## 5. 追问与边界（面试高频）

- Q: 切片后总耗时更久，为什么还值得？ → A: 用户感知的是首屏和可交互时间。切片让首帧先出现、点击不被堵住；总耗时是后台成本。
- Q: 为什么不用 `requestIdleCallback`？ → A: 空闲时机不可控，首屏可能等很久。rAF 更「尽快但分片」，idle 适合后台补数据，并要加 `timeout` 兜底。
- Q: 切片能替代虚拟列表吗？ → A: 不能。切片只改变任务节奏，DOM 仍然是一万条；只需要展示一屏时优先虚拟滚动。

踩坑：

1. 切片过程中重复点按钮 → 多组 rAF 并发追加，数据翻倍；用 `rendering` 禁用按钮或版本号校验。
2. 卸载未 `cancelAnimationFrame` → 回调继续跑，控制台报错或内存泄漏。
3. 每批数量拍脑袋 → 太小帧数多、太大又卡；一般 100~500 条/帧，按设备实测调。

边界：几万条以上、只展示视口内容时用虚拟列表；必须全量展示/导出/打印时再用切片。数据量小于一屏时切片反而增加总耗时。
