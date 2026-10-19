// ============================================================
// 案例元数据：响应式依赖注入
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'reactive-inject',
  title: '响应式依赖注入',
  difficulty: 'intermediate',
  tags: ['provide', 'inject', 'readonly', 'Symbol'],
  summary: '三层跨层传 ref 全局同步，Symbol key 防污染，computed/readonly 双只读边界',
} satisfies CaseMeta
