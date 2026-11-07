# ConfirmAction：确认框要能等异步结果

## 1. 现象 / 场景

后台点删除，弹确认框，点确认后接口还在转，框已经关了；请求失败只能再弹一次提示，用户得重新找那条数据。原生 confirm 会阻塞页面，连 loading 和错误信息都显示不了。

复现步骤：

1. 点「删除草稿」打开确认框，点取消，框关闭且取消次数 +1。
2. 再点删除并确认，按钮进入「提交中…」，成功后才关闭。
3. 打开「模拟提交失败」，点发布并确认，失败后框不关，框内显示失败原因。
4. 关掉失败开关，直接点同一个确认按钮重试，成功后关闭。

## 2. 原理

确认框分两段：用户确认前是「问一句」，确认后是「等结果」。很多实现把确认和请求拆在两个地方，框一关就丢了上下文。

Promise 式确认框把两段接在一起：调用方 `await confirm(options)`，点取消得到 `false`，点确认后先 loading，等 `options.task()` 成功才关闭并返回 `true`，失败则留在框里显示错误。

三种出口都要结算 Promise：取消、成功、失败。漏掉任何一个，调用方的 `await` 就会一直挂着；失败时关闭框则会让用户丢失重试入口。

## 3. 方案：关键代码

```ts
//! 打开时返回 Promise，调用方 await 后拿结果
function confirm(next: ConfirmOptions): Promise<boolean> {
  if (open.value) return Promise.resolve(false)

  options.value = next
  error.value = ''
  loading.value = false
  open.value = true

  return new Promise<boolean>((resolve) => {
    resolver = resolve
  })
}

//! 确认后先 loading；成功才关，失败留在框里显示原因
async function handleOk(): Promise<void> {
  if (!options.value || loading.value) return
  loading.value = true
  error.value = ''

  try {
    await options.value.task()
    close(true)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '操作失败'
    loading.value = false
  }
}

//! 取消 / 遮罩 / Esc 都走同一个出口
function handleCancel(): void {
  if (loading.value) return
  close(false)
}
```

三处关键选择：

1. `resolver` 只存一个：确认框同一时间只允许一个，重复调用直接返回 `false`。
2. 失败不调用 `close`：保留 `options` 和错误信息，用户能原地点重试。
3. `loading` 同时锁取消按钮和遮罩，避免提交中误关。

## 4. 数据对比

| 操作 | 打开次数 | 取消 | 成功 | 失败 | 最近结果 |
| --- | --- | --- | --- | --- | --- |
| 初始 | 0 | 0 | 0 | 0 | — |
| 删除 → 取消 | 1 | 1 | 0 | 0 | 取消 |
| 删除 → 确认成功 | 2 | 1 | 1 | 0 | 成功 |
| 发布 → 确认失败 | 3 | 1 | 1 | 1 | 失败 |
| 失败后重试成功 | 3 | 1 | 2 | 1 | 成功 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/confirm-action`。
- 取样：`npm run check:ui -- --only 确认框` 的常驻场景。
- 500ms / 600ms 是 Demo 固定的模拟接口延迟，不是接口性能结论。

## 5. 追问与边界（面试高频）

- Q: 为什么不直接 `window.confirm`？ → A: 它会阻塞主线程，不能显示 loading、错误和自定义按钮，也没法等待异步结果。
- Q: 失败后为什么要留在框里？ → A: 用户刚确认过，重试成本最低；关掉再弹一次，用户得重新找数据、重新确认。
- Q: 多个确认同时触发怎么办？ → A: 同一时间只保留一个，重复调用直接返回 `false` 并计数；需要排队时再做队列，但后台操作通常不该排队。

踩坑（≤3 条）：

1. 点确认就关框：接口失败后用户不知道发生了什么 → 成功才关，失败留在框里。
2. 取消 / 遮罩 / Esc 各写一套：某个出口忘记 resolve，调用方一直挂着 → 统一走 `handleCancel`。
3. 提交中允许取消：请求还在跑，界面已经关了 → `loading` 时锁住取消和遮罩。

边界：本例只做单确认框，不含焦点陷阱和滚动锁；复杂表单弹窗建议直接用成熟组件库的 Dialog。需要「确认后跳转」时，在 `await confirm` 返回 `true` 后再导航。
