// ============================================================
// 案例元数据：useEventListener / useRafFn 封装范式
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'use-event-listener',
  title: 'useEventListener / useRafFn 封装范式',
  difficulty: 'intermediate',
  tags: ['组合式函数', '自动清理', 'useRafFn'],
  summary: '组合式函数把 addEventListener/rAF 的清理收进自身生命周期——调用方零清理负担',
  sell: '清理收进 composable，组件卸载零泄漏',
} satisfies CaseMeta
