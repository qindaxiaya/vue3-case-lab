// ============================================================
// 案例元数据：Toast 通知队列
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'toast-queue',
  title: 'Toast 通知队列',
  difficulty: 'intermediate',
  tags: ['队列', 'animationend', '通知组件'],
  summary: '屏上限 3 条超出排队补位，CSS animationend 驱动消失，hover 真暂停倒计时',
  sell: '最多 3 条排队补位，animationend 精确回收',
} satisfies CaseMeta
