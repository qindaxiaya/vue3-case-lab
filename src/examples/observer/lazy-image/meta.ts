// ============================================================
// 案例元数据：IntersectionObserver 图片懒加载
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'lazy-image',
  title: 'IntersectionObserver 图片懒加载',
  difficulty: 'intermediate',
  tags: ['IntersectionObserver', '懒加载', '曝光'],
  summary: '三种观察参数对比，进入可视区域才加载，加载后立即停止观察',
  sell: '三参数调好懒加载，进视口才下载，用完即释放',
  explain: {
    situation:
      '商品列表一页 100 张图，打开页面所有图片一起下载，转圈半天，流量一下跑掉几十兆；改成监听滚动判断，页面又变得很卡。',
    background:
      '图片只有在 img 标签真正拿到地址时才会开始下载。所以可以把真实地址先放在自定义属性 data-src 里，等图片快要进入屏幕时再赋给 src。判断「有没有进入屏幕」用交叉观察器（IntersectionObserver）：它由浏览器在后台计算，不会像滚动回调那样频繁打扰页面。',
    action:
      '案例给每张图片一个占位块，真实地址写在 data-src。创建交叉观察器时设置提前量，图片距离可视区域还有一段距离就开始加载；回调里判断 isIntersecting，为真时把 data-src 的值赋给 src，然后立刻调用 unobserve 停止观察这张图，避免重复触发；组件卸载时调用 disconnect 释放观察器。',
    conclusion:
      '记住：懒加载 = 先占位 + 快进入屏幕再给真实地址 + 加载后停止观察。浏览器原生 loading="lazy" 也能做，需要精确控制提前量时再用交叉观察器。',
  },
} satisfies CaseMeta
