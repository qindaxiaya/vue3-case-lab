// ============================================================
// 案例元数据：状态管理（Pinia 范式 + 持久化）
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'pinia-store',
  title: '状态管理：Pinia 范式 + 持久化',
  difficulty: 'intermediate',
  tags: ['Pinia', 'store', '持久化', 'localStorage'],
  summary: '20 行等价实现讲透 setup store：跨组件共享 + deep watch 持久化，附真实 Pinia 写法对照',
} satisfies CaseMeta
