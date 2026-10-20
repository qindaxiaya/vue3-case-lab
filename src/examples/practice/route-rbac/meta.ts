// ============================================================
// 案例元数据：路由级 RBAC 权限
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'route-rbac',
  title: '路由级 RBAC 权限',
  difficulty: 'advanced',
  tags: ['路由守卫', 'RBAC', '权限', '菜单'],
  summary: '角色切换菜单重算、越权导航被守卫拦截、失效页面自动重定向，日志还原完整权限闭环',
  sell: '菜单与守卫同源，越权拦截 + 自动重定向',
} satisfies CaseMeta
