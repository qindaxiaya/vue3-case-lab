# ColumnSettings：表格列别写死在代码里

## 1. 现象 / 场景

后台表格的列越加越多，不同角色关心的列却不一样：运营想隐藏金额，财务想隐藏负责人。每来一个需求就改一次模板，最后表格又长又难维护。

复现步骤：

1. 打开案例，默认显示 5 列，名称列标记为固定列。
2. 点「金额」的上移，金额列排到更新时间前面。
3. 取消勾选「更新时间」，表格变成 4 列，顺序里不再出现更新时间。
4. 点「恢复默认」，5 列全部回来，顺序也回到初始状态。

## 2. 原理

列设置本质是一份独立于数据的配置：显示哪些列、按什么顺序显示。它不应该和表格数据混在一起，也不应该只存在组件内存里，否则刷新就丢。

配置只存列 key（`name`、`amount` 这类字符串），不要存整个列对象。这样以后改列标题、列宽、渲染方式，旧配置仍然能对上；读取时再过滤掉已经不存在的 key，删列或改名都不会把表格弄崩。

固定列（例如名称）要禁止隐藏，否则用户可能把表格改成只剩金额，认不出哪一行是什么。恢复默认要同时重置顺序、显隐和 localStorage，而不是只改内存里的值。

## 3. 方案：关键代码

```ts
//! 配置只存列 key：改标题、改宽度不会把旧配置顶掉
//! 读取时过滤不认识的 key，旧配置缺列就补在末尾
function loadConfig(): void {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as {
    order?: unknown
    visible?: Record<string, unknown>
  } | null
  if (!data) return
  const savedOrder = Array.isArray(data.order)
    ? data.order.filter((key): key is ColumnKey => typeof key === 'string' && allKeys.includes(key as ColumnKey))
    : []
  order.value = [...savedOrder, ...allKeys.filter((key) => !savedOrder.includes(key))]
  for (const key of allKeys) {
    if (typeof data.visible?.[key] === 'boolean') visible.value[key] = data.visible[key]
  }
}

//! 表格只渲染当前可见列，顺序跟着 order 走
const visibleColumns = computed(() =>
  order.value
    .filter((key) => visible.value[key])
    .map((key) => allColumns.find((column) => column.key === key)!)
    .filter(Boolean),
)

//! 固定列和最后一列不允许隐藏
function setVisible(key: ColumnKey, checked: boolean): void {
  const column = allColumns.find((item) => item.key === key)
  if (!column || column.fixed) return
  if (!checked && visibleColumns.value.length <= 1) return
  visible.value = { ...visible.value, [key]: checked }
}
```

三处关键选择：

1. `order` 和 `visible` 分开存：排序不影响显隐，隐藏某列也不会把它从顺序里删掉。
2. 用 `watch` 自动落盘，改动一次写一次；重置时用 `skipNextSave` 跳过一次，避免刚清掉又写回默认值。
3. `visibleColumns` 是派生状态，模板不直接拼列，改配置只改数据。

## 4. 数据对比

| 操作 | 可见列数 | 可见顺序 | 测量方式 |
| --- | --- | --- | --- |
| 初始 | 5 | 名称 / 状态 / 负责人 / 更新时间 / 金额 | 页面 data-stat 读数 |
| 金额上移一次 | 5 | 名称 / 状态 / 负责人 / 金额 / 更新时间 | 同上 |
| 隐藏更新时间 | 4 | 名称 / 状态 / 负责人 / 金额 | 同上 |
| 恢复默认 | 5 | 名称 / 状态 / 负责人 / 更新时间 / 金额 | 重置次数 +1 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/column-settings`。
- 取样：`npm run check:ui -- --only 列设置` 的常驻场景，同一页面顺序执行。
- 刷新后仍保留配置依赖 localStorage；场景不跨刷新，持久化用「写入后读取同一份配置」验证。

## 5. 追问与边界（面试高频）

- Q: 为什么存 key 不存整个列对象？ → A: 列对象里有标题、宽度、渲染函数，存下来会和代码版本绑定；key 才是稳定标识。
- Q: 用户把列全隐藏了怎么办？ → A: 固定列禁止隐藏，且至少保留一列；否则表格只剩表头，无法识别行。
- Q: 恢复默认要不要清 localStorage？ → A: 要。只改内存的话，刷新后旧配置又回来了，用户会以为重置没生效。

踩坑（≤3 条）：

1. 只存顺序不存显隐：隐藏的列下次刷新又出现 → 两个配置要一起保存。
2. 读取时不校验 key：删过列后旧配置里留着废弃 key，表格渲染空列 → 读取时过滤。
3. 重置时 watch 又把默认配置写回：看起来像「没清掉」 → 用一次性跳过标记，或重置后直接写入默认配置。

边界：列宽拖拽、列固定（左 / 右）属于另一层能力，本例只做显隐与顺序；真实项目可把配置同步到用户偏好接口，而不是只放 localStorage。
