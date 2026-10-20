// ============================================================
// 案例元数据：requestAnimationFrame 渲染循环
// 两个演示：正弦缓动往返动画 + 高频渲染合并（节流）
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'raf-loop',
  title: 'requestAnimationFrame 渲染循环',
  difficulty: 'intermediate',
  tags: ['requestAnimationFrame', '动画', '节流', '渲染循环'],
  summary: '时间戳驱动正弦往返动画 + mousemove 高频事件 rAF 节流渲染对照',
  sell: '动画与高频事件都交给 rAF，按帧渲染不丢帧',
} satisfies CaseMeta
