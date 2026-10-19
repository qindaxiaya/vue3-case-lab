// ============================================================
// 案例元数据：异步组件加载与重试
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'async-suspense',
  title: '异步组件加载与重试',
  difficulty: 'intermediate',
  tags: ['defineAsyncComponent', '代码分割', 'Suspense'],
  summary: 'loader/delay/timeout/loading/error 配置全家桶，失败换 key 重试的标准姿势',
} satisfies CaseMeta
