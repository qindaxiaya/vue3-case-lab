// ============================================================
// 案例元数据：watch/watchEffect 三大陷阱
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'watch-traps',
  title: 'watch/watchEffect 三大陷阱',
  difficulty: 'advanced',
  tags: ['watch', 'watchEffect', 'deep', 'flush'],
  summary: 'deep 浅监听盲区、onCleanup 取消过期异步、sync/pre/post 三种 flush 读 DOM 的差异',
  sell: 'deep、清理、flush 三个坑一次避开',
  explain: {
    situation:
      '你 watch 一个 reactive 对象，改里面的属性回调不触发；异步请求回来顺序乱了，旧数据覆盖新数据；想在 watch 里读 DOM，拿到的还是旧值。',
    background:
      'watch(reactive) 默认是浅监听，只盯对象引用；异步竞态要用 onCleanup 取消上一次；flush 决定回调在 DOM 更新前还是后执行（pre / post / sync）。三个坑各有各的原因。',
    action:
      '案例逐一复现：deep 浅监听的盲区、onCleanup 取消过期请求、三种 flush 读 DOM 的差异，每种都给出错误现象和正确写法。',
    conclusion:
      '记住：监听嵌套要 deep，异步回调先 cleanup，读 DOM 用 flush: "post"。watchEffect 只收集执行时碰到的依赖，分支切换会漏。',
  },
} satisfies CaseMeta
