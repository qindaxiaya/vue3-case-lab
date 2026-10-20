// ============================================================
// 案例元数据：埋点 SDK
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'tracking-sdk',
  title: '埋点 SDK（点击 + 曝光）',
  difficulty: 'advanced',
  tags: ['埋点', '事件委托', 'IntersectionObserver', 'sendBeacon'],
  summary: 'data-track 事件委托收点击、IO 收曝光（去重）、批量队列满 5 或 2s 上报，批次日志可见',
  sell: '点击与曝光自动采集，批量上报不丢事件',
  explain: {
    situation:
      '产品要统计哪些按钮被点了、哪些商品曝光了。你给每个元素单独绑 onClick，代码里遍地埋点，漏一个就少一份数据。',
    background:
      '点击可以用事件委托：在根节点监听一次，用 closest 往上找最近的 data-track。曝光用 IntersectionObserver，进入视口才算，而且同一元素只算一次。上报别一条一个请求，攒够数量或等 2 秒批量发。',
    action:
      '案例实现点击 + 曝光自动采集、按元素去重、批量队列（满 5 条或 2 秒）、批次日志可见；页面关闭或跳转时用 sendBeacon 兜底。',
    conclusion:
      '记住：埋点 = 委托 + 去重 + 批量 + 兜底。用 data-track 声明式标记，别在每个组件里手写上报。',
  },
} satisfies CaseMeta
