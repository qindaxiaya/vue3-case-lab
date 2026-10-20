# PDF 预览

## 1. 现象与场景

后端给了一个 PDF 地址，想直接在页面里看；用 iframe 有时白屏，移动端只显示第一页，中文还乱码。

复现：点「重新生成 PDF」，案例手写一个 2.1KB 的三页 PDF Blob，分别用 iframe / object / embed 预览。

## 2. 原理

PDF 是结构化文件：文件头、若干对象、`xref` 交叉引用表、`trailer`、`startxref`。`xref` 记录每个对象的字节偏移，偏移错一位浏览器就报「文件已损坏」。

预览最简单的方式是 `URL.createObjectURL(blob)` + iframe/object，交给浏览器内置查看器；它支持 `#page=2&zoom=80` 等参数。要自定义翻页、搜索、水印时，用 pdfjs-dist 渲染到 canvas。生成 PDF 用 pdf-lib 更稳，手写只适合理解结构。

## 3. 关键代码

```ts
// 1. 生成 Blob 后创建临时 URL
const blob = new Blob([pdfText], { type: 'application/pdf' })
const url = URL.createObjectURL(blob)

// 2. iframe 最简单，浏览器内置查看器负责渲染
// <iframe :src="url" style="width:100%;height:600px;border:0" />

// 3. object 语义更正确，可带 fallback
// <object :data="url" type="application/pdf">
//   <a :href="url">下载 PDF</a>
// </object>

// 卸载/重新生成时释放，避免内存泄漏
onUnmounted(() => URL.revokeObjectURL(url))
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 生成文件体积 | 2.1 KB |
| 生成耗时 | 0.3~0.5 ms |
| 页数 | 3 |
| 预览方式 | iframe / object / embed |
| 内置查看器参数 | `#page=2&zoom=80` |

测量方式：Chrome headless 1200×900 点「重新生成 PDF」，读取面板体积与耗时；两种渲染方式的耗时按 `performance.now()` 差值记录。体积小是因为只含 Helvetica 与纯 ASCII 文本。

## 5. 追问与边界

**Q：为什么中文显示不出来？**
PDF 内置 Helvetica 没有中文字形；需要嵌入中文字体子集（pdf-lib + fontkit），文件会明显变大。

**Q：iframe 和 object 选哪个？**
只是「能看」用 iframe，代码最少；需要 fallback 内容用 object。移动端两者都可能只显示一页。

**Q：怎么禁止下载/加水印？**
前端预览无法真正禁止下载；需要服务端转图片、加水印或使用专业文档服务。

坑：`revokeObjectURL` 太早会让正在加载的查看器白屏；等卸载或切换时再释放。边界：跨域 PDF 可能被 `X-Frame-Options` 拦截，CSP 要放行 `blob:` 与 `frame-src`。
