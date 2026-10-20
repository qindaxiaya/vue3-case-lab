// ============================================================
// 案例元数据：requestAnimationFrame 渲染循环
// 两个演示：正弦缓动往返动画 + 高频渲染合并（节流）
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'raf-loop',
  title: 'requestAnimationFrame 渲染循环',
  difficulty: 'intermediate',
  tags: ['requestAnimationFrame', '动画', '节流', '渲染循环'],
  summary: '时间戳驱动正弦往返动画，鼠标高频移动用逐帧回调节流渲染对照',
  sell: '动画与高频事件都交给逐帧回调，按帧渲染不丢帧',
  explain: {
    situation:
      '你想让方块跟着鼠标动，在鼠标移动回调里直接改位置，鼠标一动页面就开始卡；用定时器做动画，又总感觉一抖一抖的。',
    background:
      '浏览器一帧只画一次，但鼠标移动一帧能触发几十次，改那么多次页面大部分都白改了。requestAnimationFrame 会在下一次画面刷新前调用你，而且同一帧只登记一次，天然把多次事件合并成一次渲染。',
    action:
      '案例用时间戳驱动正弦往返动画；另一个对比里，鼠标移动时只把最新坐标存进变量，并用一个「本帧是否已经预约」的开关避免重复登记，逐帧回调里才真正改元素位置。卸载时 cancelAnimationFrame。',
    conclusion:
      '记住：动画和高频界面更新都用逐帧回调，事件回调只负责存值。卸载时记得取消，否则循环会在后台一直跑。',
  },
} satisfies CaseMeta
