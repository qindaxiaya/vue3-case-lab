// ============================================================
// 案例元数据：useEventListener / useRafFn 封装范式
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'use-event-listener',
  title: 'useEventListener / useRafFn 封装范式',
  difficulty: 'intermediate',
  tags: ['组合式函数', '自动清理', 'useRafFn'],
  summary: '组合式函数把 addEventListener/rAF 的清理收进自身生命周期——调用方零清理负担',
  sell: '清理收进 composable，组件卸载零泄漏',
  explain: {
    situation:
      '你给按钮加了监听，组件都切走了事件还在触发；mouseover 回调里直接改样式，鼠标一动页面就卡。',
    background:
      '监听器挂在 window / document 上，组件销毁了它仍然存在，还通过闭包拽着旧 DOM；高频事件一帧能触发几十次，每次都改 DOM，浏览器根本来不及按帧渲染。',
    action:
      '案例用 useEventListener 把「注册 + 清理」包在一起：组件卸载时自动 removeEventListener；useRafFn 把连续事件先暂存，每帧只渲染一次，并在卸载时取消动画帧。',
    conclusion:
      '记住：副作用要「谁创建谁清理」，交给 composable 管最省心；高频渲染一律交给 rAF，别在事件回调里直接改 DOM。',
  },
} satisfies CaseMeta
