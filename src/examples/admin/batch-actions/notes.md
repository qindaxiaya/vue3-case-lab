# BatchActions：表格批量操作别漏掉半选

## 1. 现象 / 场景

后台表格勾选几行后，表头复选框没有半选状态；批量执行时按钮还能继续点，连点两次发了两个请求；执行完选择没清，用户以为还要再点一次。

复现步骤：

1. 勾选前两行，表头复选框应显示半选，而不是空。
2. 点表头全选，8 行全部选中，再点一次取消。
3. 全选后执行「批量停用」，执行中按钮锁定，结束后选择清零。
4. 再勾选三行执行「批量启用」，只有这三行变回启用。

## 2. 原理

全选、半选、单选是三种状态，不是两个布尔值。表头复选框要同时表达「全选 / 部分选中 / 未选」，所以不能只存一个 `allChecked`。

选择集合用行 id 存，而不是行对象：列表刷新后对象引用会变，id 不会；批量接口返回成功 id 时，也正好能从集合里移除。

批量按钮需要执行锁。只禁用按钮不够，函数入口还要再判断一次 `busy`，否则键盘回车或脚本仍可能触发第二次请求。

## 3. 方案：关键代码

```ts
//! 选择用 id 集合存：行数据刷新后对象引用会变，id 不会
const selectedIds = ref<number[]>([])
const busy = ref(false)

function toggleAll(checked: boolean): void {
  selectedIds.value = checked ? rows.value.map((row) => row.id) : []
}

//! 表头三态：全选 / 半选 / 未选
const allChecked = computed(
  () => rows.value.length > 0 && selectedIds.value.length === rows.value.length,
)
const indeterminate = computed(
  () => selectedIds.value.length > 0 && selectedIds.value.length < rows.value.length,
)

//! 执行中直接 return，成功后清空选择
function runBatch(action: Status): void {
  if (busy.value || selectedIds.value.length === 0) return
  const ids = [...selectedIds.value]
  busy.value = true

  actionTimer = window.setTimeout(() => {
    rows.value = rows.value.map((row) =>
      ids.includes(row.id) ? { ...row, status: action } : row,
    )
    selectedIds.value = []
    busy.value = false
    actionTimer = null
  }, 450)
}
```

三处关键选择：

1. `selectedIds` 而不是行对象：刷新列表后 id 仍能对上。
2. `indeterminate` 单独算：它和 `allChecked` 不是互斥的布尔值。
3. 成功后清空选择；如果接口部分失败，应只移除成功 id，失败项保留。

## 4. 数据对比

| 操作 | 选中数 | 启用 / 停用 | 测量方式 |
| --- | --- | --- | --- |
| 初始 | 0 | 4 / 4 | 页面 data-stat 读数 |
| 勾选前两行 | 2 | 4 / 4 | 表头显示半选 |
| 表头全选 | 8 | 4 / 4 | 表头显示全选 |
| 批量停用 8 项 | 0 | 0 / 8 | 批量操作计数 +1 |
| 勾选 3 行并批量启用 | 0 | 3 / 5 | 同上 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/batch-actions`。
- 取样：`npm run check:ui -- --only 批量` 的常驻场景。
- 450ms 是 Demo 固定的模拟接口延迟，不是接口性能结论。

## 5. 追问与边界（面试高频）

- Q: 为什么不用 `allChecked` 一个布尔值？ → A: 它表达不了「部分选中」，表头会少一个半选态，用户不知道当前是全选还是只选了几行。
- Q: 全选要不要包含其他页？ → A: 默认只全选当前页；跨页全选要单独设计「选择全部 N 项」并明确取消入口，否则用户不知道自己选了多少。
- Q: 批量接口部分失败怎么办？ → A: 成功 id 移出选择、失败 id 保留并提示原因，不要一上来就清空全部选择。

踩坑（≤3 条）：

1. 只禁用按钮、函数入口不判断：回车或脚本仍能触发第二次 → 入口补 `if (busy.value) return`。
2. 用行对象存选择：列表刷新后引用变了，勾选状态丢失 → 改存 id。
3. 执行成功就清空全部选择：部分失败时用户得重新找失败项 → 按成功 id 精确移除。

边界：跨页选择、服务端全选、批量操作进度条都不在本例范围；数据量很大时选择集合要用 `Set`，并考虑只存 id 不存整行。
