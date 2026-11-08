# ImportProgress：长任务进度要能暂停和取消

## 1. 现象 / 场景

后台导入几万条数据，进度条自己走到 100%，其实后台还没处理完；用户点暂停没反应，点取消后进度还在涨，只能刷新页面。

复现步骤：

1. 默认「分批处理」模式，点开始：已处理按 10 条一批增加，进度同步上涨。
2. 点暂停后等 300ms：已处理与进度都不变，状态「已暂停」。
3. 点继续：从暂停的条数接着增加。
4. 点取消后等 300ms：状态「已取消」，已处理不再增加，进度没到 100%。
5. 切「假进度」点开始：百分比到 100%，但已处理仍是 0。

## 2. 原理

进度必须来自真实处理量，不能靠定时器「假装」。长任务要分批做，每批完成再排下一批；这样主线程不会被一次性循环占满，进度也能反映真实完成度。

暂停不是把状态改一下：要清掉下一批的定时器，但保留已经处理到哪里的游标。继续时从游标重新排批，不能从头开始。取消要作废在途任务，之后任何晚到的回调都不能再改状态。

组件卸载时也要清理定时器，否则页面切走后回调还会访问已经销毁的组件状态。

## 3. 方案：关键代码

```ts
//! 真实模式：每批处理 BATCH_SIZE 行，处理完再排下一批
function scheduleBatch(): void {
  batchTimer = window.setTimeout(() => {
    batchTimer = null
    if (status.value !== 'running') return
    processed.value = Math.min(TOTAL, processed.value + BATCH_SIZE)
    if (processed.value >= TOTAL) {
      status.value = 'done'
      return
    }
    scheduleBatch()
  }, BATCH_MS)
}

//! 暂停只停下一批，已经处理完的进度保留
function pause(): void {
  if (mode.value !== 'batch' || status.value !== 'running') return
  if (batchTimer !== null) {
    window.clearTimeout(batchTimer)
    batchTimer = null
  }
  status.value = 'paused'
}

//! 取消要作废在途定时器，否则取消后还会继续加进度
function cancel(): void {
  if (status.value !== 'running' && status.value !== 'paused') return
  clearTimers()
  status.value = 'cancelled'
}
```

三处关键选择：

1. 用 `setTimeout` 链而不是 `setInterval`：每批处理完才排下一批，慢批次不会堆积。
2. 暂停时把定时器置空，继续时重新排；游标就是 `processed`，不需要额外变量。
3. 取消和卸载都走 `clearTimers`，避免晚到的回调把已取消的状态改回去。

## 4. 数据对比

| 操作 | 已处理 | 进度 | 状态 | 测量方式 |
| --- | --- | --- | --- | --- |
| 初始 | 0 | 0% | 待开始 | 页面 data-stat 读数 |
| 开始 340ms | 20 | 17% | 处理中 | 同上 |
| 暂停后等 300ms | 20 | 17% | 已暂停 | 同上 |
| 继续 280ms | 40 | 33% | 处理中 | 同上 |
| 取消后等 300ms | 40 | 33% | 已取消 | 同上 |
| 假进度 700ms | 0 | 100% | 已完成（假进度） | 同上 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/import-progress`。
- 取样：`npm run check:ui -- --only 导入进度` 的常驻场景，同一页面顺序操作。
- 每批 10 行、间隔 120ms 是 Demo 固定值；真实项目耗时取决于接口，不能用这里的毫秒当性能结论。

## 5. 追问与边界（面试高频）

- Q: 为什么不用 `setInterval`？ → A: 批次处理时间不确定，固定间隔会堆积；`setTimeout` 链是「处理完再排下一批」。
- Q: 暂停后刷新页面还能继续吗？ → A: 内存游标会丢；要持久化已处理游标或后端任务 id，刷新后恢复。
- Q: 取消要通知后端吗？ → A: 要。前端取消只停本地轮询，后端任务也要标记取消，否则仍在跑。

踩坑（≤3 条）：

1. 只改状态不清定时器：暂停后进度还在涨 → 暂停必须清下一批定时器。
2. 取消后不判断状态：晚到的回调把状态改回处理中 → 回调开头检查状态。
3. 卸载不清理：切页后定时器仍在跑 → `onUnmounted` 统一清理。

边界：真实长任务通常交给后端队列，前端轮询任务状态；本例用前端分批模拟，重点在进度、暂停与取消的状态管理。
