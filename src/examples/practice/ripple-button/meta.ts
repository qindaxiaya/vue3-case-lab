// ============================================================
// 案例元数据：水波纹按钮
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'ripple-button',
  title: '水波纹按钮',
  difficulty: 'beginner',
  tags: ['Web Animations API', '波纹', '交互细节'],
  summary: '点击点为圆心扩散，WAAPI 动画驱动、onfinish 自动回收节点，狂点零残留',
  sell: 'WAAPI 水波纹，onfinish 回收，狂点无残留',
  explain: {
    situation:
      '按钮点下去没反馈，你想加个从点击位置扩散的水波纹。结果连点几次，按钮上留下一堆 div，颜色越来越深。',
    background:
      '水波纹就是「以点击点为圆心、半径大到能盖住整块按钮」的圆。每次点击圆心都不同，用 WAAPI 的 element.animate 动态生成最省事；动画结束的回调里把节点删掉，才不会堆积。',
    action:
      '案例按点击坐标算圆心和到最远角的半径，用 WAAPI 播放扩散 + 淡出，onfinish 自动移除节点；可以连着狂点，也能调整颜色和时长。',
    conclusion:
      '记住：半径要覆盖最远角，动画结束一定清理 DOM。WAAPI 走合成层，比改 left/top 流畅得多。',
  },
} satisfies CaseMeta
