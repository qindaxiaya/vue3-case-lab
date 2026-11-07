# useAsyncTask：异步请求的状态机

> 手写版把 loading / error / data 拆成三个 ref，取消只能丢结果；封装版用五种状态 + AbortController 把取消、重试、卸载清理一次收好。

## 1. 现象 / 场景

一个搜索框接上接口后，常见代码是这样：`loading` 一个 ref、`error` 一个 ref、`data` 一个 ref，再写一段 `try / catch / finally`。用户连续输入两次，第一个请求晚回来，把第二个请求的结果覆盖掉；点「取消」只是把 `data` 清空，网络请求还在跑。

复现步骤：

1. 点「慢请求后立刻再发」：左边慢请求的定时器还在跑，右边慢请求被真正中止；
2. 点「取消」：左边状态显示已取消，但「仍在跑」还是 1；右边「取消次数」加一，状态是已取消；
3. 点「失败请求」：两边都进入失败态，但右边不会把取消误判成失败。

## 2. 原理

异步请求至少有五种状态：未开始、进行中、成功、失败、已取消。只用一个 `loading` 布尔值表达不了「已取消」和「被新请求取代」，于是页面里到处补 `if (token !== manualToken) return`。

`AbortController` 提供一条「取消信号」：把它传给 `fetch` 或自己写的异步任务，调用 `controller.abort()` 后，任务会收到 `abort` 事件并抛出一个名字为 `AbortError` 的异常。这个异常不是业务失败，应该单独映射成「已取消」，而不是显示红色的「请求失败」。

组件卸载时也要调用 `abort()`：否则请求回来后还会去改已经卸载组件的状态。封装里用 `onScopeDispose` 统一收口，组件卸载和 `effectScope.stop()` 都会走到。

## 3. 方案：关键代码

```ts
function useAsyncTask<T, P>(task: (payload: P, signal: AbortSignal) => Promise<T>) {
  const status = ref<TaskStatus>('idle')
  const data = ref<T | null>(null)
  const error = ref('')
  const runs = ref(0)
  const aborts = ref(0)

  let controller: AbortController | null = null
  let lastPayload: P | null = null
  let hasLast = false
  let runId = 0

  async function execute(payload: P): Promise<void> {
    if (controller) {
      aborts.value++
      controller.abort()
    }
    const id = ++runId
    const current = new AbortController()
    controller = current
    lastPayload = payload
    hasLast = true
    runs.value++
    status.value = 'pending'
    data.value = null
    error.value = ''

    try {
      const result = await task(payload, current.signal)
      if (id !== runId) return
      data.value = result
      status.value = 'success'
    } catch (err) {
      if (id !== runId) return
      if (current.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        aborts.value++
        status.value = 'aborted'
        return
      }
      error.value = err instanceof Error ? err.message : String(err)
      status.value = 'error'
    } finally {
      if (controller === current) controller = null
    }
  }

  function abort(): void {
    controller?.abort()
  }

  function retry(): Promise<void> {
    if (!hasLast || lastPayload === null) return Promise.resolve()
    return execute(lastPayload)
  }

  function reset(): void {
    runId++
    controller?.abort()
    controller = null
    lastPayload = null
    hasLast = false
    status.value = 'idle'
    data.value = null
    error.value = ''
  }

  onScopeDispose(() => controller?.abort())

  return { status, data, error, runs, aborts, execute, abort, retry, reset }
}
```

三处为什么：

1. **每次请求都新建 `AbortController`**：旧控制器只负责中止旧请求，新请求有自己的信号；共用同一个控制器会把「取消上一次」和「取消这一次」混在一起。
2. **`runId` 与 `signal.aborted` 双保险**：`AbortController` 管真正中止，`runId` 管结果是否还属于当前这一轮；两者一起用，旧响应既不会覆盖新结果，也不会被误算成取消。
3. **`AbortError` 单独分支**：取消是用户主动行为，不是接口报错；如果落进 `catch` 的失败分支，页面会出现「取消成功却显示红色错误」的矛盾状态。

## 4. 数据对比

| 操作 | 手写 loading / error / data | useAsyncTask | 测量方式 |
|------|-----------------------------|--------------|----------|
| 正常请求一次 | 请求次数 1、过期响应 0、仍在跑 0 | 请求次数 1、取消次数 0 | 点「正常请求（700ms）」，读面板 `data-stat` |
| 慢请求后立刻再发 | 请求次数 2、过期响应 1、仍在跑 0 | 请求次数 2、取消次数 1 | 点「慢请求后立刻再发」，等 1600ms 后读计数 |
| 取消慢请求 | 状态「已取消」、仍在跑 1（定时器没停） | 状态「已取消」、取消次数 1 | 点「慢请求」后立刻点「取消」，读状态与计数 |
| 失败请求 | 状态「失败」、错误文案来自接口 | 状态「失败」、错误文案来自接口 | 点「失败请求」后读状态 |
| 组件卸载 | 手动清理所有定时器 | `onScopeDispose` 中止在途请求 | 路由往返一次，控制台无残留回调 |

测量说明：

- 环境：headless Chrome（`npm run check:ui -- --only 异步请求状态机`），页面在 1280px 下打开；
- 计数全部来自 Demo 面板的 `data-stat`，不写死毫秒；延迟是按钮上标注的 700 / 1600 / 500ms；
- 「仍在跑」只统计手写版还活着的定时器，封装版用 `AbortController` 取消后为 0。

## 5. 追问与边界（面试高频）

**Q：为什么不直接用一个 `loading` 布尔值？**
布尔值只能表达「在不在跑」，表达不了「成功、失败、已取消」三种结束方式。状态机把互斥的状态收进一个字段，模板和逻辑都不用再猜。

**Q：取消后为什么还要判断 `runId`？**
`AbortController` 能中止请求，但中止和结果返回之间仍有异步间隙；`runId` 保证「这一轮已经过期」的结果不会写进状态。两者职责不同，不能互相替代。

**Q：`retry` 应该重放上一次参数吗？**
本案例重放 `lastPayload`，适合「搜索 / 查询」这类幂等请求；下单、支付这类非幂等操作不要自动重试，应该让用户确认后重新发起。

**Q：卸载时只 abort 够不够？**
够中止网络请求，但如果任务里还有自己写的 `setTimeout` 或轮询，仍要在 `onScopeDispose` 里一起清理；本案例的 `fakeRequest` 在收到 `abort` 时会清掉定时器。

踩坑：

1. **把 `AbortError` 当失败** → 用户点取消后页面出现红色错误提示 → 在 `catch` 里先判断 `signal.aborted` 或 `err.name === 'AbortError'`。
2. **新请求不取消旧请求** → 旧响应晚回来覆盖新结果 → 每次 `execute` 先 `controller.abort()`，并用 `runId` 丢弃过期结果。
3. **卸载时不 abort** → 请求回来后回调还在改状态，控制台偶发警告 → 在 `onScopeDispose` 里统一取消。

边界：这套封装适合「一次只关心最新结果」的请求；需要并发跑多个请求并分别保留结果时，应该每个任务一个实例，或者用请求池管理，而不是共用一个 `status`。文件上传这类需要进度事件的请求，还要在任务里额外接进度回调。
