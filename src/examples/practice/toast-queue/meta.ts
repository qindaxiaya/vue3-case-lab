// ============================================================
// 案例元数据：Toast 通知队列
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'toast-queue',
  title: 'Toast 通知队列',
  difficulty: 'intermediate',
  tags: ['队列', 'animationend', '通知组件'],
  summary: '屏上限 3 条超出排队补位，CSS animationend 驱动消失，hover 真暂停倒计时',
  sell: '最多 3 条排队补位，animationend 精确回收',
  explain: {
    situation:
      '页面上同时弹了 10 条 Toast，内容全被遮住。你设 3 秒自动关闭，可鼠标移上去暂停了，3 秒一到它还是消失了。',
    background:
      'Toast 要分「屏上显示区」和「排队区」：屏上最多 3 条，超出的排队，走一条补一条。消失别用 setTimeout，用 CSS 的 animationend：hover 时 animation-play-state: paused 会真正暂停动画，进度条和消失时机天然一致。',
    action:
      '案例最多同时显示 3 条，超出自动排队补位；hover 真暂停倒计时，移开继续；进度条和消失由同一个动画驱动。',
    conclusion:
      '记住：Toast = 队列 + 上限 + 动画驱动回收。别让 setTimeout 和动画各管各的，迟早对不上。',
  },
} satisfies CaseMeta
