// ============================================================
// 案例元数据：effectScope 批量停止副作用
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'effect-scope',
  title: 'effectScope 批量停止副作用',
  difficulty: 'advanced',
  tags: ['effectScope', 'onScopeDispose', '内存泄漏', 'watch'],
  summary: '反复挂载卸载时，用副作用作用域一次性收口侦听器与定时器，把「看不见的泄漏」变成数字',
  sell: '副作用作用域一次收口，泄漏看得见、停得掉',
  explain: {
    situation:
      '弹窗里随手创建了 3 个侦听器和 1 个定时器，关掉弹窗后请求还在发、日志还在打；找了一下午才发现是「没人停」。',
    background:
      '组件卸载只会自动清理「组件内」创建的副作用。如果在函数里、循环里手动创建侦听器、定时器、事件监听，没人替你收尾。effectScope 像一个容器，把作用域内创建的侦听器和计算属性全收进去，调用 stop 一次全停。',
    action:
      '案例反复挂载卸载，对比「漏清理」和「用作用域」：先创建一个作用域，在它的 run 函数里创建侦听器；定时器和事件监听这类不属于响应式系统的东西，用 onScopeDispose 注册清理函数。最后调用 stop，侦听器和清理函数一起执行，计数器归零。',
    conclusion:
      '记住：成组创建的副作用用一个作用域收口，非响应式资源用 onScopeDispose 清理。写库、写组合式函数时尤其需要。',
  },
} satisfies CaseMeta
