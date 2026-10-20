// ============================================================
// 案例元数据：SSE 流式聊天
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'sse-chat',
  title: 'SSE 流式聊天 + 断线重连',
  difficulty: 'advanced',
  tags: ['SSE', '流式', '断线重连', 'AbortController'],
  summary: '本地模拟 token 流：断线 → 重连中 → 用 Last-Event-ID 从断点续传，支持主动中止',
  sell: 'SSE 断线重连 + Last-Event-ID 续传',
  explain: {
    situation:
      '你接了一个 AI 聊天接口，希望回答像打字一样一点点出现。结果网络一抖，前面生成的一半没了；重连之后，有时候整段又重复一遍。',
    background:
      '流式响应通常用 SSE：服务端把回答切成小段推过来，每段带一个编号。连接断了，客户端把最后收到的编号（Last-Event-ID）发回去，服务端就知道从下一条接着发，才能做到不重不漏。',
    action:
      '案例用本地模拟的 token 流演示整个状态机：生成中 →（模拟断线）重连中 → 3 秒后从断点续传 → 完成，还可以点「停止」主动中止。代码区给了 fetch + ReadableStream 的真实写法。',
    conclusion:
      '记住：流式 = 边收边渲染 + 断点续传。EventSource 简单但只能 GET；需要 POST 或自定义请求头时，就用 fetch 读流。做 AI 聊天，这两个能力缺一不可。',
  },
} satisfies CaseMeta
