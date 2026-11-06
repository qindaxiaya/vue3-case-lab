// ============================================================
// 案例元数据：useMediaQuery 断点判断
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'use-media-query',
  title: 'useMediaQuery：断点判断交给浏览器',
  difficulty: 'intermediate',
  tags: ['组合式函数', 'matchMedia', '断点', '自动清理'],
  summary: '窗口一拖就重算断点；改用媒体查询的 change 事件，只在跨断点时更新',
  sell: '窗口缩放别自己算断点，matchMedia 跨断点才回调',
  explain: {
    situation:
      '你在页面里写 window.innerWidth < 768 判断手机端，用户拖动窗口时断点会来回闪；换一个页面又要复制一遍，还得记着卸载时移除监听。',
    background:
      '浏览器缩放窗口时会连续触发很多次 resize 事件，每次都让页面自己读宽度、比较几档断点。媒体查询（matchMedia）由浏览器维护「是否匹配」，只有匹配结果真的翻转时才通知你，中间的连续缩放它不打扰页面。',
    action:
      '案例把订阅封装成 useMediaQuery(query)：挂载时同步初始值并监听 change，组件卸载自动解绑。页面里用两条查询（≥768 / ≥1024）拼出移动 / 平板 / 桌面三档，并排显示两种写法的回调次数。',
    conclusion:
      '记住：问「条件成不成立」用媒体查询，问「尺寸具体是多少」才读宽度。跨断点才需要的逻辑交给浏览器通知，页面就不用陪着每一次缩放白算。',
  },
} satisfies CaseMeta
