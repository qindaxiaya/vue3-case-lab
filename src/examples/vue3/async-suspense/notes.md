# 异步组件加载与重试

## 1. 现象与场景

路由级组件用动态 import，网络慢时白屏；加载失败后只能刷新整页；骨架屏闪一下就消失，比不显示还难受。

复现：点「重试（重建组件）」，模拟 1200ms 加载；勾选「模拟加载失败」后重试，进入错误态。

## 2. 原理

`defineAsyncComponent` 的 loader 返回 Promise，加载期间可显示 loading 组件，失败显示 error 组件。`delay` 控制「加载很快时不显示 loading」，避免骨架屏闪烁；`timeout` 防止网络挂起永远转圈。

`defineAsyncComponent` 没有 `retry()` API，标准做法是换 `:key` 强制销毁重建，新实例重新走一遍 loader。`<Suspense>` 可以等内部所有异步依赖就绪后一次性渲染，但 Vue 3 中仍是 experimental，生产慎用。

## 3. 关键代码

```ts
const AsyncChart = defineAsyncComponent({
  // 1. loader 动态 import，构建时自动切 chunk
  loader: () => import('./HeavyChart.vue'),
  loadingComponent: ChartSkeleton,
  errorComponent: ChartError,
  // 2. 200ms 内加载完就不闪骨架屏
  delay: 200,
  // 3. 超过 8s 按失败处理，避免永远转圈
  timeout: 8000,
})

const attempt = ref(0)
function retry(): void {
  // 重试 = 换 key 重建，新实例重新走 loader
  attempt.value++
}
// <AsyncChart :key="attempt" @error="onErr" />
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 模拟加载延迟 | 1200 ms |
| 骨架屏延迟阈值 | 200 ms |
| 超时阈值 | 8000 ms |
| 重试方式 | key +1，销毁重建 |
| 已加载状态 | 第 1 次加载完成 |

测量方式：Chrome headless 1200×900 打开案例，读取「加载延迟 1200ms / 第 1 次加载」；点重试观察 key 变化与重新加载。真实 chunk 体积与网络决定耗时。

## 5. 追问与边界

**Q：为什么重试不直接再调用 loader？**
组件实例已经处于 error 状态，换 key 让 Vue 销毁旧实例、创建新实例，是最稳妥的重建方式。

**Q：`delay` 设多少？**
150~300ms。太短会让快请求也闪骨架屏，太长则慢请求白屏时间过久。

**Q：Suspense 能用于生产吗？**
Vue 3 中仍标 experimental，API 可能变动；需要稳定方案时用 loading/error 组件或路由级 loading。

坑：`timeout` 不设，接口挂起时错误组件永远不出现。边界：异步组件内的 `async setup` 需要 Suspense 包裹；重试要防止用户连点造成多次请求。
