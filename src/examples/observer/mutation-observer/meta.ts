// ============================================================
// 案例元数据：MutationObserver DOM 变更监听
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'mutation-observer',
  title: 'MutationObserver DOM 变更监听',
  difficulty: 'intermediate',
  tags: ['MutationObserver', 'childList', 'takeRecords'],
  summary: '三个开关分别监听子节点、属性、文字变化，批量通知避免回调刷屏',
  sell: '三开关监听页面变化，批量通知防刷屏',
  explain: {
    situation:
      '第三方脚本会往页面里插广告、改按钮样式，你想知道它什么时候动的手；用定时器每隔几百毫秒检查一次，既费性能又抓不准。',
    background:
      '浏览器提供了专门监听页面结构变化的接口 MutationObserver。页面元素被增删、属性被修改、文字被替换时，浏览器会把这些变化攒成一批，在一个时间段结束后统一通知你，而不是每改一次就回调一次，所以不会因为变化太多而拖慢页面。',
    action:
      '案例创建 MutationObserver，在回调里遍历变化记录，按类型区分是子节点增删、属性变化还是文字变化。观察时可以分别打开 childList（子节点）、attributes（属性）、characterData（文字）三个开关，再用 subtree 把后代元素也纳入范围。需要把已攒下但还没通知的变化清掉时调用 takeRecords。组件卸载时 disconnect。',
    conclusion:
      '记住：监听页面结构变化用 MutationObserver，不要用定时器轮询。只打开需要的开关，用完及时断开。',
  },
} satisfies CaseMeta
