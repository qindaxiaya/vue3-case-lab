// ============================================================
// 案例元数据：无限滚动加载
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'infinite-scroll',
  title: '无限滚动加载',
  difficulty: 'intermediate',
  tags: ['IntersectionObserver', '分页', '哨兵元素'],
  summary: '哨兵进底部 200px 预取下一页，rootMargin 单向扩展，loading 防重入',
  sell: '哨兵 + rootMargin 预取，滚动加载零回调',
  explain: {
    situation:
      '列表滑到底要自动加载下一页。你监听 scroll 算距离，结果手一抖连发好几个请求，数据重复，滚动还越来越卡。',
    background:
      'scroll 事件非常频繁，滚到底部的每一像素都会触发；而 IntersectionObserver 只需要盯着列表末尾放一个「哨兵」元素，它进入视口时通知你一次，不用自己算位置。',
    action:
      '案例在底部放哨兵，rootMargin 向下扩 200px，用户快到底时提前预取；再用 loading 门闩保证同一时间只有一个请求，加载失败可以重试，组件卸载时 disconnect。',
    conclusion:
      '记住：无限滚动 = 哨兵 + 提前量 + 防重入。别再用 scroll 里算 scrollTop，IntersectionObserver 更准也更省。',
  },
} satisfies CaseMeta
