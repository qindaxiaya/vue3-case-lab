// ============================================================
// 案例元数据：无限滚动加载
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'infinite-scroll',
  title: '无限滚动加载',
  difficulty: 'intermediate',
  tags: ['IntersectionObserver', '分页', '哨兵元素'],
  summary: '哨兵进底部 200px 预取下一页，rootMargin 单向扩展，loading 防重入',
} satisfies CaseMeta
