# FormDependency：隐藏的字段也要清空

## 1. 现象 / 场景

发票表单切到「个人」后，企业名称和税号被隐藏了，但值还留在表单里；提交时校验又把隐藏字段算进去，用户明明看不到，却一直提示「企业名称必填」。配送方式切到自提后，地址没清空，提交时又把旧地址带上去了。

复现步骤：

1. 打开案例，默认个人 / 快递：企业字段 0 个、地址 1 个、自提点 0 个、清空计数 0。
2. 切到企业，企业字段变成 2 个；填入企业名称和税号。
3. 切回个人，企业字段隐藏，清空计数变成 2。
4. 切到自提，地址隐藏、自提点显示，清空计数变成 3。
5. 清空购买人后提交，错误 1 条，状态提示「购买人为必填项」。
6. 填回购买人再提交，错误 0 条，状态「提交成功」。
7. 点重置，回到个人 / 快递、清空计数 0、状态「待填写」。

## 2. 原理

表单联动不只是显示和隐藏，还要处理两件事：隐藏字段的值要不要清、校验规则要不要跟着变。

隐藏但保留值，提交时可能把旧企业信息带上去；用户切回个人后以为企业信息已经没了，实际数据还在。隐藏字段继续参与校验，用户又看不到、改不了，只能卡在提交按钮前。正确做法是：切换时清空被隐藏的字段，提交时只校验当前可见的必填项。

清空计数不是给用户看的业务字段，而是演示用的可核对指标。每次真正清掉一个有值的字段就加一，测试和 review 都能确认「到底清了几个字段」，避免只隐藏、没清值。

## 3. 方案：关键代码

```ts
//! 显隐是派生状态，模板只读 isCompany / isExpress，不手写 v-if 条件
const isCompany = computed(() => form.invoiceType === 'company')
const isExpress = computed(() => form.deliveryType === 'express')
const visibleCompanyCount = computed(() => (isCompany.value ? 2 : 0))

//! 切换类型时清空被隐藏的字段，只清真正有值的，清空计数才准确
function clearCompanyFields(): void {
  if (form.companyName.trim()) {
    form.companyName = ''
    clearedCount.value += 1
  }
  if (form.taxNo.trim()) {
    form.taxNo = ''
    clearedCount.value += 1
  }
}

function setInvoiceType(value: string | number | boolean | undefined): void {
  if (value !== 'personal' && value !== 'company') return
  if (form.invoiceType === value) return
  form.invoiceType = value
  if (value === 'personal') clearCompanyFields()
  resetFeedback()
}

//! 只校验当前可见的字段：隐藏字段即使为空也不该拦住提交
function validate(): string[] {
  const errors: string[] = []
  if (!form.buyer.trim()) errors.push('购买人为必填项')

  if (isCompany.value) {
    if (!form.companyName.trim()) errors.push('企业名称为必填项')
    if (!form.taxNo.trim()) errors.push('税号为必填项')
  }

  if (isExpress.value) {
    if (!form.address.trim()) errors.push('收货地址为必填项')
  } else if (!form.pickupPoint.trim()) {
    errors.push('自提点为必填项')
  }

  return errors
}
```

三处关键选择：

1. 显隐用 `isCompany` / `isExpress` 派生，模板和校验共用同一份判断，不会出现「显示了但没校验」。
2. 清空依赖字段放在 `setInvoiceType` / `setDeliveryType` 里，只清有值的字段，并累计 `clearedCount`。
3. `validate` 只遍历当前可见字段，提交结果里的 `errorCount` 和 `statusText` 都来自同一份错误数组。

## 4. 数据对比

| 操作 | 企业字段 | 地址 | 自提点 | 错误 | 已清空 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 初始（个人 / 快递） | 0 | 1 | 0 | 0 | 0 | 待填写 |
| 切企业 | 2 | 1 | 0 | 0 | 0 | 待填写 |
| 填企业信息后切回个人 | 0 | 1 | 0 | 0 | 2 | 待填写 |
| 切自提 | 0 | 0 | 1 | 0 | 3 | 待填写 |
| 清空购买人后提交 | 0 | 0 | 1 | 1 | 3 | 购买人为必填项 |
| 补购买人后提交 | 0 | 0 | 1 | 0 | 3 | 提交成功 |
| 重置 | 0 | 1 | 0 | 0 | 0 | 待填写 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/form-dependency`。
- 取样：`npm run check:ui -- --only 表单联动` 的常驻场景，同一页面顺序执行。
- 口径：企业字段、地址、自提点、错误、已清空、状态都读页面 `data-stat`；输入框用原生 `input` 事件写入。

## 5. 追问与边界（面试高频）

- Q: 隐藏字段为什么一定要清空？ → A: 不清空会把用户看不到的旧值一起提交；切回个人后企业信息还在，既不符合预期，也可能带错数据。
- Q: 隐藏字段还要不要校验？ → A: 不校验。用户看不到也改不了，校验只会让提交永远失败；只校验当前可见的必填项。
- Q: 清空计数有什么意义？ → A: 它是可核对指标，确认切换时到底清了几个字段；真实项目不会展示给用户，但测试和排查很有用。
- Q: 联动规则多了怎么维护？ → A: 把显隐、清空、校验都收在类型切换函数和 `validate` 里，不要散落在模板的 `v-if` 和按钮事件里。

踩坑（≤3 条）：

1. 只隐藏不清值：切回个人后企业信息还在表单里，提交时被带上去 → 切换时清空依赖字段。
2. 校验所有字段：隐藏的企业名称 / 税号为空，个人用户永远提交不了 → 只校验可见字段。
3. 空切换也累加清空计数：没填过企业信息，切来切去计数一直涨 → 只清真正有值的字段。

边界：本例是前端内存表单，没有后端字段级校验和草稿保存；真实项目切回旧类型时可能还要恢复上次输入，或者把隐藏字段保留在草稿里但不参与提交，需要按业务决定。
