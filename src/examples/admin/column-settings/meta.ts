// ============================================================
// 案例元数据：ColumnSettings 表格列设置
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'column-settings',
  title: 'ColumnSettings：表格列别写死在代码里',
  difficulty: 'beginner',
  tags: ['后台', '表格', '列设置', '持久化'],
  summary: '列显隐、顺序、恢复默认，配置只存列 key',
  sell: '列设置要能记住，也要能一键恢复默认',
  explain: {
    situation:
      '后台表格列越来越多，不同角色关心的列不一样：运营想看负责人，财务想看金额。每个人都要求「能不能把这几列藏掉」，最后只能改代码。',
    background:
      '列设置本质是一份「显示哪些列、按什么顺序显示」的配置。它和表格数据无关，应该独立保存；只存列 key 而不是整个列对象，标题、宽度改了也不会把旧配置顶掉。',
    action:
      '案例把列定义和当前配置分开：order 决定顺序，visible 决定显隐，表格根据两者算出 visibleColumns；每次改动自动写入 localStorage，读取时过滤不认识的 key，恢复默认会清掉本地配置。',
    conclusion:
      '记住：列设置 = 顺序 + 显隐 + 持久化。固定列不要允许隐藏，读配置要容错，恢复默认要连本地存储一起清。',
  },
} satisfies CaseMeta
