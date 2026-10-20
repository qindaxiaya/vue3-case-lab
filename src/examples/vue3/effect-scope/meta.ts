// ============================================================
// 案例元数据：effectScope 批量停止副作用
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'effect-scope',
  title: 'effectScope 批量停止副作用',
  difficulty: 'advanced',
  tags: ['effectScope', 'onScopeDispose', '内存泄漏', 'watch'],
  summary: '反复挂载卸载时，用 effectScope 一次性收口 watcher 与定时器，把「看不见的泄漏」变成数字',
} satisfies CaseMeta
