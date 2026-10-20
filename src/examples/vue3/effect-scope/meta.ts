// ============================================================
// 案例元数据：effectScope 批量停止副作用
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'effect-scope',
  title: 'effectScope 批量停止副作用',
  difficulty: 'advanced',
  tags: ['effectScope', 'onScopeDispose', '内存泄漏', 'watch'],
  summary: '反复挂载卸载时，用 effectScope 一次性收口 watcher 与定时器，把「看不见的泄漏」变成数字',
  sell: 'effectScope 一次收口，泄漏看得见、停得掉',
  explain: {
    situation:
      '弹窗里随手创建了 3 个 watcher 和 1 个定时器，关掉弹窗后请求还在发、日志还在打；找了一下午才发现是「没人停」。',
    background:
      '组件卸载只会自动清理「组件内」创建的副作用。如果在函数里、循环里手动创建 watch、定时器、事件监听，没人替你收尾。effectScope 像一个容器，把作用域内创建的 watcher / computed 全收进去，stop() 一次全停。',
    action:
      '案例反复挂载卸载，对比「漏清理」和「用 effectScope」：run 内创建的 watch 归作用域管，定时器/事件用 onScopeDispose 注册清理，stop 后计数器归零。',
    conclusion:
      '记住：成组创建的副作用用一个 scope 收口，非响应式资源用 onScopeDispose 清理。写库、写组合式函数时尤其需要。',
  },
} satisfies CaseMeta
