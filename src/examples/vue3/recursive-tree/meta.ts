// ============================================================
// 案例元数据：递归组件 + 作用域插槽
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'recursive-tree',
  title: '递归组件 + 作用域插槽',
  difficulty: 'advanced',
  tags: ['递归组件', '作用域插槽', 'slot', '树形'],
  summary: 'TreeNode 自引用渲染任意层级，父级用作用域插槽接管节点样式，key 重建控制展开状态',
} satisfies CaseMeta
