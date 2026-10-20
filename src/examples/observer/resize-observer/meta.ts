// ============================================================
// 案例元数据：ResizeObserver 容器尺寸监听
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'resize-observer',
  title: 'ResizeObserver 容器尺寸监听',
  difficulty: 'beginner',
  tags: ['ResizeObserver', '响应式布局', 'content-box'],
  summary: '监听任意容器尺寸变化，contentRect 与 borderBoxSize 两种测量模式对比',
  sell: '容器尺寸变化不用轮询，两种测量模式一次讲清',
  explain: {
    situation:
      '侧边栏一折叠，图表的容器变窄了，但图还是老宽度；你监听 window.resize，可容器变了窗口没变，回调根本不触发。',
    background:
      'window.resize 只知道「窗口」变了，不知道某个 div 变了。ResizeObserver 直接观察元素本身，尺寸一变就通知，还能区分内容区（contentRect）和含边框的整体尺寸。',
    action:
      '案例用 ResizeObserver 观察容器，实时显示宽高；对比 contentRect（不含 padding/border）和 borderBoxSize（含边框）两种测量，演示折叠侧栏、改字体等场景。',
    conclusion:
      '记住：组件自适应看 ResizeObserver，别用 window.resize。图表、虚拟列表、文本溢出检测都靠它。',
  },
} satisfies CaseMeta
