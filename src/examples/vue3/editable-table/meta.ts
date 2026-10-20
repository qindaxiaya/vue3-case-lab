// ============================================================
// 案例元数据：可编辑表格 + 行内校验
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'editable-table',
  title: '可编辑表格 + 行内校验',
  difficulty: 'intermediate',
  tags: ['表格', '表单校验', '双击编辑', '状态机'],
  summary: '双击进入编辑、失焦/Enter 保存、Esc 取消，名称/价格/库存三类校验并统计拦截次数',
  sell: '双击编辑 + 三类校验，表格编辑不再难写',
} satisfies CaseMeta
