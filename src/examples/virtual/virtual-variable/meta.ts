// ============================================================
// 案例元数据：虚拟列表（不定行高）
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'virtual-variable',
  title: '虚拟列表（不定行高）',
  difficulty: 'advanced',
  tags: ['虚拟列表', '二分查找', '前缀和', '长列表'],
  summary: '2000 条不定高消息：offsets 前缀和 + 二分定位，只渲染视口内 10 行，全量模式对照',
} satisfies CaseMeta
