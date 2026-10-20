# PDF 预览

## 1. 现象与场景

在线看合同 / 发票时，浏览器自带查看器在手机上可能只显示第一页，甚至直接触发下载；想换工具栏样式、加公司水印、限制下载，内置查看器完全不给入口。

复现：打开案例，默认显示第 1 页；用「‹ / ›」翻页、「− / +」缩放，再点「卸载」观察 canvas 与统计重置，最后重新生成。

## 2. 原理

PDF.js 把「解析」和「绘制」拆成两半：Worker 线程负责拆 PDF 对象、解码字体和内容流，主线程拿到 `PDFPageProxy` 后调用 `render()`，把这一页画进 `<canvas>`。所以页面里没有 iframe，也没有 Blob URL，CPU 密集的解析不会卡住界面。

渲染比例由 `getViewport({ scale })` 决定：`scale` 是相对 PDF 原始尺寸（本案例 595×842）的倍数。要清晰就把 canvas 像素尺寸乘上设备像素比，再用 CSS 把显示尺寸缩回去。翻页或缩放前必须 `cancel()` 上一个 `RenderTask`；组件卸载时则要 `destroy()` 加载任务，让 Worker 释放页面缓存。

## 3. 关键代码

```ts
// 1. Worker 必须指向打包后的真实文件
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
GlobalWorkerOptions.workerSrc = workerUrl

// 2. 直接把字节交给 pdf.js（不创建 Blob URL）
const data = new Uint8Array(await blob.arrayBuffer())
const loadingTask = getDocument({ data })
const doc = await loadingTask.promise

// 3. 按设备像素比放大 canvas，CSS 再缩回目标宽度
const pdfPage = await doc.getPage(1)
const base = pdfPage.getViewport({ scale: 1 })
const dpr = Math.min(window.devicePixelRatio || 1, 2)
const viewport = pdfPage.getViewport({ scale: (480 / base.width) * dpr })
canvas.width = Math.floor(viewport.width)
canvas.height = Math.floor(viewport.height)
canvas.style.width = '480px'
await pdfPage.render({ canvas, viewport }).promise

// 4. 同一 canvas 不能并发渲染：先取消再开始
renderTask?.cancel()
renderTask = pdfPage.render({ canvas, viewport })

// 5. 卸载时关闭加载任务，释放 Worker 缓存
loadingTask.destroy()
```

为什么 Worker 要单独配置：解析大型 PDF 是 CPU 密集操作，放在主线程会冻结滚动和按钮；pdf.js 默认就把它放进 Worker，但 worker 文件地址要由构建工具提供。

为什么缩放要乘 `devicePixelRatio`：canvas 的 `width/height` 是物理像素，CSS 宽高是显示像素；只按 CSS 尺寸画，在 2 倍屏上相当于把图放大，文字边缘会发虚。

为什么渲染前要 `cancel()`：用户连点下一页时，上一张可能还没画完；同一个 canvas 同时存在两个渲染任务会抛错或留下半张图，取消最省事。

## 4. 数据对比

| 指标 | 实测值 |
|---|---|
| 生成文件体积 | 2.1 KB |
| 生成耗时（中位） | 0.5 ms |
| 首次渲染（含 Worker 启动） | 35~69 ms，中位 45 ms |
| 翻页渲染 | 8~15 ms |
| 缩放到 150% | 6~11 ms |
| DOM 里的 iframe 数量 | 0 |

测量方式：Chrome headless 1200×900、设备像素比 1，连续执行 3 轮「重新生成 → 翻页 2 次 → 缩放 2 次」，读取组件面板里 `performance.now()` 的差值并取中位数。文件小是因为只含 Helvetica 与纯 ASCII 文本；首屏偏慢主要是启动 Worker 与解析文档结构。

## 5. 追问与边界

**Q：已经有浏览器内置查看器，为什么还要 PDF.js？**
只要「能看」，内置查看器零代码最省事；但要统一移动端表现、自定义工具栏、加水印、做批注或限制操作，就必须自己拿到页面来画。

**Q：canvas 上的文字能复制、能搜索吗？**
不能。canvas 只是一张图片；需要再渲染一层 `TextLayer`（把文字按坐标铺在 canvas 上方），搜索与复制才有内容。

**Q：几十 MB 的 PDF 直接 `arrayBuffer()` 会不会爆内存？**
会。大文件应改用 range 请求 + `PDFDataRangeTransport` 按需加载，并且只渲染当前页附近；本案例为了讲清主流程才一次性读入 2.1 KB。

**Q：中文 PDF 打开后文字缺失？**
通常是没配字体与 CMap 资源：设置 `cMapUrl`、`standardFontDataUrl` 指向 `pdfjs-dist/cmaps`、`standard_fonts` 的静态目录，否则部分中文或特殊字体会画不出来。

坑：worker 地址没配好时可能没有明显报错，页面只是空白；CSP 需要放行 `worker-src`；卸载时只隐藏 canvas 不销毁 `loadingTask`，反复打开文件内存会持续上涨。
