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
} satisfies CaseMeta
