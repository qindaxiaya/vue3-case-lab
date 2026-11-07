// ============================================================
// 案例元数据：usePolling 轮询节奏
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'use-polling',
  title: 'usePolling：轮询要等上一次跑完',
  difficulty: 'intermediate',
  tags: ['组合式函数', '轮询', '定时器', '页面可见性'],
  summary: 'setInterval 会叠并发；改成跑完再排下一次，后台自动暂停',
  sell: '轮询别用 setInterval，跑完再排下一次更稳',
  explain: {
    situation:
      '用 setInterval 每 800ms 拉一次进度，接口偶尔慢到 1300ms，请求就叠在一起；页面切到后台，轮询还在空转，回来时攒了一堆响应。',
    background:
      'setInterval 只保证「到点触发」，不关心上一次有没有跑完。任务耗时超过间隔时，第二次、第三次会同时在路上，回调顺序也可能乱。页面隐藏后浏览器会节流定时器，但不会替你停止轮询。',
    action:
      '案例把轮询封装成 usePolling(task, interval)：每次任务结束后才用 setTimeout 排下一次，天然不会并发；监听 visibilitychange，页面隐藏时清掉下一次定时器，回到前台再继续。',
    conclusion:
      '记住：轮询的节奏应该由「上一次完成」决定，而不是墙上的时钟。停止时要同时清定时器、中止在途请求，卸载时用 onScopeDispose 收口。',
  },
} satisfies CaseMeta
