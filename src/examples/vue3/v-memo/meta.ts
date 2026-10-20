// ============================================================
// 案例元数据：v-memo 渲染缓存
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'v-memo',
  title: 'v-memo 渲染缓存',
  difficulty: 'advanced',
  tags: ['v-memo', '渲染优化', 'patch flag'],
  summary: '依赖数组没变就跳过整棵子树 patch，无关更新零渲染，每行渲染计数实证',
  sell: '依赖没变就跳过 patch，渲染次数实测',
} satisfies CaseMeta
