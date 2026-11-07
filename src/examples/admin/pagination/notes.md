# Pagination：分页别把边界留给用户

## 1. 现象 / 场景

后台列表翻到第 3 页，删掉当前页最后几条，页面变成空白，用户以为数据没了；每页条数从 10 改成 20，还停在第 5 页，结果直接越界。

复现步骤：

1. 初始 47 条、每页 10 条，翻到第 3 页，当前页 10 条。
2. 把每页条数改成 20，页码回到第 1 页，总页数从 5 页变 3 页。
3. 再翻到第 3 页，只剩 7 条；点 7 次「删除当前页最后一条」，总条数变 40，页码自动回退到第 2 页。
4. 点「重置数据」，总条数、页码、每页条数一起复位。

## 2. 原理

分页有两个独立状态：页码和每页条数。每页条数一变，总页数跟着变，旧页码可能已经越界；删除数据也一样。

页码不是用户随便填的值，而是由「总条数 + 每页条数」约束出来的。每次数据量或每页条数变化后，先算新的总页数，再把页码夹到有效范围，最后才渲染当前页数据。

如果只在翻页按钮上做限制，删除和改每页条数这两条路径仍会留下空页。把校正放在状态变化处，比在每个按钮里各写一遍可靠。

## 3. 方案：关键代码

```ts
const page = ref(1)
const pageSize = ref(10)

const total = computed(() => users.value.length)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const pagedRows = computed(() =>
  users.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
)

//! 每页条数变化：回到第一页，避免停在越界页
watch(pageSize, () => {
  page.value = 1
})

//! 总条数变化：当前页超过总页数时自动回退
watch(total, () => {
  if (page.value > pageCount.value) page.value = pageCount.value
})

//! 删除当前页最后一条：删到空页后页码立即回退
function deleteLast(): void {
  const current = pagedRows.value
  if (current.length === 0) return
  const last = current[current.length - 1]
  users.value = users.value.filter((user) => user.id !== last.id)
  deleteCount.value++
  if (page.value > pageCount.value) page.value = pageCount.value
}
```

三处关键选择：

1. `pageCount` 用 `Math.max(1, ...)`：空数据时也保留第 1 页，避免出现 0 页。
2. 每页条数变化时回到第 1 页，而不是保留原页码再夹取——用户改的是「每页看多少」，从第一页重新看更符合预期。
3. 删除后立即校正页码，不依赖下一次渲染或用户手动翻页。

## 4. 数据对比

| 操作 | 总条数 | 当前页 | 每页 | 总页数 | 当前页条数 |
| --- | --- | --- | --- | --- | --- |
| 初始 | 47 | 1 | 10 | 5 | 10 |
| 翻到第 3 页 | 47 | 3 | 10 | 5 | 10 |
| 每页改 20 | 47 | 1 | 20 | 3 | 20 |
| 再翻到第 3 页 | 47 | 3 | 20 | 3 | 7 |
| 删 7 条后 | 40 | 2 | 20 | 2 | 20 |
| 重置数据 | 47 | 1 | 10 | 5 | 10 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/pagination`。
- 取样：`npm run check:ui -- --only 分页` 的常驻场景。
- 数据规模固定 47 条，方便复现 5 页 / 3 页两种边界。

## 5. 追问与边界（面试高频）

- Q: 每页条数变化后为什么要回第一页？ → A: 用户改的是「每页看多少」，从第一页重新看更符合预期；保留原页码会让人不知道当前看到哪一段。
- Q: 删除后页码越界怎么办？ → A: 立即夹到新的最后一页；不要等用户再点一次「上一页」。
- Q: 分页参数放前端还是后端？ → A: 真实项目通常由后端分页，前端只保存 page / pageSize 并随查询提交；前端仍要做页码边界校正。

踩坑（≤3 条）：

1. 只在「下一页」按钮禁用：删除或改每页条数仍会越界 → 在状态变化处统一校正。
2. 每页条数变化保留原页码：从第 5 页切到每页 20 条可能直接空表 → 回到第 1 页。
3. 空数据时 `pageCount` 算成 0：分页器显示 0 页，用户无法回到第 1 页 → 用 `Math.max(1, ...)`。

边界：本例是前端假分页；服务端分页要把 page / pageSize 发给接口，删除后重新请求当前页，不能只改本地数组。需要「跳页输入」时再加输入框，不要把所有分页功能一次性堆上。
