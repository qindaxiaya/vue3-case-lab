// ============================================================
// 案例元数据：定高虚拟列表
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'virtual-list',
  title: '定高虚拟列表',
  difficulty: 'intermediate',
  tags: ['虚拟列表', '长列表', 'rAF 节流'],
  summary: '10 万行只渲染视口 ±5 行，transform 定位 + rAF 节流滚动，DOM 恒定约 30 个',
  sell: '10 万行只渲染 30 个 DOM，滚动依旧顺滑',
  explain: {
    situation:
      '要展示 10 万条数据，一次性渲染页面直接卡死；改成分页，又满足不了「一直往下滑」的体验。',
    background:
      '视口就那么大，只渲染看得见的几十行就够了。用「滚动位置 ÷ 行高」算起始行，渲染视口内上下各多 5 行；再用一个撑高的占位层保证滚动条比例正确，内容层用 transform 挪到对应位置。',
    action:
      '案例 10 万行只渲染约 30 个 DOM：滚动时用 rAF 节流重算索引，占位层撑出总高度，内容层 transform 定位，DOM 数量始终恒定。',
    conclusion:
      '记住：虚拟列表 = 起始索引 + 可视数量 + 占位高度 + transform 偏移。定高用除法，不定高用前缀和 + 二分。',
  },
} satisfies CaseMeta
