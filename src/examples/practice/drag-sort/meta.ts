// ============================================================
// 案例元数据：指针拖拽排序
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'drag-sort',
  title: '指针拖拽排序',
  difficulty: 'advanced',
  tags: ['Pointer 事件', 'FLIP', 'WAAPI', '排序'],
  summary: 'Pointer 拖拽 + 目标位高亮 + 松手 splice 移动；用 FLIP 让其余行从旧位置平滑滑入',
  sell: 'Pointer 拖拽 + FLIP，换位动画不生硬',
  explain: {
    situation:
      '要做可拖拽排序的列表。你写完发现拖动时其他行「啪」地跳过去，很生硬；手机上长按还根本拖不动。',
    background:
      '原生 HTML5 拖拽在移动端基本不可用。用 Pointer 事件自己算：按下记起点，移动时判断越过半行就换位，松手 splice 真正移动；换位时用 FLIP 先记录旧位置、改完再播放位移动画，视觉才顺。',
    action:
      '案例用 Pointer 拖拽 + 目标位高亮 + 松手移动，其余行用 FLIP / WAAPI 平滑滑入，鼠标和触屏都能操作。',
    conclusion:
      '记住：拖拽排序用 Pointer，别用 HTML5 draggable。FLIP 是换位动画的通用套路：先记旧位置，改完再动画回去。',
  },
} satisfies CaseMeta
