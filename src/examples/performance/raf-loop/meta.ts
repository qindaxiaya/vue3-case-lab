// ============================================================
// 案例元数据：requestAnimationFrame 渲染循环
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'raf-loop',
  title: 'requestAnimationFrame 渲染循环',
  difficulty: 'intermediate',
  tags: ['requestAnimationFrame', '动画', '渲染循环'],
  summary: '时间戳驱动的匀速动画循环：FPS/帧间隔实时统计，成对取消防泄漏',
} satisfies CaseMeta
