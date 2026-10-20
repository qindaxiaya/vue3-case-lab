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
} satisfies CaseMeta
