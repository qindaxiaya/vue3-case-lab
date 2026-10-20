// ============================================================
// 案例元数据：watch/watchEffect 三大陷阱
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'watch-traps',
  title: 'watch/watchEffect 三大陷阱',
  difficulty: 'advanced',
  tags: ['watch', 'watchEffect', 'deep', 'flush'],
  summary: '浅监听盲区、异步清理、三种执行时机读页面元素的差异',
  sell: '深度监听、异步清理、执行时机三个坑一次避开',
  explain: {
    situation:
      '你侦听一个响应式对象，改里面的属性回调不触发；异步请求回来顺序乱了，旧数据覆盖新数据；想在侦听回调里读页面，拿到的还是旧值。',
    background:
      '侦听响应式对象默认是浅监听，只盯对象引用；异步竞态要用 onCleanup 取消上一次；flush 决定回调在页面更新前还是后执行，有三个取值：pre（默认，更新前）、post（更新后）、sync（同步立即）。',
    action:
      '案例逐一复现：改嵌套属性时浅监听不触发，加 deep: true 才触发；快速改关键词时旧请求回来覆盖新结果，用 onCleanup 在下次触发前取消；在回调里读元素宽度，pre 拿到旧值、post 拿到新值。',
    conclusion:
      '记住：监听嵌套要 deep，异步回调先 cleanup，读页面用 post。watchEffect 只收集执行时碰到的依赖，分支切换会漏。',
  },
} satisfies CaseMeta
