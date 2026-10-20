// ============================================================
// 案例元数据：流式打字机
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'typewriter-stream',
  title: '流式打字机',
  difficulty: 'intermediate',
  tags: ['流式输出', 'rAF', '缓冲区', 'SSE'],
  summary: '接收缓冲 + rAF 匀速消费：对比直接拼接的跳变，观察积压队列与单帧最大跳变',
  sell: '接收与消费解耦，rAF 匀速出字不跳变',
} satisfies CaseMeta
