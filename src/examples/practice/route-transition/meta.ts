// ============================================================
// 案例元数据：路由转场动画（前进/后退方向）
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'route-transition',
  title: '路由转场动画（方向）',
  difficulty: 'advanced',
  tags: ['Transition', '路由动画', '前进后退', '历史栈'],
  summary: '模拟路由栈：前进左滑、后退右滑，Transition 按方向切换动画类，栈状态可视化',
  sell: '前进左滑、后退右滑，路由方向决定动画',
  explain: {
    situation:
      'App 里点进详情、再返回列表，页面都是「啪」一下切换，没有方向感，用户总觉得自己迷路了。',
    background:
      '转场方向取决于「前进还是后退」。给路由标一个层级（首页 0、列表 1、详情 2），比较层级就知道该左滑还是右滑；Vue 的 Transition 只要换不同的 name，就能套不同动画。',
    action:
      '案例模拟一个路由栈：前进左滑、后退右滑，栈状态可视化；用 out-in 避免两页同时存在，返回时还能恢复离开时的滚动位置。',
    conclusion:
      '记住：方向由路由深度决定，别用随机动画；out-in 必加，否则会重叠闪烁。新项目可以试试 View Transitions API。',
  },
} satisfies CaseMeta
