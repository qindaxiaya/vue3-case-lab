# useEventListener / useRafFn 封装范式

## 1. 现象与场景

路由切走再切回，同一个页面的事件监听器数量翻倍；rAF 动画在组件卸载后还在跑。

复现：反复进入/离开案例页，观察「活跃监听器」从 1 变 2、3；或在 rAF 运行中切走，回调仍在执行。

## 2. 原理

`addEventListener` 和 `requestAnimationFrame` 是浏览器资源，不归 Vue 的响应式系统管。组件卸载只清理模板、响应式副作用和组件内注册的 watcher，不会替你 `removeEventListener` / `cancelAnimationFrame`。

封装的核心不是「多写一个函数」，而是把**创建与清理放进同一个作用域**：调用方只负责用，清理由 composable 的 `onUnmounted` 兜底。控制函数还要幂等——`resume()` 调两次不能启动两条 rAF 链，否则帧率翻倍。

## 3. 关键代码

```ts
export function useEventListener(target: EventTarget, type: string, handler: (e: Event) => void): void {
  target.addEventListener(type, handler)
  // 1. 清理与创建写在一起，调用方永远不用记得 remove
  onUnmounted(() => target.removeEventListener(type, handler))
}

export function useRafFn(fn: (t: number) => void) {
  let rafId = 0
  let active = false
  function resume(): void {
    // 2. 幂等保护：已运行就直接返回，避免双倍帧率回调
    if (active) return
    active = true
    rafId = requestAnimationFrame(function loop(t) {
      fn(t)
      rafId = requestAnimationFrame(loop)
    })
  }
  function pause(): void {
    active = false
    cancelAnimationFrame(rafId)
  }
  resume()
  // 3. 卸载兜底：调用方忘记 pause 也不泄漏
  onUnmounted(pause)
  return { pause, resume }
}
```

## 4. 数据对比

| 指标 | 直接写原生 API | 用 composable 封装 |
|---|---|---|
| 挂载后活跃监听器 | 1 | 1 |
| 卸载再挂载 3 次 | 3（累积） | 1（归零后重建） |
| 暂停后帧计数 | 继续增长 | 停止增长 |
| 运行帧率 / 间隔 | 60 FPS / 16.6 ms | 60 FPS / 16.6 ms |

测量方式：Chrome headless 1200×900，Demo 面板「活跃监听器 / 帧计数 / FPS」，点「暂停」后读数；卸载数据按页面说明的路由往返观察。封装本身不改变单次开销，收益在生命周期正确性。

## 5. 追问与边界

**Q：为什么不用 `onBeforeUnmount`？**
`onUnmounted` 在 DOM 移除后执行，解绑时机足够；若清理依赖 DOM 仍存在，可用 `onBeforeUnmount`。

**Q：`handler` 每次渲染都是新函数，会重复绑定吗？**
本案例在 setup 顶层绑定一次，不会。若在 `watch` 里动态绑定，必须同时 remove 旧 handler，或改用稳定的 ref 包装。

**Q：VueUse 的 `useEventListener` 还需要自己写吗？**
真实项目直接用 VueUse，它额外处理了 target 变化、被动事件、SSR；本案例只演示封装范式。

坑：`resume()` 不做幂等，快速点两次会启动两条循环，表现为帧率翻倍、计数跳跃。边界：rAF 在后台标签页会被暂停，不能用它做计时；需要精确时间用 `performance.now()` 差值。
