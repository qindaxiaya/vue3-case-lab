// ============================================================
// 案例元数据：下拉刷新 + 触底加载
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'pull-refresh',
  title: '下拉刷新 + 触底加载',
  difficulty: 'intermediate',
  tags: ['移动端', 'Pointer 事件', '下拉刷新', '无限加载'],
  summary: 'Pointer 拖拽 + 阻尼系数 + 阈值判断；滚到底部自动加载，含刷新/加载互斥状态',
  sell: 'Pointer 拖拽 + 阻尼 + 阈值，刷新与加载不打架',
} satisfies CaseMeta
