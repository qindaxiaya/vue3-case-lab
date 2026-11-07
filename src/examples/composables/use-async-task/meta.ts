// ============================================================
// 案例元数据：useAsyncTask 异步请求状态机
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'use-async-task',
  title: 'useAsyncTask：异步请求的状态机',
  difficulty: 'intermediate',
  tags: ['组合式函数', '异步请求', 'AbortController', '状态机'],
  summary: 'loading、error、取消、重试，一个组合式函数全收好',
  sell: '请求状态别再散落，取消和重试交给 useAsyncTask',
  explain: {
    situation:
      '每个页面都在写 loading / error / data 三个 ref，再配一段 try/catch/finally；用户连点两次，旧请求晚回来把新结果覆盖掉，取消按钮按了也没用。',
    background:
      '异步请求不是「成功 / 失败」两态，中间还有进行中、主动取消、被新请求取代。手写时这些状态散在多个变量里，取消只是把结果丢掉，定时器或网络请求其实还在跑。',
    action:
      '案例把请求封装成 useAsyncTask(task)：内部维护 idle / pending / success / error / aborted 五种状态，用 AbortController 真正中止旧请求，AbortError 单独归为「已取消」，并暴露 execute / retry / reset。',
    conclusion:
      '记住：状态机比三个布尔值可靠；取消要真的中止，而不是等结果回来再丢弃。组件卸载时也要取消在途请求，避免回调改到已经没人看的状态。',
  },
} satisfies CaseMeta
