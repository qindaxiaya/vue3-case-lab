// ============================================================
// 案例元数据：埋点 SDK
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'tracking-sdk',
  title: '埋点 SDK（点击 + 曝光）',
  difficulty: 'advanced',
  tags: ['埋点', '事件委托', 'IntersectionObserver', 'sendBeacon'],
  summary: '用事件委托收点击、观察器收曝光并去重，满五条或两秒批量上报，减少请求',
  sell: '埋点逐条上报浪费请求：点击曝光批量收集',
  explain: {
    situation:
      '产品要统计哪些按钮被点了、哪些商品曝光了。你给每个元素单独绑点击事件，代码里遍地埋点，漏一个就少一份数据。',
    background:
      '点击可以用事件委托：在根节点监听一次，用 closest 往上找最近的 data-track 标记。曝光用交叉观察器，进入可视区域才算，而且同一元素只算一次。上报别一条一个请求，攒够数量或等 2 秒批量发。',
    action:
      '案例在 document 上用捕获阶段监听点击，避免业务代码阻止冒泡导致漏报；找到带 data-track 的元素就记录事件名。曝光用交叉观察器观察所有标记元素，进入视口时把元素 id 放进已曝光集合去重。上报队列满 5 条或等 2 秒时批量发送，页面关闭时用 sendBeacon 兜底。',
    conclusion:
      '记住：埋点 = 委托 + 去重 + 批量 + 兜底。用 data-track 声明式标记，别在每个组件里手写上报。',
  },
} satisfies CaseMeta
