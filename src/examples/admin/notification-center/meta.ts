// ============================================================
// 案例元数据：NotificationCenter 通知中心
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'notification-center',
  title: 'NotificationCenter：通知中心别只做红点',
  difficulty: 'beginner',
  tags: ['后台', '通知', '未读', '列表'],
  summary: '全部/未读切换、单条已读、全部已读、重置',
  sell: '通知中心要让未读数、列表、按钮状态一致',
  explain: {
    situation:
      '顶栏有个红点，点进去却是全部通知混在一起；用户点开一条，红点数字没变；点「全部已读」后未读列表还留着旧数据，得刷新才干净。',
    background:
      '通知中心有三份互相关联的状态：通知列表、未读筛选、未读计数。很多实现只改其中一份，导致红点、列表、按钮状态对不上。正确做法是让它们都从同一份 notices 派生。',
    action:
      '案例用一份 notices 存所有通知，未读数和未读列表都由它 computed 出来；点单条只改这一条的 read，全部已读一次改完；切换全部/未读只是换筛选条件，不复制列表。',
    conclusion:
      '记住：通知中心 = 一份数据 + 派生未读数 + 派生筛选列表。别维护第二份未读数组，否则迟早不同步。',
  },
} satisfies CaseMeta
