// ============================================================
// 案例元数据：requestIdleCallback 空闲调度
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'idle-schedule',
  title: 'requestIdleCallback 空闲调度',
  difficulty: 'intermediate',
  tags: ['requestIdleCallback', '空闲调度', '分片'],
  summary: '同步阻塞 vs 空闲分片对比：timeRemaining 预算内干活，timeout 兜底防饿死',
  sell: '重活拆进空闲帧，预算内干活、超时兜底',
} satisfies CaseMeta
