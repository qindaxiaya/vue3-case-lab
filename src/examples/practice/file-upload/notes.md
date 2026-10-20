# 文件上传（校验 + 队列）

## 1. 现象与场景

一次选 20 个文件全部同时上传，浏览器连接被占满，页面卡；传完才提示「超过 2MB」，用户白等。

复现：选择多个文件，前端立即校验类型/大小；上传队列最多同时跑 2 个，失败项单独重试。

## 2. 原理

上传前先校验：类型、大小、数量。前端校验只是体验优化，服务端必须再校验一次，因为请求可以被绕过。

进度条只能用 XHR：`fetch` 没有上传进度事件，只有下载流。`xhr.upload.onprogress` 提供 `loaded/total`。并发队列用「运行数 + 等待队列」，一个任务结束就补位，保持并发稳定，避免几十个请求同时打满浏览器同域连接数。

## 3. 关键代码

```ts
function validate(file: File): string | null {
  const allowed = file.type.startsWith('image/') || file.type === 'application/pdf'
  // 1. 前端先拦，服务端仍要复核
  if (!allowed) return `${file.name}：只支持图片或 PDF`
  if (file.size > 2 * 1024 * 1024) return `${file.name}：超过 2MB`
  return null
}

function upload(file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('file', file)
    // 2. fetch 没有上传进度，进度条必须用 XHR
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => (xhr.status < 300 ? resolve(xhr.responseText) : reject(new Error(`HTTP ${xhr.status}`)))
    xhr.onerror = () => reject(new Error('网络错误'))
    xhr.open('POST', '/api/upload')
    xhr.send(form)
  })
}

// 3. 结束一个就补位，保持并发数稳定
function next(): void {
  while (running < 2 && queue.length) {
    const file = queue.shift()!
    running++
    upload(file, (pct) => updateProgress(file, pct))
      .catch((err) => markFailed(file, err.message))
      .finally(() => { running--; next() })
  }
}
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 单文件上限 | 2 MB |
| 允许类型 | 图片 / PDF |
| 并发数 | 2 |
| 进度粒度 | 1%（loaded/total） |
| 失败重试 | 仅失败项 |

测量方式：Chrome headless 1200×900 选择不同类型/大小的文件，读取校验提示与队列状态；上限与并发来自 Demo 配置。真实上传速度取决于网络与服务端。

## 5. 追问与边界

**Q：为什么不用 `fetch` 上传？**
`fetch` 没有上传进度事件；需要进度条时用 XHR。若不需要进度，`fetch` + `FormData` 更简洁。

**Q：进度到 100% 就完成了吗？**
不是。100% 只表示字节发完，还要等服务端响应；处理中要有独立状态。

**Q：大文件怎么办？**
用分片上传（见 chunk-upload 案例），支持断点续传与秒传；不要整文件读进内存。

坑：双击选同一个文件不触发 `change`，处理完要 `input.value = ''`。边界：页面关闭时未完成请求会丢，关键上传可用 `sendBeacon`/`keepalive` 或提示用户；文件名不能直接拼服务端路径。
