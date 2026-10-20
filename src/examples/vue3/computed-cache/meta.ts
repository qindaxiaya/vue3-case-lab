// ============================================================
// 案例元数据：computed 缓存 vs 方法 vs watch
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'computed-cache',
  title: 'computed 缓存 vs 方法 vs watch',
  difficulty: 'intermediate',
  tags: ['computed', 'watch', '缓存', '渲染'],
  summary: '改无关状态时，computed 不重算、方法每次渲染都跑、watch 不触发——用计数看清三者边界',
  sell: '计数看清 computed / 方法 / watch 的边界',
} satisfies CaseMeta
