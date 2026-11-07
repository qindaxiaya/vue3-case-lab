// ============================================================
// 案例元数据：ConfirmAction Promise 式确认框
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'confirm-action',
  title: 'ConfirmAction：确认框要能等异步结果',
  difficulty: 'intermediate',
  tags: ['后台', '确认框', 'Promise', '异步'],
  summary: '确认、loading、失败不关闭，一个 Promise 搞定',
  sell: '确认框要等异步结果，失败别关',
  explain: {
    situation:
      '后台点删除，弹一个确认框，点确认后接口还在转，框已经关了；请求失败只能再弹一次 toast，用户得重新找那条数据。原生 confirm 又会阻塞页面，连 loading 都做不了。',
    background:
      '确认框分两段：用户确认前是「问一句」，确认后是「等结果」。很多实现把确认和请求拆在两个地方，框一关就丢了上下文；Promise 式确认框把「等用户」和「等接口」接在同一段代码里。',
    action:
      '案例实现 confirm(options)：打开时返回 Promise，点取消 resolve(false)；点确认先进入 loading，await options.task() 成功才关闭并 resolve(true)，失败留在框里显示错误，用户可以原地点重试。',
    conclusion:
      '记住：确认框要等异步结果。取消、成功、失败三种出口都要结算 Promise；失败不要关框，让用户能重试。',
  },
} satisfies CaseMeta
