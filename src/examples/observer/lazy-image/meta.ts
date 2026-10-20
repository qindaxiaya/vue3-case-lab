// ============================================================
// 案例元数据：IntersectionObserver 图片懒加载
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'lazy-image',
  title: 'IntersectionObserver 图片懒加载',
  difficulty: 'intermediate',
  tags: ['IntersectionObserver', '懒加载', '曝光'],
  summary: 'root/rootMargin/threshold 三配置对比，进入视口才加载，用完 unobserve 释放',
  sell: '三参数调好懒加载，进视口才下载，用完即释放',
  explain: {
    situation:
      '商品列表一页 100 张图，打开页面全在转圈，流量一下跑掉几十兆；换成滚动监听判断，页面又卡了。',
    background:
      '图片只有真正设置 src 时浏览器才会下载。只要把真实地址先放在 data-src，等它快进入视口时再赋给 src，就能「用到才下载」。IntersectionObserver 正好负责判断「进没进视口」。',
    action:
      '案例用 IO 观察图片，rootMargin 提前一点加载，进入视口才把 data-src 搬到 src；加载成功后立刻 unobserve，卸载时 disconnect，三种参数组合都能现场调。',
    conclusion:
      '记住：懒加载 = data-src + 进视口再赋值 + 用完释放。真实项目直接用原生 loading="lazy" 也行，需要精确控制再用 IO。',
  },
} satisfies CaseMeta
