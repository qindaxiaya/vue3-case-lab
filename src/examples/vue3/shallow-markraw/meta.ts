// ============================================================
// 案例元数据：shallowRef / markRaw 性能边界
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'shallow-markraw',
  title: 'shallowRef / markRaw 性能边界',
  difficulty: 'advanced',
  tags: ['shallowRef', 'markRaw', 'triggerRef'],
  summary: '对比深代理、浅代理与永不代理三档开销，大数据只改引用时手动触发更新',
  sell: '大对象深层响应式太慢：按需降级，实测三档开销',
  explain: {
    situation:
      '一万条数据的表格，用 reactive 包起来后初始化要好几秒，滚动也卡。你听说浅层响应式能优化，但不知道什么时候该用、用了为什么数据不更新。',
    background:
      'reactive 会递归代理每个嵌套属性，数据越大开销越大。shallowRef 只代理 .value 这一层，内部对象完全不动，所以改嵌套属性不会触发更新，要替换整个 .value 或手动调用 triggerRef。markRaw 更彻底：让对象永远不被代理。',
    action:
      '案例把同一份一万条数据分别用三种方式包，实测初始化耗时和内存占用。浅层版本里点「改第一项」页面不变，点「换整个列表」或「手动触发」才更新。markRaw 演示把图表实例之类的大对象排除在响应式之外。',
    conclusion:
      '记住：大数据、只整体替换的列表用浅层引用；图表实例、第三方对象用 markRaw；需要细粒度响应式才用 reactive。',
  },
} satisfies CaseMeta
