// ============================================================
// 案例元数据：Web Worker 主线程解冻
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'web-worker',
  title: 'Web Worker 主线程解冻',
  difficulty: 'intermediate',
  tags: ['Worker', 'Blob URL', '多线程'],
  summary: '同一份重计算分别放主线程与后台线程，用心跳对比界面冻结与照常响应',
  sell: '重计算让页面假死：搬到后台线程，界面照常响应',
  explain: {
    situation:
      '页面要解析 20MB 日志、做复杂计算。点了按钮整个页面冻住十秒，加载动画都停了，用户以为死机。',
    background:
      'JavaScript 默认只有一条主线程，重计算期间既不能画画面也不能响应事件。Web Worker 是浏览器提供的后台线程，把计算搬过去，主线程就能继续画动画、接点击，两边互不阻塞。',
    action:
      '案例把同一份重计算跑两条路径：主线程跑时，页面上的心跳计时器明显停住；后台线程跑时，心跳照常。代码里用 postMessage 发消息、onmessage 收结果；传入大数组时演示所有权转移：把数据的所有权直接交给后台线程，原线程不再持有，避免复制。',
    conclusion:
      '记住：超过 50 毫秒的计算就考虑后台线程。传大数组默认会复制，用所有权转移才不花复制时间。',
  },
} satisfies CaseMeta
