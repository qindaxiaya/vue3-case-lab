# 可编辑表格 + 行内校验

## 1. 现象与场景

双击进入编辑，按 Esc 想取消，结果失焦又触发保存；价格输入空串，`Number('') === 0` 被当成合法值；校验失败输入直接丢了。

复现：双击单元格编辑，Enter 保存、Esc 取消、失焦保存；输入非法值观察拦截计数与红框。

## 2. 原理

编辑状态是一个小型状态机：`editing = { id, field }`、`draft` 保存草稿、`original` 保存原值。同一时间只允许一个格子编辑，避免多格校验与提交互相打架。

失焦保存前必须判断「是否还在编辑」——Esc 会先清状态，若失焦回调不判断就会二次提交。校验要区分空串与 0：`Number('')` 是 0，必须先判空。失败时保持编辑态、标红、重新聚焦，不要丢弃输入。

## 3. 关键代码

```ts
const editing = ref<{ id: number; field: EditableField } | null>(null)
const draft = ref('')

function commit(row: Row, field: EditableField): boolean {
  const raw = draft.value.trim()
  if (field === 'name' && !raw) return fail('名称不能为空')
  if (field !== 'name') {
    const num = Number(raw)
    // 1. Number('') === 0，空串必须单独拦
    if (!raw || !Number.isFinite(num)) return fail('请输入数字')
    if (field === 'price' && num <= 0) return fail('价格必须大于 0')
    if (field === 'stock' && (!Number.isInteger(num) || num < 0)) return fail('库存必须是非负整数')
    row[field] = num
  } else {
    row.name = raw
  }
  editing.value = null
  return true
}

function onBlur(row: Row, field: EditableField): void {
  // 2. 先判断是否还在编辑，避免 Esc 后误提交
  if (!isEditing(row, field)) return
  commit(row, field)
}
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 初始行数 | 4 |
| 编辑字段 | 名称 / 价格 / 库存 |
| 校验规则 | 3 类（非空、正数、非负整数） |
| 初始统计 | 编辑 0 · 保存 0 · 拦截 0 |
| 提交时机 | Enter / 失焦；Esc 取消 |

测量方式：Chrome headless 1200×900 双击单元格，分别输入合法/非法值，读取「编辑 / 保存 / 拦截」计数与红框；规则来自 Demo 校验逻辑。

## 5. 追问与边界

**Q：为什么 Esc 后还会保存？**
`keydown.esc` 清状态后输入框失焦，`blur` 又触发 commit；必须在 blur 里判断 `isEditing`。

**Q：校验失败为什么不退出编辑？**
退出会丢输入；保持编辑态 + 红框 + 重新聚焦，用户才能改。

**Q：大表格怎么优化？**
逐格 ref 占内存，用事件委托 + `data-row/data-field`；上千行配虚拟滚动。

坑：服务端保存失败要把单元格回滚到旧值，保存前备份 original。边界：移动端没有 dblclick，用单击/长按进入编辑；删除正在编辑的行要清 editing，避免悬空引用。
