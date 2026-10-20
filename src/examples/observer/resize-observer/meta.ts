// ============================================================
// 案例元数据：ResizeObserver 容器尺寸监听
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'resize-observer',
  title: 'ResizeObserver 容器尺寸监听',
  difficulty: 'beginner',
  tags: ['ResizeObserver', '响应式布局', 'content-box'],
  summary: '监听容器尺寸变化替代轮询，对比内容区与含边框两种测量模式，按需选精确值',
  sell: '轮询尺寸浪费性能：尺寸一变就回调，两种测量可选',
  explain: {
    situation:
      '侧边栏一折叠，图表容器变窄了，但图表还是原来的宽度；你监听窗口大小变化，可容器变了、窗口没变，回调根本不触发。',
    background:
      '窗口大小变化只知道「浏览器窗口」变了，不知道页面里某个盒子变了。ResizeObserver 是专门观察元素尺寸的接口：元素宽高一变就通知你，而且能区分「内容区尺寸」和「包含内边距、边框的整体尺寸」。',
    action:
      '案例用 ResizeObserver 观察图表容器，回调里读取 contentRect 拿到内容区宽高并重绘；同时展示 borderBoxSize，说明加上内边距和边框后的尺寸差异。观察时第二个参数传 box 可以指定按哪种盒子测量。组件卸载时 disconnect。',
    conclusion:
      '记住：组件自适应看 ResizeObserver，不要用窗口大小变化代替。图表、虚拟列表、文字溢出检测都靠它。',
  },
} satisfies CaseMeta
