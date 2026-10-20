// ============================================================
// 案例元数据：自定义指令三件套
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'custom-directives',
  title: '自定义指令三件套',
  difficulty: 'intermediate',
  tags: ['directive', '权限', '懒加载', 'click-outside', 'IntersectionObserver'],
  summary: 'v-permission 按钮级权限、v-lazy 观察器懒加载、v-click-outside 点外关闭，含完整清理逻辑',
  sell: '权限、懒加载、点外关闭，三个指令带走',
  explain: {
    situation:
      '按钮级权限每个页面都写一遍 v-if 判断角色；图片懒加载、点外部关闭菜单，也在不同组件里各写一套，越抄越乱。',
    background:
      '自定义指令适合「跟 DOM 打交道」的复用逻辑：mounted 时操作元素，updated 时响应变化，unmounted 时清理。权限用 display 控制显隐，懒加载用 IntersectionObserver，点外关闭监听 document。',
    action:
      '案例实现三个指令：v-permission 按角色显隐、v-lazy 进视口才加载并立即断开观察、v-click-outside 点外面关闭且卸载时移除监听。',
    conclusion:
      '记住：指令管 DOM，组件管状态。指令里创建的东西一定要在 unmounted 清理，否则就是泄漏。',
  },
} satisfies CaseMeta
