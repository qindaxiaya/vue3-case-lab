# useAutosave：自动保存别每次按键都写

> 自动保存的难点是「什么时候写」：连续输入合并成一次，保存期间的新输入不能被旧结果覆盖，离开页面时再把待保存内容补上。

## 1. 现象 / 场景

编辑草稿时每输入一个字就写一次 `localStorage`，输入快了页面发卡；换成保存接口后，接口请求被连续按键打满，响应顺序还可能乱。关掉页面前最后一次修改，偶尔没有保存成功。

复现步骤：

1. 在输入框里连续输入 8 个字符：左边「写入次数」立刻变成 8，右边还是「有未保存修改」；
2. 停止输入约 600ms 后，右边合并成 1 次保存，状态变成「已保存」；
3. 再输入一个字符后立刻触发 `pagehide`（演示里的「模拟离开页面」由场景派发事件），右边会补一次保存；
4. 打开「模拟保存失败」再输入：右边变成「保存失败」，关掉开关点「立即保存」后恢复；
5. 点「重置」：两边计数归零，存储键被清空。

## 2. 原理

自动保存要解决三件事：

1. **合并写入**：连续输入时不要每次 `input` 都落盘。用防抖（停止输入 N 毫秒后再执行）把一段连续输入合并成一次。
2. **串行与防串台**：保存是异步的，保存期间用户可能继续输入。旧请求返回时不能把新状态改成「已保存」；用 `generation` 或请求序号判断结果是否仍然有效。
3. **离开页面兜底**：防抖计时器还没到就关页面，最后一次输入会丢。监听 `pagehide`，在离开前立即保存一次；组件卸载时也要清掉计时器、移除监听。

和「每次 input 直接写」相比，防抖版牺牲了一点实时性（最多延迟 `delay`），换来更少的写入和更稳定的状态。

## 3. 方案：关键代码

```ts
type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

interface AutosaveOptions {
  delay?: number
  save: (value: string) => Promise<void>
}

function useAutosave(source: Ref<string>, options: AutosaveOptions) {
  const delay = options.delay ?? 600
  const status = ref<SaveStatus>('idle')
  const saves = ref(0)
  const lastSavedAt = ref<Date | null>(null)

  let timer: number | null = null
  let pending: string | null = null
  let saving = false
  let generation = 0
  let first = true

  function clearTimer(): void {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  function schedule(): void {
    clearTimer()
    timer = window.setTimeout(() => void flush(), delay)
  }

  async function flush(): Promise<void> {
    clearTimer()
    if (pending === null || saving) return

    const value = pending
    pending = null
    saving = true
    const id = ++generation
    status.value = 'saving'

    try {
      await options.save(value)
      //! 保存期间又输入了，旧结果不能把新状态改成「已保存」
      if (id !== generation) return
      saves.value++
      lastSavedAt.value = new Date()
      status.value = pending === null ? 'saved' : 'dirty'
    } catch {
      if (id !== generation) return
      //! 失败时把值放回去，重试还能保存同一份内容
      if (pending === null) pending = value
      status.value = 'error'
    } finally {
      saving = false
      if (pending !== null && status.value !== 'error') schedule()
    }
  }

  function flushNow(): Promise<void> {
    return flush()
  }

  function reset(): void {
    clearTimer()
    generation++
    pending = null
    saving = false
    status.value = 'idle'
    saves.value = 0
    lastSavedAt.value = null
  }

  //! 第一次 watch 是初始值 / 恢复出来的草稿，不该再存一遍
  watch(source, (value) => {
    if (first) {
      first = false
      return
    }
    pending = value
    status.value = 'dirty'
    schedule()
  })

  function handlePageHide(): void {
    void flush()
  }

  window.addEventListener('pagehide', handlePageHide)

  onScopeDispose(() => {
    window.removeEventListener('pagehide', handlePageHide)
    clearTimer()
    if (pending !== null) void flush()
  })

  return { status, saves, lastSavedAt, flushNow, reset }
}
```

三处为什么：

1. **`watch` 第一次跳过**：初始值或从存储恢复的草稿不需要再保存一遍，否则一进页面就多一次写入。
2. **`generation` 防串台**：保存期间继续输入时，旧请求返回后发现 `id !== generation`，不会把「有未保存修改」改回「已保存」。
3. **`finally` 里重新排**：保存期间来的新输入会留下 `pending`，等当前保存结束后再排一轮；失败时不自动重排，等用户点重试或继续输入。

## 4. 数据对比

| 操作 | 手写版（每次 input 直接写） | useAutosave | 测量方式 |
|------|----------------------------|-------------|----------|
| 连续输入 8 个字符后的写入次数 | 8 | 0（仍在防抖窗口） | 每 60ms 输入一个字符，读 `data-stat="left-writes"` / `"auto-saves"` |
| 停止输入 600ms + 保存耗时后 | 8 | 1 | 再等 1000ms 读取 |
| 输入第 9 个字符后触发 `pagehide` | 9 | 2 | 派发 `pagehide`，等 400ms 读取 |
| 模拟保存失败后 | 10（仍写） | 保存次数不变，状态「保存失败」 | 打开开关，输入一个字符，等 1000ms |
| 关闭失败开关并重试 | 10 | 3，状态「已保存」 | 点「立即保存」，等 400ms |
| 重置后 | 0 | 0，状态「等待输入」 | 点「重置」，等 250ms |

测量说明：

- 环境：headless Chrome（`npm run check:ui -- --only 自动保存`），1280px 视口；
- 输入用原生 `textarea` 的 `input` 事件，间隔 60ms；防抖 600ms、保存耗时 250ms 都来自代码；
- 计数来自面板的 `data-stat`，存储内容直接读 `localStorage`，断言两边最终都是 10 个字符。

## 5. 追问与边界（面试高频）

**Q：防抖和节流怎么选？**
自动保存通常用防抖：用户停下来才写，连续输入合并成一次。节流适合「固定频率上报」（如滚动位置），不适合这里。

**Q：保存失败怎么办？**
保留待保存的内容（案例把值放回 `pending`），显示失败状态，提供重试；不要静默丢掉。必要时加最大重试次数和退避。

**Q：为什么监听 `pagehide` 而不是 `beforeunload`？**
`pagehide` 在页面进入后退 / 前进缓存和关闭时都会触发，兼容性更好；`beforeunload` 适合提示「有未保存修改」，不适合做异步保存。移动端还要考虑页面被系统杀掉的情况，关键内容应该更早保存。

**Q：多个字段怎么保存？**
可以保存一个对象快照，或者给每个字段一个 `useAutosave`。注意合并成一次请求，避免多个字段各发一次。

踩坑：

1. **每次 input 都写** → 输入 8 个字符写 8 次，接口被打满 → 防抖合并。
2. **保存期间又输入** → 旧请求返回把状态改成「已保存」，新内容其实没存 → `generation` 判断结果是否仍然有效。
3. **只防抖不做离开兜底** → 用户打完最后一个字立刻关页面，计时器没到，内容丢了 → `pagehide` 时 `flush()`。
4. **卸载只清计时器** → `pagehide` 监听还挂着 → `onScopeDispose` 里一起移除。

边界：自动保存适合草稿、笔记、设置项；涉及支付、发布等关键操作仍要显式提交和二次确认。保存到服务端时还要处理鉴权、冲突（多端同时编辑）和离线队列，这些不是防抖能解决的。
