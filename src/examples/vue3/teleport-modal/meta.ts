// ============================================================
// 案例元数据：Teleport 弹层工程化
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'teleport-modal',
  title: 'Teleport 弹层工程化',
  difficulty: 'intermediate',
  tags: ['Teleport', '焦点陷阱', '滚动锁', '无障碍'],
  summary: '挂到页面根部只是起点：滚动锁、Esc 关闭、Tab 焦点循环、焦点归还一次补齐',
  sell: '滚动锁、Esc、焦点循环，弹窗工程化补齐',
  explain: {
    situation:
      '自己写的弹窗挂到 body 后：背景还能滚，按 Esc 没反应，一直按 Tab 焦点跑到弹窗后面去了，无障碍扫描一堆错。',
    background:
      '挂 body 只解决「不被裁剪」。一个能用的弹窗还要：打开时锁住页面滚动、Esc 能关、焦点困在弹窗里循环、关闭后把焦点还给触发按钮，键盘用户才知道自己回到了哪。',
    action:
      '案例逐项补齐：打开前记录 body 的 overflow 值，关闭时原样恢复；在 document 上监听 keydown，Esc 触发关闭；监听 Tab，到最后一个可聚焦元素时把焦点送回第一个，Shift+Tab 反向循环；打开后聚焦第一个可聚焦元素，关闭后让之前保存的触发按钮重新获得焦点。',
    conclusion:
      '记住：弹窗 = 传送门 + 滚动锁 + Esc + 焦点循环 + 焦点归还。真实项目优先用原生 dialog，或直接用成熟组件库。',
  },
} satisfies CaseMeta
