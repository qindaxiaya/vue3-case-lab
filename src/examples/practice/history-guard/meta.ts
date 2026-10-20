// ============================================================
// 案例元数据：History 拦截返回
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'history-guard',
  title: 'History 拦截返回',
  difficulty: 'advanced',
  tags: ['history', 'popstate', '路由守卫', 'beforeunload'],
  summary: '有未保存内容时拦截返回：确认/取消状态机 + 日志，附 onBeforeRouteLeave 与 popstate 真实方案',
  sell: '未保存就拦截返回，确认/取消状态机可复用',
  explain: {
    situation:
      '用户填了半页表单，手一滑点了浏览器返回，内容全没了。你想弹窗问「确定离开吗」，可 window.confirm 又丑又拦不住。',
    background:
      '返回会触发 popstate，但你没法取消它。常见做法是进入页面时先 push 一条「哨兵」记录，用户返回时被哨兵接住，再决定放行还是把历史顶回去；用 Vue Router 时则写 onBeforeRouteLeave。',
    action:
      '案例实现确认/取消状态机：有未保存内容时返回先弹自定义确认框，取消就再 pushState 顶回去，确认才真正离开，日志能看清每一步。',
    conclusion:
      '记住：拦截返回 = 哨兵 + popstate + 顶回历史。现代浏览器不支持自定义提示文案；真实项目优先用路由守卫。',
  },
} satisfies CaseMeta
