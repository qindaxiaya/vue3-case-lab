# 请求竞态与取消

## 1. 现象 / 场景

搜索框里边打字边请求，输入 `vue` 后页面先显示 `vue` 的结果，过一会儿却被更早发出的 `v` 结果覆盖。搜索框里是 `vue`，列表却是 `v` 的内容，用户以为搜错了。

复现步骤：

1. 打开案例，在「不取消旧请求」模式下点「模拟快速输入」。
2. 等三次请求都回来，观察搜索结果来自「v」，但输入框是「vue」，统计显示「旧响应覆盖 2」。
3. 切到「取消旧请求（推荐）」再跑一次，观察旧请求变成「被新请求取消」，最终结果与输入一致。

## 2. 原理

请求的返回顺序不受发送顺序控制。模拟接口里 `v` 延迟 900ms、`vu` 延迟 600ms、`vue` 延迟 300ms，发送间隔 90ms，于是返回顺序正好是 `vue → vu → v`。如果每次回调都直接写 `result`，最后写进去的就是最旧的 `v`。

`AbortController` 提供一个 `signal`。发新请求前调用上一条的 `abort()`，`fetch` 会以 `AbortError` 拒绝，`setTimeout` 模拟的接口则在 `abort` 事件里清掉定时器。这样旧请求根本没有机会写状态。

如果接口拿不到 signal（第三方 SDK、旧浏览器封装），就用请求编号：每次发请求 `++requestId`，回来时判断自己的编号是否还是最新，不是就丢弃。两种方案都能防串台，取消还能真正省掉网络与解析开销。

Vue 侧还要处理「重置」：重置会取消在途请求并清空日志，但被取消的请求稍后仍会进入 catch。案例用 `generation` 代数判断，重置后旧请求直接返回，不会把 `aborted` 计数加回来。

## 3. 方案：关键代码

```ts
let controller: AbortController | null = null
let generation = 0

async function run(keyword: string): Promise<void> {
  const id = ++seq
  const gen = generation

  let activeController: AbortController | undefined
  if (mode.value === 'abort') {
    // ① 发新请求前取消旧请求，旧请求不会再写结果
    controller?.abort()
    controller = new AbortController()
    activeController = controller
  }

  try {
    const items = await fakeSearch(keyword, activeController?.signal)
    // ② 重置后回来的请求直接丢弃，避免污染新一轮演示
    if (gen !== generation) return
    result.value = { forQuery: keyword, items }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      // ③ 主动取消不是失败，单独计数，不要弹错误提示
      stats.aborted++
      return
    }
    throw error
  }
}

function reset(): void {
  generation++
  controller?.abort()
  controller = null
}
```

## 4. 数据对比

| 指标 | 不取消旧请求 | 取消旧请求 | 测量方式 |
|------|--------------|------------|----------|
| 最终结果来源 | v（输入是 vue） | vue | 结果标题「来自」 |
| 旧响应覆盖 | 2 次 | 0 次 | 案例统计 |
| 取消次数 | 0 次 | 2 次 | 案例统计 |
| 最终状态 | 串台 | 正确 | 统计右侧徽标 |

测量说明：

- 环境：Chrome headless 155、1200×900、Vite dev；模拟接口延迟 v 900ms / vu 600ms / vue 300ms，发送间隔 90ms。
- 取样：同一流程重复 3 次，三种统计完全一致，表中为一次结果。
- 本案例是行为指标，没有性能差异；取消的收益在网络真实耗时上，模拟接口只能看到状态差异。

## 5. 追问与边界（面试高频）

- Q: 取消后还需要判断结果是否最新吗？ → A: 需要。`abort` 与响应可能擦肩而过，双保险能挡住边界情况，也方便以后换接口。
- Q: 为什么不用 debounce 就够了？ → A: debounce 只减少请求数，不能保证最后一条一定最后返回；慢请求仍可能覆盖快请求。
- Q: `AbortError` 要提示用户吗？ → A: 不要。主动取消是预期行为，提示只会制造噪音。

踩坑：

1. 用同一个 `AbortController` 发多条请求 → 取消一条会连带取消其他请求，每次请求都要新建。
2. 重置时只清 UI 不取消请求 → 旧请求回来又把日志和结果写回来。
3. 把取消当成失败弹 toast → 用户每输入一个字就收到一次错误提示。

边界：接口不支持取消时只能用编号或「最后一次」标记；需要保留每个关键词结果做缓存时，不要用单一 `result`，改成按关键词存 Map，再判断当前关键词取哪一份。
