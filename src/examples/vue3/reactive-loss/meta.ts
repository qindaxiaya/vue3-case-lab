// ============================================================
// 案例元数据：响应式丢失的 5 个现场
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'reactive-loss',
  title: '响应式丢失的 5 个现场',
  difficulty: 'advanced',
  tags: ['reactive', 'toRef', 'toRefs', '解构', 'props', '响应式'],
  summary: '解构/整体赋值/浅拷贝/解构 props 四类丢失逐一复现，并验证 Vue 3 已修复的数组下标老坑',
} satisfies CaseMeta
