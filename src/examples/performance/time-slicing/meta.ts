// ============================================================
// 案例元数据：长列表时间切片
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'time-slicing',
  title: '长列表时间切片',
  difficulty: 'advanced',
  tags: ['时间切片', 'rAF', '长任务', '首屏'],
  summary: '1 万条数据每帧渲染 300 条，对比一次性全量：首帧、总耗时、主线程点击响应延迟',
} satisfies CaseMeta
