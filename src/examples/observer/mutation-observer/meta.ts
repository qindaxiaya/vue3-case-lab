// ============================================================
// 案例元数据：MutationObserver DOM 变更监听
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'mutation-observer',
  title: 'MutationObserver DOM 变更监听',
  difficulty: 'intermediate',
  tags: ['MutationObserver', 'childList', 'takeRecords'],
  summary: 'childList/attributes/characterData 三开关组合观察，takeRecords 冲刷防变更洪泛',
  sell: '三开关监听 DOM 变更，takeRecords 防洪泛',
} satisfies CaseMeta
