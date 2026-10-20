// ============================================================
// 案例元数据：content-visibility 长列表
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'content-visibility',
  title: 'content-visibility 长列表',
  difficulty: 'advanced',
  tags: ['content-visibility', '渲染优化', '长列表'],
  summary: '3000 条卡片对比默认与跳过屏外渲染的耗时，自动测三次取中位数',
  sell: '长列表首屏又白又慢：跳过屏外内容渲染',
  explain: {
    situation:
      '后台管理页一次展示几千条日志卡片，打开页面白屏一阵，滚动也发涩；数据不能分页，必须一次给全。',
    background:
      '浏览器默认会把屏幕外的内容也参与排版和绘制。content-visibility 设为 auto 后，屏幕外的区块先跳过渲染，滚动到附近再补上；容器要配合 contain-intrinsic-size 给一个预估高度，滚动条才稳定。',
    action:
      '案例一次渲染 3000 条卡片，切换开关对比默认渲染与跳过屏外渲染。点「重测两种模式」会各跑三次，取中位数显示渲染耗时，同时显示节点数不变，说明省的是渲染工作而不是删数据。',
    conclusion:
      '记住：超长静态列表先用 content-visibility 跳过屏外渲染，并给容器预估高度；需要精确滚动位置或频繁测量时慎用。',
  },
} satisfies CaseMeta
