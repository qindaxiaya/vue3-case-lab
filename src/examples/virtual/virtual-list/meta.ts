// ============================================================
// 案例元数据：定高虚拟列表
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'virtual-list',
  title: '定高虚拟列表',
  difficulty: 'intermediate',
  tags: ['虚拟列表', '长列表', 'rAF 节流'],
  summary: '10 万行只渲染视口 ±5 行，transform 定位 + rAF 节流滚动，DOM 恒定约 30 个',
} satisfies CaseMeta
