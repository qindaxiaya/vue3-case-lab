// ============================================================
// 案例元数据：BatchDeleteUndo 批量删除撤销
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'batch-delete-undo',
  title: 'BatchDeleteUndo：删错了要能撤回来',
  difficulty: 'intermediate',
  tags: ['后台', '表格', '删除', '撤销'],
  summary: '删除保存快照，撤销按原顺序恢复，超时不可再撤',
  sell: '批量删除先移除再给 3 秒撤销窗口',
  explain: {
    situation:
      '后台批量删除点完就没了，用户手滑多选一行只能重新建；有的产品给了撤销，但撤销回来顺序全乱，或者倒计时结束了按钮还能点。',
    background:
      '撤销删除不是把接口再调一次「恢复」，而是在删除时先保存被删行和原位置，界面上立即移除，撤销时按快照插回去。窗口到期只收掉撤销入口，数据已经删了，不应该再假装能恢复。',
    action:
      '案例用 pending 记录本批 id 与过期时间，用 removedRows 记录每行在原数组里的索引；删除后启动 100ms 倒计时刷新剩余秒数，撤销按索引升序插回，到期只清空 pending。',
    conclusion:
      '记住：撤销删除 = 快照 + 过期时间 + 原位置。再次删除要先结束上一批，卸载时清掉定时器。',
  },
} satisfies CaseMeta
