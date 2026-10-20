// ============================================================
// 案例元数据：主题切换（CSS 变量 + 系统偏好 + 无闪烁）
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'theme-switch',
  title: '主题切换无闪烁',
  difficulty: 'beginner',
  tags: ['CSS 变量', '暗色模式', 'matchMedia', 'localStorage'],
  summary: '亮/暗/跟随系统三态切换，局部变量预览 + head 内联脚本方案，讲清首帧不闪白的根因',
  sell: '三态主题 + 内联脚本，首帧不闪白',
  explain: {
    situation:
      '暗色模式上线后，用户每次刷新页面都先白一下再变黑，夜里特别刺眼，投诉说「像闪光弹」。',
    background:
      '闪白是因为 JS 在页面渲染之后才读 localStorage、加 .dark 类，那一瞬间浏览器已经按亮色画完了。把判断写进 head 里的内联脚本，在首次绘制前就把类加好，才能不闪。',
    action:
      '案例做亮 / 暗 / 跟随系统三态，所有颜色走 CSS 变量；给出 head 内联脚本方案，并监听系统主题变化（用户改设置时无需刷新）。',
    conclusion:
      '记住：防闪白靠「head 内联脚本 + 首帧前加类」，别等 Vue 挂载。auto 只是别名，最终生效值仍要收敛成 light 或 dark。',
  },
} satisfies CaseMeta
