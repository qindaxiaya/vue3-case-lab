// ============================================================
// 案例元数据：History 拦截返回
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'history-guard',
  title: 'History 拦截返回',
  difficulty: 'advanced',
  tags: ['history', 'popstate', '路由守卫', 'beforeunload'],
  summary: '有未保存内容时拦截返回：确认/取消状态机 + 日志，附 onBeforeRouteLeave 与 popstate 真实方案',
} satisfies CaseMeta
