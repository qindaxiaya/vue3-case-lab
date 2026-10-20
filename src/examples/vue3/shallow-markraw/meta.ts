// ============================================================
// 案例元数据：shallowRef / markRaw 性能边界
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'shallow-markraw',
  title: 'shallowRef / markRaw 性能边界',
  difficulty: 'advanced',
  tags: ['shallowRef', 'markRaw', 'triggerRef'],
  summary: '深代理 vs 浅代理 vs 永不代理三档对比，triggerRef 手动触发，大数据状态首选浅层',
  sell: '三档代理开销实测，大数据状态选对 API',
} satisfies CaseMeta
