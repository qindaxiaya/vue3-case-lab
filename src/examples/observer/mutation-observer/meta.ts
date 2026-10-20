// ============================================================
// 案例元数据：MutationObserver DOM 变更监听
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'mutation-observer',
  title: 'MutationObserver DOM 变更监听',
  difficulty: 'intermediate',
  tags: ['MutationObserver', 'childList', 'takeRecords'],
  summary: 'childList/attributes/characterData 三开关组合观察，takeRecords 冲刷防变更洪泛',
  sell: '三开关监听 DOM 变更，takeRecords 防洪泛',
  explain: {
    situation:
      '第三方脚本会往页面里插广告、改样式，你想知道它什么时候动的手；用 setInterval 每隔几百毫秒检查一次，既费性能又抓不准。',
    background:
      'MutationObserver 让浏览器在 DOM 变更后主动通知你，而且会把同一轮里的多次修改合并成一个数组，不会每改一次就回调一次，正好解决「变更洪泛」。',
    action:
      '案例演示三个开关：childList（增删子节点）、attributes（改属性）、characterData（改文本），配合 subtree 深度监听；需要「安静地清空已有记录」时用 takeRecords。',
    conclusion:
      '记住：监听 DOM 变化用 MutationObserver，不要轮询。只开需要的开关，用完 disconnect，否则它一直盯着页面。',
  },
} satisfies CaseMeta
