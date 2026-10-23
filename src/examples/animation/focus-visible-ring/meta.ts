// ============================================================
// 案例元数据：键盘焦点环
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'focus-visible-ring',
  title: '键盘焦点环',
  difficulty: 'beginner',
  tags: ['focus-visible', 'outline', '键盘无障碍', '焦点管理'],
  summary: '用 :focus-visible 只在键盘操作时画焦点环，鼠标点击不打扰',
  sell: '键盘用户才需要焦点环，鼠标点击不必打扰',
  explain: {
    situation:
      '设计师觉得浏览器默认的焦点框难看，让把 outline 去掉。去掉之后用鼠标点没问题，可键盘用户按 Tab 时完全不知道焦点停在哪个按钮上，只能靠猜。',
    background:
      '焦点环是键盘用户的位置提示，鼠标用户并不需要。浏览器提供了 :focus-visible：它会在「用户需要知道焦点在哪」时匹配，比如用 Tab 键移动、输入框获得焦点；普通鼠标点击按钮通常不匹配。这样一套样式就能同时照顾两种人。旧做法直接写 outline: none，把所有情况都关掉了，等于把键盘用户的路标拆了。',
    action:
      '案例放了按钮、链接、输入框、卡片按钮四个控件，可以在「无焦点样式」与「自建焦点环」之间切换。自建模式用 :focus-visible 画 2px 主色轮廓并留 2px 间距；面板显示当前聚焦控件、是否键盘触发，以及浏览器计算后的轮廓宽度，鼠标点击与键盘 Tab 的差别一眼可见。',
    conclusion:
      '记住：不要用 outline: none 一关了之。要区分「谁需要焦点提示」，把轮廓写在 :focus-visible 上；焦点环要跟背景有对比，并留出偏移，别贴着边框画。',
  },
} satisfies CaseMeta
