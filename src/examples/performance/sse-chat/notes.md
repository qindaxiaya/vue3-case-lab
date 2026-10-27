# SSE 流式聊天 + 断线重连

## 1. 现象与场景

AI 回答要等十几秒才整段出现；网络一抖，已经生成的内容全丢，重试还从头开始。

复现：点「开始生成」，回答逐 token 出现；中途点「模拟断线」，状态变「重连中」，3 秒后从断点续传。

## 2. 原理

SSE 是「服务器持续往响应里写文本」的长连接协议，事件以空行分隔，`id:` 标记序号、`data:` 携带内容。浏览器不会等你 `await` 完整响应，`res.body.getReader()` 可以边收边解析。

断线续传靠客户端记住最后一个 `id`，重连时通过 `Last-Event-ID` 告诉服务端「从这里继续」，服务端跳过已发送的 token。`TextDecoder` 必须用 `{ stream: true }`，否则一个中文字被拆在两个 chunk 时会乱码。

## 3. 关键代码

```ts
const reader = res.body!.getReader()
const decoder = new TextDecoder()
let buffer = ''
let lastEventId = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // 1. stream: true 防止多字节中文被截断
  buffer += decoder.decode(value, { stream: true })

  // 2. 用空行切事件，最后不完整的一段留在 buffer
  const chunks = buffer.split('\n\n')
  buffer = chunks.pop() ?? ''

  for (const chunk of chunks) {
    for (const line of chunk.split('\n')) {
      // 3. 记住 id 作为断点，重连时带给服务端
      if (line.startsWith('id:')) lastEventId = line.slice(3).trim()
      else if (line.startsWith('data:')) appendToken(line.slice(5).trimStart())
    }
  }
}
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 总 token 数 | 36 |
| 首段出现时间 | 150~390ms（Demo 每段随机延迟） |
| 断线重连等待 | 3000ms（Demo 配置） |
| 重复片段 | 0（按 `lastEventId` 续传） |

测量方式：Chrome headless 1200×900 点「开始生成」，观察首段出现时间与总段数；首段由 Demo 的 150~390ms 随机延迟控制，断线重连等待 3000ms。真实网络延迟取决于服务端与代理。

## 5. 追问与边界

**Q：用 `EventSource` 不就行了？**
`EventSource` 自带重连与 `Last-Event-ID`，但只能 GET，不能带 POST body、自定义请求头，也不能单独中断某次请求；需要 POST/鉴权时用 `fetch + ReadableStream`。

**Q：为什么要指数退避？**
服务端刚崩溃时立刻重连会打满它；1s、2s、4s 给恢复时间，并设最大重试次数。

**Q：代理里为什么收不到流？**
Nginx 默认缓冲响应，需 `X-Accel-Buffering: no` 或关闭 `proxy_buffering`；还要定期发心跳注释行防中间层超时断开。

坑：一次会话结束不重置 `lastEventId`，下一次请求会带旧断点导致跳内容。边界：断点续传需要服务端配合，前端只能「请求」续传，不能强制。
