# 埋点 SDK（点击 + 曝光）

## 1. 现象与场景

给每个按钮单独绑埋点，漏一个就少一个数据；曝光统计用 scroll 手算，元素反复进出视口重复上报，数据虚高。

复现：点击「加入购物车」，事件进入队列；滚动让卡片露出 60%，曝光只上报一次。

## 2. 原理

点击埋点用事件委托：在 `document` 捕获阶段监听，`closest('[data-track]')` 向上找目标。捕获阶段可以避免业务代码 `stopPropagation` 把埋点拦掉。一个监听器管全站，新增按钮只需加 `data-track`。

曝光用 IntersectionObserver + `WeakSet` 去重：元素第一次进入视口上报，之后反复进出不再报；上报后 `unobserve`。事件先入队，批量发送降低请求数。

## 3. 关键代码

```ts
document.addEventListener('click', (e) => {
  // 1. 事件委托 + 捕获阶段，业务 stopPropagation 也拦不住
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-track]')
  if (!el) return
  track('click', { name: el.dataset.track, ...parseExtra(el.dataset.extra) })
}, true)

const exposed = new WeakSet<Element>()
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    const el = entry.target as HTMLElement
    // 2. 同一元素只算一次曝光
    if (exposed.has(el)) continue
    exposed.add(el)
    track('exposure', { name: el.dataset.track })
    io.unobserve(el)
  }
}, { threshold: 0.6 })

// 3. 批量上报：满 5 条或每 2 秒 flush 一次
function track(type: string, data: Record<string, unknown>): void {
  queue.push({ type, ...data, ts: Date.now() })
  if (queue.length >= 5) flush()
}
setInterval(() => queue.length && flush(), 2000)
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 点击监听器数量 | 1（全站委托） |
| 曝光阈值 | 60% |
| 重复曝光 | 0（WeakSet 去重） |
| 批量阈值 | 5 条 / 2 秒 |
| 卸载/关页上报 | sendBeacon |

测量方式：Chrome headless 1200×900 点击按钮、滚动卡片，读取事件日志与队列条数；阈值与批量参数来自 Demo 配置。

## 5. 追问与边界

**Q：为什么用 `sendBeacon`？**
页面关闭/跳转时普通 XHR 可能被中断；`sendBeacon` 由浏览器接管，不阻塞导航，适合收尾上报。

**Q：曝光阈值设多少？**
0 会让「露出 1px」就算曝光，数据虚高；50%~60% 更接近「用户真正看到」。

**Q：埋点报错会影响业务吗？**
会。`track` 内部必须 try/catch 吞掉异常，采集永远不能阻塞主流程。

坑：SPA 路由切换不会自动触发 PV，需要手动补。边界：断网时队列要设上限并落本地缓存；不要上报手机号、token 等敏感信息。
