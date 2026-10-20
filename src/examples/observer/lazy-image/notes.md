# IntersectionObserver 图片懒加载

## 1. 现象与场景

长列表里 30 张图一起请求，首屏加载慢、流量浪费；滚动到下面时图片还没加载，出现大片空白。

复现：打开案例，未滚动时观察「已加载 6 / 30」；其余 24 张处于「待进入视口加载」状态。

## 2. 原理

真实 `<img>` 一设置 `src` 浏览器就发起请求，和它是否可见无关。懒加载先用占位图（或空 `src`），把真实地址放在 `data-src`，等元素进入视口再搬运。

`IntersectionObserver` 用 `rootMargin: '100px'` 提前 100px 触发，避免用户看到空白；加载后立即 `unobserve`，防止来回滚动重复触发。相交计算在合成线程完成，比 scroll + `getBoundingClientRect` 便宜。

## 3. 关键代码

```ts
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      // 1. isIntersecting 才是「进入」，ratio 是相交比例
      if (!entry.isIntersecting) continue
      const img = entry.target as HTMLImageElement
      const real = img.dataset.src
      // 2. 进入视口才把 data-src 搬到 src，浏览器此刻才发请求
      if (real) img.src = real
      // 3. 加载过立即停止观察，避免反复触发
      observer.unobserve(entry.target)
    }
  },
  // rootMargin 100px = 视口外 100px 的预加载带
  { rootMargin: '100px', threshold: 0 },
)

document.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((img) => observer.observe(img))
onUnmounted(() => observer.disconnect())
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 首屏视口内加载 | 6 / 30 张 |
| 未请求 | 24 张（保持占位） |
| 预加载距离 | 视口外 100px |
| 重复加载 | 0（unobserve） |

测量方式：Chrome headless 1200×900 打开案例，读取面板「已加载 6 / 30」与事件流「第 1~6 张加载完成」；其余 24 张显示「待进入视口加载」。不同视口高度下首屏数量会变，比例结论不变。

## 5. 追问与边界

**Q：为什么不直接用 `<img loading="lazy">`？**
现代浏览器已原生支持，简单场景优先用它；需要自定义预加载距离、曝光统计、占位动画时仍需 IntersectionObserver。

**Q：`threshold` 和 `rootMargin` 怎么选？**
`threshold: 0` + 正 `rootMargin` 适合提前加载；曝光统计常用 `threshold: 0.5`，表示露出一半才算曝光。

**Q：图片加载失败怎么处理？**
监听 `error` 换占位图并提供重试；不要反复设置同一个 `src`，浏览器可能命中缓存失败结果。

坑：只写 `observer.observe` 不 `disconnect`，组件卸载后观察器仍持有 DOM 引用。边界：首屏关键图（LCP 图）不要懒加载，否则会拖慢最大内容绘制。
