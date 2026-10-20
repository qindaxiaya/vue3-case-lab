// ============================================================
// 案例元数据：Web Worker 主线程解冻
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'web-worker',
  title: 'Web Worker 主线程解冻',
  difficulty: 'intermediate',
  tags: ['Worker', 'Blob URL', '多线程'],
  summary: '同一份重计算两条路径：主线程跑页面冻死，Worker 跑界面照常——心跳实测对比',
  sell: '重计算搬进 Worker，主线程心跳不再停',
  explain: {
    situation:
      '页面要解析 20MB 日志、做复杂计算。点了按钮整个页面冻住十秒，加载动画都停了，用户以为死机。',
    background:
      'JS 默认只有一条主线程，重计算期间既不能渲染也不能响应事件。Web Worker 是另一条线程，把计算搬过去，主线程就能继续画动画、接点击，两者互不阻塞。',
    action:
      '案例把同一份重计算跑两条路径：主线程跑时心跳停了，Worker 跑时心跳照常；演示 postMessage 通信，以及 Transferable 转移大数组所有权实现零拷贝。',
    conclusion:
      '记住：超过 50ms 的计算就考虑 Worker。传大数组默认是拷贝，用 Transferable 转移 ArrayBuffer 才不花拷贝时间。',
  },
} satisfies CaseMeta
