# 多格式文件预览

## 1. 现象与场景

用户上传文件后想先看一眼，结果只能显示文件名；图片、PDF、音频各写一套判断，类型还经常识别错。

复现：切换「文本 / 图片 / PDF / 音频」四个示例，观察同一套类型判断与 Blob URL 预览。

## 2. 原理

预览分两条路：文本直接 `file.text()` 读内容；图片/音频/视频/PDF 用 `URL.createObjectURL` 生成临时地址，交给原生 `<img>` / `<audio>` / `<video>` / `<iframe>` 渲染。

类型判断优先 `file.type`（MIME），但有些系统对 `.md`、`.log` 返回空字符串，必须用扩展名兜底。Blob URL 不会自动回收，切换文件或卸载时要 `revokeObjectURL`，否则反复预览会让内存持续上涨。

## 3. 关键代码

```ts
function kindOf(file: File): 'image' | 'text' | 'pdf' | 'audio' | 'video' | 'other' {
  const type = file.type.toLowerCase()
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('audio/')) return 'audio'
  if (type.startsWith('video/')) return 'video'
  // 1. MIME 可能为空，扩展名兜底
  if (type === 'application/pdf' || file.name.endsWith('.pdf')) return 'pdf'
  if (type.startsWith('text/') || /json|xml|csv|markdown/.test(type)) return 'text'
  return 'other'
}

const url = URL.createObjectURL(file)
// 2. PDF 可带内置查看器参数
const pdfSrc = `${url}#page=2&zoom=80`

// 3. 切换文件时释放旧 URL，避免内存泄漏
function release(old: string | null): void {
  if (old) URL.revokeObjectURL(old)
}
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 支持类型 | 文本 / 图片 / PDF / 音频 / 视频 / 其他 |
| 文本预览上限 | 6000 字符（超出截断） |
| 单个文件上限 | 10 MB |
| Blob URL 残留 | 0（切换即 revoke） |

测量方式：Chrome headless 1200×900 依次切换四个示例，读取预览区与文件信息；上限与截断长度来自 Demo 配置。真实文件格式兼容性需按目标浏览器验证。

## 5. 追问与边界

**Q：Office 文档能预览吗？**
浏览器原生不支持 doc/xlsx/pptx，需要服务端转 PDF/图片，或接第三方预览服务；不要尝试纯前端解析。

**Q：PDF 在移动端为什么只显示一页？**
iOS Safari 内嵌 PDF 支持很差，通常只渲染首页或直接下载；跨端一致要用 pdfjs-dist 画到 canvas。

**Q：大文本怎么不卡？**
先截断预览，完整内容按需下载；超大日志放到 Worker 里按行读取。

坑：`revokeObjectURL` 太早会让正在播放的音视频断掉，等切换或卸载再释放。边界：HEIC 在 Chrome 不支持；未知类型永远保留下载入口。
