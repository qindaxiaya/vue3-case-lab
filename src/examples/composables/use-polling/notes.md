# usePolling：轮询要等上一次跑完

> setInterval 只保证「到点触发」，不保证上一次已经结束；封装版用 setTimeout 链把下一次排在任务完成之后，并在页面隐藏时暂停。

## 1. 现象 / 场景

进度条每 800ms 拉一次状态，接口平时 350ms 就返回，某天服务变慢到 1300ms，请求开始叠在一起：第二次、第三次同时在路上，回调顺序乱了，面板上的进度来回跳。

复现步骤：

1. 打开「模拟慢接口（1300ms）」再点「开始轮询」；
2. 左边每 800ms 固定发一次，几秒后「当前并发」变成 2、「并发重叠」开始累加；
3. 点「模拟切到后台」：左边继续轮询，右边的轮询次数停住；
4. 点「停止」：两边都不再新增，但左边已经发出的请求仍会跑完。

## 2. 原理

`setInterval` 是「墙上的时钟」：每隔固定时间触发一次，不管上一次任务有没有完成。任务耗时超过间隔时，多个请求会同时存在；如果响应顺序和请求顺序不一致，页面就会拿到过期的数据。

`setTimeout` 链是「上一次完成后再排下一次」：任务结束（成功、失败或取消）之后才调用 `setTimeout`，所以同一时刻最多只有一个在途请求。代价是实际间隔 = 任务耗时 + 间隔，但轮询通常关心「不要堆请求」而不是「严格每 800ms 一次」。

页面隐藏时，浏览器会节流定时器，但不会替你停止轮询。封装监听 `visibilitychange`，隐藏时清掉下一次定时器，回到前台再继续；这样后台不会空转，也不会在回来时攒一堆响应。

停止时要同时做两件事：清掉下一次定时器，并中止在途请求。只清定时器的话，已经发出的请求还会回来改状态。

## 3. 方案：关键代码

```ts
function usePolling(
  task: (signal: AbortSignal) => Promise<void>,
  interval: number,
  options: PollingOptions = {},
) {
  const running = ref(false)
  const paused = ref(false)
  const count = ref(0)
  const errors = ref(0)
  const active = ref(0)

  let timer: number | null = null
  let controller: AbortController | null = null
  let generation = 0

  function hidden(): boolean {
    return options.isHidden?.() ?? (typeof document !== 'undefined' && document.hidden)
  }

  function clearTimer(): void {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  function schedule(): void {
    clearTimer()
    if (!running.value) return
    timer = window.setTimeout(() => void tick(), interval)
  }

  async function tick(): Promise<void> {
    if (!running.value) return
    if (options.pauseOnHidden && hidden()) {
      paused.value = true
      return
    }
    paused.value = false

    controller?.abort()
    const current = new AbortController()
    controller = current
    const id = ++generation
    count.value++
    active.value++

    try {
      await task(current.signal)
    } catch (err) {
      if (id === generation && !current.signal.aborted) errors.value++
    } finally {
      active.value = Math.max(0, active.value - 1)
    }

    if (!running.value || id !== generation) return
    if (options.pauseOnHidden && hidden()) {
      paused.value = true
      return
    }
    schedule()
  }

  function start(): void {
    if (running.value) return
    running.value = true
    paused.value = false
    if (options.immediate === false) schedule()
    else void tick()
  }

  function stop(): void {
    running.value = false
    paused.value = false
    generation++
    clearTimer()
    controller?.abort()
    controller = null
  }

  function sync(): void {
    if (!running.value || !options.pauseOnHidden) return
    if (hidden()) {
      paused.value = true
      clearTimer()
      return
    }
    if (paused.value) {
      paused.value = false
      void tick()
    }
  }

  function reset(): void {
    stop()
    count.value = 0
    errors.value = 0
  }

  if (typeof document !== 'undefined' && options.pauseOnHidden) {
    document.addEventListener('visibilitychange', sync)
  }

  onScopeDispose(() => {
    stop()
    if (typeof document !== 'undefined' && options.pauseOnHidden) {
      document.removeEventListener('visibilitychange', sync)
    }
  })

  return { running, paused, count, errors, active, start, stop, sync, reset }
}
```

三处为什么：

1. **用 `setTimeout` 链而不是 `setInterval`**：下一次只在 `task` 结束后安排，慢接口也不会叠出并发；`schedule` 里先 `clearTimer`，避免重复排定时器。
2. **`generation` 让旧任务闭嘴**：停止或重新开始时 `generation` 加一，旧任务回来后发现 `id !== generation` 就不再排下一次，也不会把错误算到新一轮头上。
3. **隐藏时只清「下一次」，不强行中止在途请求**：已经在路上的请求让它自然结束，避免把正常响应当成错误；回到前台再重新开始节奏。

## 4. 数据对比

| 指标 | setInterval 固定节拍 | usePolling（setTimeout 链） | 测量方式 |
|------|----------------------|-----------------------------|----------|
| 慢接口下运行 2700ms 的轮询次数 | 3 | 2 | 打开「模拟慢接口（1300ms）」后开始，读面板 `data-stat` |
| 同一时刻的并发请求 | 2 | 1 | 同上，读「当前并发」 |
| 并发重叠次数 | 2 | 0 | 同上，读「并发重叠」；封装版没有这个指标 |
| 后台 1800ms 期间新增轮询 | 2 | 0 | 点「模拟切到后台」，读「后台期间轮询」 |
| 停止后 1000ms 的计数变化 | 0 | 0 | 点「停止」后等 1000ms，比较停止前后计数 |
| 取消是否算错误 | 不涉及 | 0 | 封装版「错误次数」保持 0 |

测量说明：

- 环境：headless Chrome（`npm run check:ui -- --only 轮询节奏`），1280px 视口；
- 时间从点击「开始轮询」算起，接口延迟由「模拟慢接口」开关控制（350ms / 1300ms）；
- 计数来自 Demo 面板的 `data-stat`，没有写死毫秒；不同机器上次数可能差 1，断言用「是否出现并发 / 后台是否继续」判断。

## 5. 追问与边界（面试高频）

**Q：为什么不用 `setInterval` 加一个「进行中」锁？**
加锁也能避免并发，但锁的释放、错误分支、取消分支都要自己维护；`setTimeout` 链把「排下一次」放在任务结束之后，天然只有一个在途请求，少一个状态。

**Q：轮询间隔应该设多少？**
取决于业务对实时性的要求和服务端压力。本案例用 800ms 是为了让对比明显；真实项目常见 5s、15s、60s，并且要支持手动刷新。

**Q：页面隐藏时一定要暂停吗？**
大多数场景应该暂停：后台轮询既浪费流量，也可能让服务端统计失真。需要「后台也保持心跳」的场景要单独设计，并考虑浏览器对后台定时器的节流。

**Q：停止后为什么还要 abort？**
只清定时器只能阻止「下一次」，已经发出的请求还会回来。`abort()` 让在途请求尽快结束，配合 `generation` 保证旧结果不会写进状态。

踩坑：

1. **`setInterval` 里发请求** → 慢接口叠并发，回调顺序乱 → 改成任务结束后 `setTimeout` 排下一次。
2. **停止只 `clearInterval`** → 在途请求回来继续改状态 → 停止时同时 `controller.abort()`。
3. **后台不暂停** → 回来时攒了一堆响应，还可能触发限流 → 监听 `visibilitychange`，隐藏时清掉下一次定时器。

边界：轮询适合「状态变化不频繁、实时性要求一般」的场景；需要服务端主动推送时应该用 SSE 或 WebSocket（见 `performance/sse-chat`）。如果每次请求都可能很慢，还要加超时和最大重试次数，避免无限排队。
