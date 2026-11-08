// ============================================================
// 案例元数据：QuickViewDrawer 行快速查看
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'quick-view-drawer',
  title: 'QuickViewDrawer：看详情别离开列表',
  difficulty: 'intermediate',
  tags: ['后台', '表格', '抽屉', '焦点'],
  summary: '抽屉只读展示行详情，首尾禁用上下条，关闭归还焦点',
  sell: '行内打开只读抽屉，上下条连续查看',
  explain: {
    situation:
      '表格里点「查看」跳到详情页，回来筛选和页码全丢了；用弹窗看详情又挡住列表，上下条切换还要反复关闭再点下一行。',
    background:
      '快速查看的目标是「不离开列表」：抽屉从右侧滑出，列表还在；只读展示，不需要保存；上下条直接切换当前索引，到首尾禁用，用户不用回列表再点。',
    action:
      '案例用 activeIndex 指向当前订单，抽屉只读展示详情；打开时记录触发按钮，关闭或按 Escape 后通过 after-leave 把焦点还回去；首尾按钮由索引边界派生禁用状态。',
    conclusion:
      '记住：快速查看 = 抽屉 + 当前索引 + 焦点归还。只读场景不要放保存按钮，上下条边界要禁用。',
  },
} satisfies CaseMeta
