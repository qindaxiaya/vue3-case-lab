# 状态管理：Pinia 范式 + 持久化

## 1. 现象与场景

购物车数据两个组件各存一份，加购后角标不更新；刷新页面状态全丢；用 `provide/inject` 越传越乱，最后变成「谁都能改」。

复现：两个组件同时读写同一个 store，点「+1」两处同步；改语言/主题后刷新，持久化字段仍在。

## 2. 原理

Pinia 的 setup store 就是「用组合式 API 写一个共享模块」：`ref` 是 state，`computed` 是 getter，函数是 action，最后 `return` 暴露。组件里调用 `useStore()` 拿到同一个实例，天然跨组件同步。

解构会丢响应式，必须用 `storeToRefs` 取 state/getter，action 直接解构。持久化用 `pinia-plugin-persistedstate`，内部 deep watch + localStorage，不需要手写序列化。跨 store 在 action 里直接调用另一个 `useStore()`。

## 3. 关键代码

```ts
export const useDemoStore = defineStore('demo', () => {
  // 1. state / getter / action 都用组合式写法
  const count = ref(0)
  const double = computed(() => count.value * 2)
  function increment(): void { count.value++ }
  // setup store 必须 return 所有要暴露的内容
  return { count, double, increment }
})

export const usePersistedDemoStore = defineStore('demo-persist', () => {
  const count = ref(0)
  return { count }
}, {
  // 2. 插件自动 deep watch + localStorage 读写
  persist: { key: 'moyu-demo-store' },
})

// 3. 解构 state 必须 storeToRefs，action 可直接解构
const { count } = storeToRefs(store)
const { increment } = store
```

## 4. 数据对比

| 指标 | 组件各自 ref | Pinia store |
|---|---|---|
| 两处同步 | 需手动 emit/props | 自动 |
| 刷新后 | 丢失 | 持久化字段保留 |
| 解构响应式 | — | `storeToRefs` 保留 |
| store 实例 | — | 单例（同名只创建一次） |

测量方式：Chrome headless 1200×900 打开案例，两个组件各点一次「+1」，观察计数同步；改名后刷新页面，读取 localStorage 与恢复值。持久化键为 `moyu-demo-store`。

## 5. 追问与边界

**Q：什么时候不该用 Pinia？**
单组件内部状态用 `ref`；只往下传两层用 props/emit；一个子树共享用 provide/inject；服务端数据缓存用 vue-query，不要塞 store。

**Q：为什么不能直接解构 store？**
解构出来的是普通值，和 store 断开响应式；`storeToRefs` 返回 ref，保留连接。

**Q：持久化所有字段好吗？**
不好。敏感信息、临时 UI 状态不要持久化；只选必要字段（`paths`），并处理版本迁移。

坑：两个 `defineStore` 用同一个 id 会复用同一个 store，出现「数据串台」；本案例用 `demo` 与 `demo-persist` 两个 id 并列展示。边界：站点自身禁用 Pinia，本案例用 reactive 等效实现，代码区展示真实 Pinia 写法。
