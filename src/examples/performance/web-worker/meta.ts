// ============================================================
// 案例元数据：Web Worker 主线程解冻
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'web-worker',
  title: 'Web Worker 主线程解冻',
  difficulty: 'intermediate',
  tags: ['Worker', 'Blob URL', '多线程'],
  summary: '同一份重计算两条路径：主线程跑页面冻死，Worker 跑界面照常——心跳实测对比',
  sell: '重计算搬进 Worker，主线程心跳不再停',
} satisfies CaseMeta
