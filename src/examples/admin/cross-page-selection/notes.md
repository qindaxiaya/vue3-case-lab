# CrossPageSelection：翻页后已选不能丢

## 1. 现象 / 场景

后台表格勾了几行，翻到下一页再回来，勾选全没了；点「全选」以为选了所有筛选结果，其实只选了当前页，提交后才发现少了一大半。

复现步骤：

1. 第 1 页勾选第 1 行，已选显示 1。
2. 点「下一页」，已选仍然是 1，而不是归零。
3. 点「选择本页」，第 2 页 5 行并入选择，已选变成 6。
4. 切到「待处理」筛选，结果 6 行、已选仍为 6，并回到第 1 页。
5. 切到「已完成」筛选，结果 4 行、已选仍为 6；点「选择全部筛选结果」后变成 10。
6. 点「重置」，已选归零、筛选回到「全部」、页码回到第 1 页。

## 2. 原理

分页只改变「当前显示哪些行」，不该改变「用户已经选了哪些行」。选择状态要独立于分页和筛选，按行 id 存进一个集合里。

选择存 id 而不是行对象：翻页后行对象可能重新创建，引用会变；id 是稳定标识，提交接口时也正好传 id 列表。

本页全选和筛选全选是两个范围。表头复选框只表达「当前页选没选满」，所以它的全选 / 半选都从 `pageRows` 派生；「选择全部筛选结果」才把 `filteredRows` 一次并入。

## 3. 方案：关键代码

```ts
//! 用 Set 存跨页选择：翻页、筛选只改可见行，不清空它
const selectedIds = ref<Set<number>>(new Set())

const pageRows = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredRows.value.slice(start, start + PAGE_SIZE)
})

//! 本页全选只由本页行派生，跨页已选不影响它
const pageAllSelected = computed(
  () => pageRows.value.length > 0 && pageRows.value.every((row) => selectedIds.value.has(row.id)),
)

//! 半选 = 本页选了但没选满，和全选不是互斥的两个布尔值
const pageIndeterminate = computed(
  () =>
    !pageAllSelected.value && pageRows.value.some((row) => selectedIds.value.has(row.id)),
)

//! 选择全部筛选结果：范围是筛选后的全部行，不是当前页
function selectFiltered(): void {
  const next = new Set(selectedIds.value)
  filteredRows.value.forEach((row) => next.add(row.id))
  selectedIds.value = next
}
```

三处关键选择：

1. `selectedIds` 独立于 `pageRows`：翻页只换可见行，集合不动。
2. `pageAllSelected` 只看当前页：否则第 1 页选了一行，第 2 页表头会误显示半选。
3. `selectFiltered` 用 `filteredRows`：筛选后的 4 行和当前页的 4 行可能不是同一批。

## 4. 数据对比

| 操作 | 已选 | 筛选后行数 | 页码 | 测量方式 |
| --- | --- | --- | --- | --- |
| 初始 | 0 | 10 | 1 | 页面 `data-stat` 读数 |
| 勾选第 1 行 | 1 | 10 | 1 | 同上 |
| 点下一页 | 1 | 10 | 2 | 已选没有被分页清空 |
| 选择本页 | 6 | 10 | 2 | 第 2 页 5 行并入 |
| 切待处理 | 6 | 6 | 1 | 筛选回第 1 页，选择保留 |
| 切已完成 | 6 | 4 | 1 | 已选仍是 6 |
| 选择全部筛选结果 | 10 | 4 | 1 | 4 行全部并入 |
| 清空选择 | 0 | 4 | 1 | 集合清空 |
| 待处理全选后翻页 | 6 | 6 | 2 | 跨页仍保留 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/cross-page-selection`。
- 取样：`npm run check:ui -- --base http://localhost:5174 --only 跨页选择` 的常驻场景。
- 数据是页面内固定演示数据，不是接口返回量。

## 5. 追问与边界（面试高频）

- Q: 为什么用 Set 而不是数组？ → A: 勾选 / 取消是高频操作，Set 的增删查都是常数时间；数组还要先 `includes` 再过滤，行数多时会明显变慢。
- Q: 跨页全选怎么做？ → A: 单独提供「选择全部 N 项」入口，并显示已选总数和取消入口；不要把它和表头的本页全选混成一个按钮。
- Q: 筛选变化后已选但不可见的行怎么处理？ → A: 默认保留，提交时按 id 传；如果业务要求只提交可见行，必须在切换筛选时明确提示并清理，不能悄悄丢。

踩坑（≤3 条）：

1. 用数组存选择、翻页时重置：用户来回翻两页就得重新勾 → 选择状态独立于分页。
2. 表头全选直接操作 `filteredRows`：用户以为只选本页，实际把其他页也选了 → 本页全选只碰 `pageRows`。
3. 切筛选时顺手清空选择：用户切一下条件，之前勾的全没了 → 筛选只改可见行，选择保留。

边界：服务端全选、选择数量上限、跨标签页同步不在本例范围；真实项目里还要考虑刷新后是否恢复选择。
