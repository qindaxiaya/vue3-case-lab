# KeepAlive + LRU 页面缓存

## 1. 现象与场景

从列表进详情再返回，列表滚动位置和筛选条件全丢了；全部缓存又怕内存涨，缓存越积越多。

复现：依次打开订单、商品、用户、报表等页面，`max=2` 时最久未访问的页面被淘汰，再进入会重新初始化。

## 2. 原理

`<KeepAlive :max="2">` 内部是 LRU：缓存超过上限时淘汰「最久没有被激活」的实例，被淘汰的组件真正 `unmount`。

生命周期要分清：`mounted` 只在首次创建时跑；`activated` 每次进入都跑；`deactivated` 切走但未销毁；`unmounted` 只有被淘汰/删除缓存才触发。轮询、视频、定时器要在 `deactivated` 暂停，否则页面看不见但任务还在跑。

## 3. 关键代码

```ts
// 1. max 就是 LRU 容量
// <KeepAlive :max="2"><component :is="current" /></KeepAlive>

onMounted(() => {
  // 2. 首次创建：初始化数据、请求列表
  fetchList()
})

onActivated(() => {
  // 每次进入：恢复滚动位置、刷新需要最新的数据
  restoreScroll()
})

onDeactivated(() => {
  // 3. 切走但没销毁：暂停轮询/定时器/视频
  stopPolling()
})

onUnmounted(() => {
  // 只有被 LRU 淘汰时才触发
  cleanup()
})
```

## 4. 数据对比

| 指标 | 不缓存 | `max=2` | 全部缓存 |
|---|---|---|---|
| 返回后状态 | 丢失 | 最近 2 个保留 | 全部保留 |
| 组件实例 | 每次重建 | ≤2 | 持续增长 |
| 内存 | 低 | 可控 | 高 |
| 被淘汰页面 | — | 重新 mounted | 不淘汰 |

测量方式：Chrome headless 1200×900 依次切换 6 个页面，观察缓存列表与生命周期日志；`max` 来自 Demo 配置。内存数值随页面复杂度变化，未做定量采样。

## 5. 追问与边界

**Q：`activated` 里要不要重新请求？**
首次 `mounted` 已请求；`activated` 只刷新「需要最新」的数据，否则会重复请求。

**Q：同一组件不同参数怎么区分？**
用 `route.fullPath` 做 `key`，否则 `/user/1` 和 `/user/2` 共用同一个缓存实例，数据串台。

**Q：缓存页面里的定时器怎么办？**
`deactivated` 停、`activated` 恢复；忘记停会一直占用 CPU。

坑：`include` 匹配的是组件 `name`，不是文件名；`<script setup>` 要用 `defineOptions({ name })` 声明。边界：支付结果、订单详情等必须每次最新的页面不要缓存；KeepAlive 与 Transition 同用时 KeepAlive 要包在里面。
