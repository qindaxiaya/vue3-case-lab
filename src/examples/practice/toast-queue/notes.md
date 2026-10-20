# Toast 通知队列

## 1. 现象与场景

一次操作弹了 8 条 Toast，屏幕被糊满；后来的通知把前面的顶掉，用户根本没看清；鼠标悬停时进度条停了，但通知还是消失了。

复现：点「批量推 8 条」，屏上只保留 3 条，其余排队；关闭一条，队列头部立即补位。

## 2. 原理

Toast 分「显示区」和「排队区」：显示区限制最大数量，满了就入队；关闭时从队头补位，既保证顺序，又让屏幕始终尽量满。

消失计时不手写 `setTimeout`，而是让 CSS 进度条动画驱动：`animationend` 触发关闭。悬停时 `animation-play-state: paused` 会真正暂停动画，进度条和消失时机天然同步，不需要维护「剩余时间 + 恢复」的逻辑。

## 3. 关键代码

```ts
const visible = ref<Toast[]>([])
const queued = ref<Toast[]>([])
const MAX_VISIBLE = 3

function push(type: Toast['type'], message: string, duration = 3200): void {
  const t = { id: nextId++, type, message, duration }
  // 1. 未满直接上屏，满了排队
  if (visible.value.length < MAX_VISIBLE) visible.value.push(t)
  else queued.value.push(t)
}

function dismiss(id: number): void {
  visible.value = visible.value.filter((t) => t.id !== id)
  // 2. 队头补位，保证顺序且屏上尽量满
  const next = queued.value.shift()
  if (next) visible.value.push(next)
}

// 3. 进度条 animationend 触发关闭；悬停暂停动画即暂停计时
// <div class="toast-progress" :style="{ animationDuration: t.duration + 'ms' }"
//      @animationend="dismiss(t.id)" />
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 屏上最多 | 3 条 |
| 一次推 8 条 | 3 条显示 + 5 条排队 |
| 单条时长 | 3200 ms |
| 关闭后补位 | 1 条（队头） |
| 悬停计时 | 动画暂停，`animationend` 延后 |

测量方式：Chrome headless 1200×900 点「批量推 8 条」，读取屏上/队列数量；关闭一条观察补位。时长与上限来自 Demo 配置。

## 5. 追问与边界

**Q：为什么不用 `setTimeout` 关闭？**
悬停暂停时定时器仍在走，会出现「进度条停着，通知却消失」；CSS 动画与 `animationend` 天然一致。

**Q：同一条消息重复弹怎么办？**
按 `type + message` 去重，或对相同消息累加计数（「已收到 3 条」），避免刷屏。

**Q：多条同时结束时会不会闪？**
关闭后立即补位，可能出现连续切换；可加 100~200ms 间隔让视觉更稳。

坑：`visible` 直接 `splice` 修改虽能触发，但补位逻辑容易漏；统一用「过滤 + 队头 shift」更清晰。边界：需要分组堆叠、自定义渲染、SSR 时用 vue-toastification 等成熟库。
