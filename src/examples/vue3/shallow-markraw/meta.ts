// ============================================================
// 案例元数据：shallowRef / markRaw 性能边界
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'shallow-markraw',
  title: 'shallowRef / markRaw 性能边界',
  difficulty: 'advanced',
  tags: ['shallowRef', 'markRaw', 'triggerRef'],
  summary: '深代理 vs 浅代理 vs 永不代理三档对比，triggerRef 手动触发，大数据状态首选浅层',
  sell: '三档代理开销实测，大数据状态选对 API',
  explain: {
    situation:
      '一万条数据的表格，用 reactive 包起来后初始化要好几秒，滚动也卡。你听说 shallowRef 能优化，但不知道什么时候该用、用了为什么数据不更新。',
    background:
      'reactive 会递归代理每个嵌套属性，数据越大开销越大。shallowRef 只代理 .value 这一层，内部对象完全不动，所以改嵌套属性不会触发更新（要替换 .value 或手动 triggerRef）。markRaw 更彻底：让对象永远不被代理。',
    action:
      '案例把同一份一万条数据分别用三种方式包，实测初始化耗时和内存占用；现场演示 shallowRef 改嵌套不触发、替换 .value 才触发。',
    conclusion:
      '记住：大数据、只整体替换的列表用 shallowRef；图表实例、第三方对象用 markRaw；需要细粒度响应式才用 reactive。',
  },
} satisfies CaseMeta
