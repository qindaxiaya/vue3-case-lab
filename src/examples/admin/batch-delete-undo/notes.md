# BatchDeleteUndo：删错了要能撤回来

## 1. 现象 / 场景

后台批量删除点完就没了，用户手滑多选一行只能重新建；有的产品给了撤销，但撤销回来顺序全乱，或者倒计时结束了按钮还能点。

复现步骤：

1. 勾选 2 行，点「删除所选」，列表从 8 行变成 6 行，底部出现撤销条。
2. 撤销条显示「已删除 2 条」和剩余秒数，点「撤销删除」后恢复成 8 行。
3. 再勾 1 行删除，列表剩 7 行；等 3 秒倒计时结束，撤销条消失，不能再撤。
4. 点「重置」，列表回到 8 行、已选清零。

## 2. 原理

撤销删除不是把接口再调一次「恢复」，而是在删除时先保存被删行和原位置。界面上立即移除，用户看到删除已生效；撤销时按快照插回去，顺序才不会乱。

窗口到期只收掉撤销入口。数据已经删了，继续保留按钮会让用户以为还能恢复，点下去却失败。

再次删除要先结束上一批：上一批已经过期或用户放弃，不能让两个撤销条同时存在。

## 3. 方案：关键代码

```ts
const UNDO_MS = 3000

/**! 待撤销批次只存 id、过期时间，真正恢复顺序靠 removedRows 里的原索引 */
const pending = ref<PendingDelete | null>(null)
const removedRows = ref<RemovedRow[]>([])
const remaining = ref(0)

/**! 删除时记下原索引，撤销才能插回原来的位置 */
function deleteSelected(): void {
  if (selectedIds.value.size === 0) return
  if (pending.value) finalizePending()

  const snapshot: RemovedRow[] = []
  rows.value.forEach((row, index) => {
    if (selectedIds.value.has(row.id)) snapshot.push({ row, index })
  })

  const expiresAt = Date.now() + UNDO_MS
  rows.value = rows.value.filter((row) => !selectedIds.value.has(row.id))
  removedRows.value = snapshot
  pending.value = { ids: [...selectedIds.value], expiresAt }
  selectedIds.value = new Set()
  remaining.value = Math.ceil(UNDO_MS / 1000)
  startCountdown(expiresAt)
}

/** 按原索引升序插回，多行删除也能恢复成删除前的顺序 */
function undoDelete(): void {
  if (!pending.value) return
  const snapshot = [...removedRows.value].sort((a, b) => a.index - b.index)
  snapshot.forEach(({ row, index }) => {
    rows.value.splice(index, 0, row)
  })
  finalizePending()
}
```

三处关键选择：

1. 快照与过期时间一起存：撤销时既知道恢复哪些行，也知道窗口还在不在。
2. 恢复按原索引升序插入：先插前面的位置，后面的索引才不会被挤偏。
3. 卸载时清定时器：否则回调会去改已经销毁的页面状态。

## 4. 数据对比

| 操作 | 行数 | 已选 | 撤销条 | 剩余秒数 | 测量方式 |
| --- | --- | --- | --- | --- | --- |
| 初始 | 8 | 0 | 无 | 0 | 页面 `data-stat` 读数 |
| 勾选 2 行 | 8 | 2 | 无 | 0 | 同上 |
| 删除所选 | 6 | 0 | 有，2 条 | 1~3 | 倒计时从 3 开始 |
| 撤销删除 | 8 | 0 | 无 | 0 | 原顺序恢复 |
| 再删 1 行 | 7 | 0 | 有，1 条 | 1~3 | 同上 |
| 等待 3400ms | 7 | 0 | 无 | 0 | 到期只收入口 |
| 重置 | 8 | 0 | 无 | 0 | 数据恢复 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/batch-delete-undo`。
- 取样：npm run check:ui -- --base http://localhost:5174 --only 批量删除 的常驻场景。
- 3400ms 是场景等待时间，比 3000ms 窗口多留 400ms，避免定时器边界抖动。

## 5. 追问与边界（面试高频）

- Q: 撤销为什么要保存原索引？ → A: 只保存行数据，插回去只能追加到末尾；用户删的是中间几行，恢复后顺序变了会以为恢复错。
- Q: 到期后还能点撤销怎么办？ → A: 按钮随 `pending` 一起消失，函数入口再判断一次 `pending`；只隐藏按钮不够，脚本或旧事件仍可能触发。
- Q: 真实接口什么时候删？ → A: 可以立即发删除请求、窗口内发恢复请求，也可以延迟到窗口结束再发；两种都要处理请求失败，不能只做前端假删除。

踩坑（≤3 条）：

1. 撤销直接 `push` 到末尾：中间删除恢复后顺序全变 → 存原索引并按升序插回。
2. 到期只把剩余秒数设 0、不清 `pending`：撤销条还在，点了没反应 → 到期统一走 `finalizePending`。
3. 再次删除不结束上一批：两个撤销条同时存在，用户不知道撤的是哪批 → 删除入口先收掉旧窗口。

边界：服务端删除失败回滚、跨页批量删除、撤销期间刷新页面都不在本例范围；真实项目还要考虑删除权限与审计日志。
