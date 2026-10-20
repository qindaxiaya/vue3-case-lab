// ============================================================
// 案例元数据：埋点 SDK
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'tracking-sdk',
  title: '埋点 SDK（点击 + 曝光）',
  difficulty: 'advanced',
  tags: ['埋点', '事件委托', 'IntersectionObserver', 'sendBeacon'],
  summary: 'data-track 事件委托收点击、IO 收曝光（去重）、批量队列满 5 或 2s 上报，批次日志可见',
  sell: '点击与曝光自动采集，批量上报不丢事件',
} satisfies CaseMeta
