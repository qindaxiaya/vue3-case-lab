# EditableBatchSave：可编辑表格别改一格存一次

## 1. 现象 / 场景

后台表格里改价格，改一个字符就发一次保存请求；网络慢时请求排队，改到一半失败，表格已经显示「已保存」，刷新后才发现没存上。

复现步骤：

1. 默认「批量保存」，依次改第 1 行名称、第 2 行价格、第 3 行价格：待保存 3，保存次数仍 0。
2. 点保存全部：保存次数 +3，第 3 行失败保留，待保存剩 1。
3. 再点一次保存全部：只重试第 3 行，保存次数 +1，仍然失败。
4. 点重置：数据与计数都回初始值。
5. 切「即时保存」再改一格：保存次数立刻 +1，待保存为 0。

## 2. 原理

可编辑表格要把「编辑」和「保存」分开：输入时只标脏，点保存时把所有脏行一起提交。这样用户连续改多个字段只产生一次提交，不会每敲一个字符就发请求。

提交结果要逐行回写：成功的清脏，失败的保留脏标记并提示。失败行如果被清脏，用户会以为已经保存；保留脏标记，用户改完还能再点保存重试。

## 3. 方案：关键代码

```ts
function onEdit(row: EditableRow, field: Field, value: string | number): void {
  if (field === 'name') {
    row.name = String(value)
  } else {
    row.amount = Number(value) || 0
  }
  row.dirty = true
  row.failed = false

  if (mode.value === 'instant') {
    //! 即时保存：每改一格就发一次请求，表格里立刻变干净
    saveCount.value++
    row.dirty = false
    statusText.value = '已保存'
  } else {
    statusText.value = '有未保存修改'
  }
}

function saveAll(): void {
  const pending = rows.value.filter((row) => row.dirty)
  if (!pending.length) {
    statusText.value = '没有待保存修改'
    return
  }

  saveCount.value += pending.length
  let failed = 0
  for (const row of pending) {
    if (row.id === 3) {
      //! 失败行保留脏标记，用户改完还能再点保存
      row.failed = true
      failed++
      continue
    }
    row.dirty = false
    row.failed = false
  }

  statusText.value = failed ? `${failed} 行保存失败，已保留` : '全部保存成功'
}
```

三处关键选择：

1. 编辑只改 `dirty`，不发请求；保存才遍历 `rows`。
2. 失败行不清 `dirty`，只加 `failed`，重试时仍会被选中。
3. `saveCount` 按尝试保存的行数累加，能直接看出即时保存与批量保存的请求差。

## 4. 数据对比

| 操作 | 待保存 | 保存次数 | 失败行 | 状态 | 测量方式 |
| --- | --- | --- | --- | --- | --- |
| 初始 | 0 | 0 | 0 | 待修改 | 页面 data-stat 读数 |
| 批量改 3 格 | 3 | 0 | 0 | 有未保存修改 | 同上 |
| 首次保存全部 | 1 | 3 | 1 | 1 行保存失败，已保留 | 同上 |
| 再点保存全部 | 1 | 4 | 1 | 1 行保存失败，已保留 | 同上 |
| 重置 | 0 | 0 | 0 | 待修改 | 同上 |
| 即时保存改 1 格 | 0 | 1 | 0 | 已保存 | 同上 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/editable-batch-save`。
- 取样：`npm run check:ui -- --only 可编辑表格批量` 的常驻场景，同一页面顺序操作。
- 第 3 行固定失败是 Demo 设定，用来演示失败行保留；真实项目失败原因来自接口。

## 5. 追问与边界（面试高频）

- Q: 批量保存要不要做并发控制？ → A: 要。保存中禁用按钮，或给每次提交一个 token，避免连点产生重复请求。
- Q: 失败行怎么提示？ → A: 行级状态 + 顶部汇总都要有；只弹一个全局 toast，用户不知道哪一行失败。
- Q: 即时保存和批量保存怎么选？ → A: 字段少、改动独立用即时保存；一行多字段、需要一起校验用批量保存。

踩坑（≤3 条）：

1. 失败也清脏：用户以为保存成功，刷新后数据丢失 → 失败保留 `dirty`。
2. 保存中不禁用按钮：连点会重复提交 → 加保存中状态。
3. 只提示全局失败：用户找不到哪一行 → 行级 `failed` 标记。

边界：真实项目还要处理「保存期间用户继续编辑」：提交时记录每行的版本号，返回后只清对应版本的脏标记，避免把新改动误清掉。
