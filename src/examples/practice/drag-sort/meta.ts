// ============================================================
// 案例元数据：指针拖拽排序
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'drag-sort',
  title: '指针拖拽排序',
  difficulty: 'advanced',
  tags: ['Pointer 事件', 'FLIP', 'WAAPI', '排序'],
  summary: 'Pointer 拖拽 + 目标位高亮 + 松手 splice 移动；用 FLIP 让其余行从旧位置平滑滑入',
  sell: 'Pointer 拖拽 + FLIP，换位动画不生硬',
} satisfies CaseMeta
