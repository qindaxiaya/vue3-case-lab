// ============================================================
// 案例元数据：自定义指令三件套
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'custom-directives',
  title: '自定义指令三件套',
  difficulty: 'intermediate',
  tags: ['directive', '权限', '懒加载', 'click-outside', 'IntersectionObserver'],
  summary: '权限控制、观察器懒加载、点外关闭三个指令，含完整清理逻辑',
  sell: '权限、懒加载、点外关闭，三个指令带走',
  explain: {
    situation:
      '按钮级权限每个页面都写一遍判断角色的代码；图片懒加载、点外部关闭菜单，也在不同组件里各写一套，越抄越乱。',
    background:
      '自定义指令适合「跟页面元素打交道」的复用逻辑：元素挂载时操作它，更新时响应变化，卸载时清理。权限用 display 控制显隐，懒加载用交叉观察器，点外关闭监听整个文档。',
    action:
      '案例实现三个指令：v-permission 在元素插入页面时根据当前角色决定 display；v-lazy 创建交叉观察器，进入视口后把 data-src 赋给 src 并立即停止观察，卸载时断开；v-click-outside 在 document 上监听点击，判断点击目标是否在元素内部，卸载时移除监听。',
    conclusion:
      '记住：指令管页面元素，组件管数据状态。指令里创建的东西一定要在卸载钩子里清理，否则就是泄漏。',
  },
} satisfies CaseMeta
