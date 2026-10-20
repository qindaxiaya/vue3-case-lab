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
  summary: '时间戳驱动正弦往返动画 + mousemove 高频事件 rAF 节流渲染对照',
  sell: '动画与高频事件都交给 rAF，按帧渲染不丢帧',
  explain: {
    situation:
      '你想让方块跟着鼠标动，在 mousemove 里直接改位置，鼠标一动页面就开始卡；用 setInterval 做动画，又总感觉一抖一抖的。',
    background:
      '浏览器一帧只画一次，但 mousemove 一帧能触发几十次——改那么多次 DOM，大部分都白改了。requestAnimationFrame 会在「下一次重绘前」调用你，而且同一帧只挂一次，天然把多次事件合并成一次渲染。',
    action:
      '案例用时间戳驱动正弦往返动画，并对比 mousemove 直改和 rAF 节流：事件里只记最新坐标，rAF 回调里统一渲染，帧率和流畅度肉眼可见。',
    conclusion:
      '记住：动画和高频渲染都用 rAF，事件回调只负责「存值」。卸载时记得 cancelAnimationFrame，否则循环会在后台一直跑。',
  },
} satisfies CaseMeta
