# RemoteSelect：远程搜索别被旧结果覆盖

## 1. 现象 / 场景

后台选负责人、选商品、选客户时，选项来自接口。用户输入「张」还没返回就改成「李」，列表却先闪出张伟，再被李娜覆盖；网络慢时还会每敲一个字发一次请求。

复现步骤：

1. 打开案例，输入「张」，等待约 300ms，请求发出。
2. 马上把输入改成「李」，再等约 700ms。
3. 结果只显示李娜、李强，实际请求 2 次，丢弃旧响应 1 次。
4. 点「李娜」，选中项变成「李娜 · 设计组」，列表关闭。

## 2. 原理

远程搜索有两个独立问题：请求太多，和旧响应晚到。

防抖解决请求太多：输入停止 250ms 后才发请求，连续敲字只发最后一次。请求序号解决旧响应晚到：每次请求带一个递增 token，回调时 token 不是最新的就丢弃，不写结果。

只做防抖不够，因为两个请求仍可能乱序返回；只做序号不防抖，请求量还是下不来。加载态也要有，否则用户不知道是在搜、还是没结果。

## 3. 方案：关键代码

```ts
//! 输入后等 250ms 再请求，避免每敲一个字都打接口
function onInput(value: string): void {
  keyword.value = value
  selected.value = null
  if (debounceTimer !== null) window.clearTimeout(debounceTimer)
  if (!value.trim()) {
    results.value = []
    loading.value = false
    return
  }
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null
    void fetchResults(value.trim())
  }, 250)
}

//! token 不是最新的：这次响应已经过期，直接丢掉
function fetchResults(query: string): void {
  queryCount.value++
  const token = ++requestToken
  loading.value = true
  const timer = window.setTimeout(() => {
    requestTimers.delete(timer)
    if (token !== requestToken) {
      staleDropped.value++
      return
    }
    results.value = people.filter(
      (person) => person.name.includes(query) || person.dept.includes(query),
    )
    loading.value = false
  }, 350)
  requestTimers.add(timer)
}

//! 清空时取消在途请求并让 token 失效
function clear(): void {
  if (debounceTimer !== null) window.clearTimeout(debounceTimer)
  requestToken++
  for (const timer of requestTimers) window.clearTimeout(timer)
  requestTimers.clear()
  keyword.value = ''
  results.value = []
  selected.value = null
  loading.value = false
}
```

三处关键选择：

1. 防抖计时器和请求计时器分开：输入变化只清防抖，已经发出的请求仍会回来，靠 token 判断是否过期。
2. 请求序号在发请求时自增，而不是在回调时自增；这样每个请求拿到的是发出时的序号。
3. 清空时把 token 再加一，所有在途请求都会变成过期响应，不会把结果写回空列表。

## 4. 数据对比

| 操作 | 实际请求 | 丢弃旧响应 | 结果姓名 | 测量方式 |
| --- | --- | --- | --- | --- |
| 输入「张」后改「李」 | 2 | 1 | 李娜、李强 | 页面 data-stat 读数 |
| 选中李娜 | 2 | 1 | 列表关闭 | 选中项与 open 状态 |
| 点清空 | 2 | 1 | — | 结果数 0 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/remote-select`。
- 取样：`npm run check:ui -- --only 远程搜索` 的常驻场景，同一页面顺序执行。
- 防抖 250ms、请求 350ms 是 Demo 固定值，用来制造乱序窗口；不是接口性能结论。

## 5. 追问与边界（面试高频）

- Q: 防抖和节流选哪个？ → A: 搜索用防抖：用户停下来再请求；滚动加载用节流：固定间隔取样。
- Q: 有 AbortController 还需要 token 吗？ → A: 能取消就取消，取消不了（例如某些 SDK）就用 token 兜底；两者不冲突。
- Q: 空结果要不要显示？ → A: 要。加载中、无结果、初始态是三件事，不要都显示成空白列表。

踩坑（≤3 条）：

1. 只防抖不做竞态：两个请求乱序返回，旧结果覆盖新结果 → 加 token 或取消旧请求。
2. 输入变化时清掉所有请求计时器：旧请求永远不返回，看不到竞态问题，但也失去了「取消」语义 → 分清防抖计时器和请求计时器。
3. 选中后还允许旧请求写结果：列表已经关了又弹出来 → 选中 / 清空时让 token 失效。

边界：真实项目还要处理请求失败、重试、缓存；本例只演示搜索节奏与竞态，失败重试可参考组合式函数分类里的异步请求案例。
