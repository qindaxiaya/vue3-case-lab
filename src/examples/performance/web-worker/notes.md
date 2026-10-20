# Web Worker 主线程解冻

## 1. 现象与场景

点击「计算」后页面冻结，按钮点不动、动画停住，用户以为死机；计算本身只要几十毫秒，但主线程被完全占住。

复现：点「在主线程计算」，心跳帧计数停在原值；点「丢给 Worker 计算」，同一条心跳持续增长。

## 2. 原理

浏览器主线程同时负责 JS、样式、布局和绘制。同步重计算会占满主线程，期间事件、rAF、渲染全部排队。Web Worker 是独立线程，把纯计算搬过去，主线程只负责收结果。

通信是「结构化克隆」，不是共享内存：传大对象有拷贝成本，传 `ArrayBuffer` 时可用 Transferable 零拷贝转移所有权。Worker 里没有 `window`/`document`，不能操作 DOM。

## 3. 关键代码

```ts
// 1. Blob Worker：零额外文件，适合小逻辑演示
const source = `self.onmessage = (e) => {
  const r = heavy(e.data)
  self.postMessage(r)
}`
const worker = new Worker(URL.createObjectURL(new Blob([source], { type: 'application/javascript' })))

// 2. 双向通信：结果是异步回传的
worker.postMessage({ units: 40_000_000 })
worker.onmessage = (e) => result.value = e.data

// 3. 卸载必须 terminate，否则线程与 Blob URL 都泄漏
onUnmounted(() => {
  worker.terminate()
  URL.revokeObjectURL(url)
})
```

## 4. 数据对比

| 指标 | 主线程计算 | Worker 计算 |
|---|---|---|
| 计算量 | 4000 万次 | 4000 万次 |
| 耗时 | 92 ms | 91 ms |
| 阻塞期间新增帧 | 0 | 持续增长（29 → 134） |
| 页面交互 | 冻结 | 正常 |

测量方式：Chrome headless 1200×900，先记录心跳帧计数，点按钮后读取耗时与帧计数。两条路径耗时接近，差异只在「谁被占用」；具体毫秒随设备波动。

## 5. 追问与边界

**Q：什么任务适合放 Worker？**
单次 >50ms 的纯计算：大数组排序、加解密、图像像素处理、大 JSON 解析。短任务通道开销可能大于计算本身。

**Q：能直接传 Vue 的响应式对象吗？**
不能。Proxy 不可克隆，会抛 `DataCloneError`；传普通对象/数组/ArrayBuffer，回传后再赋值给 ref。

**Q：Worker 能共享状态吗？**
可以用 `SharedArrayBuffer`，但需要跨源隔离响应头（COOP/COEP），部署成本高；多数场景用消息通信即可。

坑：Worker 文件路径受同源限制，Vite 里用 `new URL('./x.worker.ts', import.meta.url)` 让构建器处理。边界：需要频繁双向同步的场景不适合 Worker，消息往返延迟会抵消收益。
