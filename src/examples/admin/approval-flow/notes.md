# ApprovalFlow：审批流别只改一个状态

## 1. 现象 / 场景

审批功能最早只有一个「通过 / 驳回」按钮，谁点都生效。加上财务复核后，主管可以直接替财务点通过；再想看审批过程，发现只存了一个状态字段，谁在什么时候改的完全查不到。

复现步骤：

1. 打开案例，默认角色是主管，状态「待审批」、步骤「主管审批」、时间线 1 条。
2. 主管点「通过」，步骤变成「财务审批」，时间线追加一条。
3. 切到财务角色再点「通过」，状态变成「已通过」、步骤「完成」，时间线 3 条。
4. 重置后主管点「驳回」，状态「已驳回」，通过按钮立即禁用，再点也不会改变状态。
5. 重置后主管点「转交财务」，步骤到财务，但主管的通过按钮变灰；切到财务角色后才能继续。

## 2. 原理

审批流是一个状态机。当前状态回答「申请处于什么阶段」，当前步骤回答「现在轮到谁」，当前角色回答「操作人是谁」。三者必须一起变化，只改一个就会出现「已通过但还停在主管审批」「主管替财务点通过」这类错位。

操作入口只认状态机：函数内部先判断状态、步骤、角色，条件不满足直接返回；按钮上的禁用只是提示，不能当作唯一防线。每次成功操作追加一条时间线，而不是覆盖状态，这样审批过程才可追溯。

驳回和通过是两条不同的出口：驳回直接把状态改成已驳回，步骤不再推进；通过则要看当前在哪一步，主管通过只推进步骤，财务通过才结束流程。

## 3. 方案：关键代码

```ts
//! 通过和驳回都只允许当前步骤对应的角色操作，避免主管替财务点通过
const canApprove = computed(() => {
  if (application.value.status !== 'pending') return false
  if (application.value.step === 'manager') return currentRole.value === 'manager'
  if (application.value.step === 'finance') return currentRole.value === 'finance'
  return false
})

const canTransfer = computed(
  () =>
    application.value.status === 'pending' &&
    application.value.step === 'manager' &&
    currentRole.value === 'manager',
)

function approve(): void {
  if (!canApprove.value) return
  if (application.value.step === 'manager') {
    application.value.step = 'finance'
    pushHistory(roleLabel.value, '通过', '转交财务审批')
    return
  }
  if (application.value.step === 'finance') {
    application.value.status = 'approved'
    application.value.step = 'done'
    pushHistory(roleLabel.value, '通过', '审批完成')
  }
}

//! 每次成功操作只追加一条历史，并累计操作次数
function pushHistory(actor: string, action: string, note: string): void {
  application.value.history.push({ actor, action, note })
  actionCount.value += 1
}
```

三处关键选择：

1. 状态迁移表写在 `approve` 里：主管通过只改步骤，财务通过才改状态，两个出口不混在一起。
2. 权限判断用 `canApprove` / `canTransfer` 两个派生值，模板禁用和函数内部判断共用同一份规则。
3. 时间线只追加不覆盖，`createApplication` 每次重置都新建数组，避免旧记录被继续追加。

## 4. 数据对比

| 操作 | 状态 | 步骤 | 时间线条数 | 通过按钮 |
| --- | --- | --- | --- | --- |
| 初始 | 待审批 | 主管审批 | 1 | 可用（主管） |
| 主管通过 | 待审批 | 财务审批 | 2 | 禁用（主管） |
| 财务通过 | 已通过 | 完成 | 3 | 禁用 |
| 重置 | 待审批 | 主管审批 | 1 | 可用（主管） |
| 主管驳回 | 已驳回 | 主管审批 | 2 | 禁用 |
| 主管转交 | 待审批 | 财务审批 | 2 | 禁用（主管） |
| 财务通过 | 已通过 | 完成 | 3 | 禁用 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/approval-flow`。
- 取样：`npm run check:ui -- --only 审批流` 的常驻场景，同一页面顺序执行。
- 口径：状态、步骤、当前角色、时间线条数都读页面 `data-stat`；按钮是否可用读 `disabled` 属性。

## 5. 追问与边界（面试高频）

- Q: 为什么不能只存一个状态字段？ → A: 状态只能回答「结束没有」，回答不了「现在轮到谁」；步骤和角色是审批继续推进的必要信息。
- Q: 按钮已经禁用了，函数里还要判断吗？ → A: 要。按钮禁用只是界面提示，快捷键、脚本、后续复用都可能绕过；状态机判断必须在函数入口。
- Q: 驳回后还能重新提交吗？ → A: 本例把驳回当作终点，操作全部锁定；真实项目可以增加「撤回 / 重新提交」出口，但必须是一个新的明确状态迁移。
- Q: 转交和通过有什么区别？ → A: 通过是审批意见，转交只是换处理人；本例转交只推进步骤，不改变状态，时间线记录动作与原因。

踩坑（≤3 条）：

1. 只改状态不改步骤：财务通过后状态是已通过，步骤还停在主管审批 → 状态和步骤要一起迁移。
2. 用按钮禁用代替权限判断：主管在财务步骤仍能通过 → 函数内部再判断一次角色和步骤。
3. 重置时复用旧数组：上一次的时间线还在，重置后历史条数对不上 → 重置新建申请对象。

边界：本例只做单人审批链，没有会签、或签、加签、撤回；真实项目通常把状态迁移表抽成配置，并把每次操作写入后端审计日志，而不是只存在页面内存里。
