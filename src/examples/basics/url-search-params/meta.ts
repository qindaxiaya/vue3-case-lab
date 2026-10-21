// ============================================================
// 案例元数据：URLSearchParams 筛选状态进地址栏
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'url-search-params',
  title: 'URLSearchParams 筛选状态进地址栏',
  difficulty: 'beginner',
  tags: ['URLSearchParams', 'replaceState', 'popstate'],
  summary: '分类、关键词、页码写进地址栏，刷新后退分享都能还原筛选状态',
  sell: '筛选一刷新就丢：状态进地址栏，分享链接也能还原',
  explain: {
    situation:
      '用户挑了半天筛选条件、翻到第 3 页，手一滑刷新了页面，列表回到第一页什么都没剩；想发给同事一条还能还原结果的链接，也只能口头描述筛选条件。',
    background:
      '地址栏查询串是浏览器自带的「免费存档」：只要状态写进去，刷新、后退、前进、分享链接，任何一条路径都会带着它回来。URLSearchParams 负责把状态安全地拼成查询串——空格、中文、特殊符号全部自动转义，手工拼接很容易在这些字符上翻车。',
    action:
      '案例在勾选分类、输入关键词、翻页时用 URLSearchParams 生成查询串，再交给 history.replaceState 静默写入地址栏；「假装分享链接」复制当前地址，「模拟新打开 + 后退」走真实的历史栈，配合 popstate 事件把状态原样还原，还能切到内存模式对比「刷新即丢」。',
    conclusion:
      '记住：筛选类页面把状态写进查询串（URLSearchParams + replaceState），并在加载时从路由读回来初始化，就能同时得到刷新还原、后退还原和可分享链接。',
  },
} satisfies CaseMeta
