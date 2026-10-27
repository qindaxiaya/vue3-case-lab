# 图片压缩前后对比

## 1. 现象与场景

用户直接上传手机原图，一张 8MB，上传慢、存储贵、列表加载卡；想在前端压一下，又不知道怎么控制质量。

复现：选择图片，案例按长边 1200px、JPEG 质量 0.6 压缩；拖动分割线对比原图与压缩图，面板显示体积变化。

## 2. 原理

压缩三步：`File` → `ObjectURL` → `Image` 解码，得到原始宽高；按长边上限等比缩放，画到 canvas；`canvas.toBlob(type, quality)` 用浏览器原生编码器输出 JPEG。

缩放时必须开 `imageSmoothingQuality = 'high'`，否则缩小后的图会有锯齿。JPEG 质量 0.6 + 长边 1200 是通用甜点；头像可更小（400px、0.7）。PNG 透明图转 JPEG 会变黑底，需要先铺白底。

## 3. 关键代码

```ts
async function compressImage(file: File, quality = 0.6, maxEdge = 1200): Promise<Blob | null> {
  const url = URL.createObjectURL(file)
  const img = await loadImage(url)

  // 1. 等比缩放：长边压到上限，短边按比例
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)

  const ctx = canvas.getContext('2d')!
  // 2. 缩小图片必须开高质量插值，否则细节发糊
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  // 3. toBlob 是原生编码器；quality 只对 JPEG/WebP 生效
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  URL.revokeObjectURL(url)
  return blob
}
```

## 4. 数据对比

| 指标 | 原图 | 压缩后 |
|---|---|---|
| 体积 | 1.69 MB | 60.0 KB |
| 长边 | 原尺寸（示例 8MB 上限） | 1200 px |
| 压缩率 | — | 96%（面板取整；1 − 60/1690 = 96.45%） |
| 输出格式 | 原格式 | JPEG（质量 0.6） |

测量方式：Chrome headless 1200×900 选择示例图，读取面板「1.69 MB → 60.0 KB、1200px」；压缩率 = 1 - 60/1690。不同图片内容与尺寸结果差异很大，应以实际素材为准。

## 5. 追问与边界

**Q：为什么压完反而模糊？**
长边压得太小或质量太低；人像可 800~1200px、0.7，文字截图建议 PNG 或更高质量。

**Q：PNG 透明背景变黑怎么办？**
绘制前 `ctx.fillStyle = '#fff'; ctx.fillRect(...)` 铺白底，或输出 WebP 保留透明。

**Q：批量压缩卡页面？**
canvas 编码在主线程，几十张大图会阻塞；放 Web Worker（OffscreenCanvas）或串行 + 进度提示。

坑：`toBlob` 是异步回调，忘记 `await` 会拿到 null。边界：需要 AVIF/多档自适应/EXIF 旋转时用 `browser-image-compression` 等库，别手写全套。
