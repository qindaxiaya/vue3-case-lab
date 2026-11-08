# SavedViews：筛选条件别每次重新点

## 1. 现象 / 场景

后台列表的筛选、排序、列显隐每天都要重新调一遍。运营想看「待处理 + 金额从高到低 + 不显示负责人」，财务想看「全部 + 金额从高到低 + 只显示金额」，每次切角色都要从头点。

复现步骤：

1. 打开案例，默认停在「全部订单」，结果 6 条，可见列 4 个。
2. 切到「待处理」，结果变成 3 条，右上角出现「有未保存修改」。
3. 输入视图名并保存，视图从 3 个变成 4 个，脏标记归零。
4. 再改排序，脏标记重新出现；点「更新当前视图」后归零。
5. 切到默认的「高金额」，结果 2 条、可见列 3 个，删除按钮不可用。
6. 点「恢复默认」，回到「全部订单」、6 条结果、没有未保存修改。

## 2. 原理

保存视图不是保存查询结果，而是保存「查询长什么样」：关键词、状态、最低金额、排序、显示哪些列。结果会随数据变化，条件才是用户真正想复用的东西。

视图和当前查询必须是两份数据。切换视图时把视图里的条件复制到当前查询，之后用户再改筛选，不会反过来污染视图；只有点「更新当前视图」才把当前条件写回快照。这样「未保存修改」才有意义：比较当前查询和当前视图快照，不一致就提示。

默认视图是系统给的兜底入口，不能让用户删除或覆盖，否则列表可能落到一个不存在的视图上。删除自定义视图后要回到默认视图，恢复默认也要回到同一个入口。

## 3. 方案：关键代码

```ts
//! 视图保存的是查询副本，切换时复制回来，改筛选不会污染原视图
function cloneQuery(source: QueryState): QueryState {
  return {
    keyword: source.keyword,
    status: source.status,
    sort: source.sort,
    minAmount: source.minAmount,
    columns: { ...source.columns },
  }
}

function applyQuery(source: QueryState): void {
  query.keyword = source.keyword
  query.status = source.status
  query.sort = source.sort
  query.minAmount = source.minAmount
  query.columns = { ...source.columns }
}

//! 用稳定顺序的字符串比较当前查询和视图快照，得到「未保存」标记
function serialize(source: QueryState): string {
  return JSON.stringify([
    source.keyword.trim(),
    source.status,
    source.sort,
    source.minAmount,
    source.columns.owner,
    source.columns.amount,
  ])
}

const dirty = computed(() => {
  if (!currentView.value) return false
  return serialize(query) !== serialize(currentView.value.query)
})

//! 默认视图只读：更新和删除都直接返回，按钮也同步禁用
function updateCurrent(): void {
  const target = currentView.value
  if (!target || target.isDefault) return
  target.query = cloneQuery(query)
}
```

三处关键选择：

1. `cloneQuery` 和 `applyQuery` 都复制 `columns`，避免当前查询和视图共用同一个列显隐对象。
2. `serialize` 固定字段顺序，只比较业务字段，不把视图名称、默认标记算进脏检查。
3. `isDefault` 同时控制逻辑和按钮禁用，用户看得到「为什么不能点」。

## 4. 数据对比

| 操作 | 视图数 | 结果数 | 可见列 | 未保存标记 | 当前视图 |
| --- | --- | --- | --- | --- | --- |
| 初始 | 3 | 6 | 4 | 0 | 全部订单 |
| 切「待处理」 | 3 | 3 | 4 | 1 | 待处理 |
| 保存为新视图 | 4 | 3 | 4 | 0 | 待处理视图 |
| 改排序后更新 | 4 | 3 | 4 | 0 | 待处理视图 |
| 删除当前视图 | 3 | 6 | 4 | 0 | 全部订单 |
| 切「高金额」 | 3 | 2 | 3 | 0 | 高金额 |
| 恢复默认 | 3 | 6 | 4 | 0 | 全部订单 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/saved-views`。
- 取样：`npm run check:ui -- --only 保存视图` 的常驻场景，同一页面顺序执行。
- 口径：视图数、结果数、可见列数、未保存标记都直接读页面 `data-stat`；默认视图的删除按钮读 `disabled` 属性。

## 5. 追问与边界（面试高频）

- Q: 为什么视图不直接存查询结果？ → A: 结果会随数据变化，存下来很快过期；条件才是可复用的部分，切回视图时重新查一次更准确。
- Q: 切换视图时为什么要复制条件？ → A: 不复制就会共用对象，用户改筛选等于改视图；复制后「更新当前视图」才是唯一写入口。
- Q: 默认视图为什么不能删？ → A: 删除后没有兜底入口，用户可能停在一个不存在的视图上；默认视图还承担「恢复默认」的落点。
- Q: 脏标记怎么算才不误报？ → A: 只比较业务字段，固定字段顺序；不要把视图名称、默认标记、临时 UI 状态算进去。

踩坑（≤3 条）：

1. 只复制一层：`columns` 还是同一个对象，改列显隐会把视图一起改掉 → 嵌套对象也要复制。
2. 用对象引用比较脏状态：每次复制都是新对象，永远显示「有未保存修改」 → 改成稳定字符串比较。
3. 删除当前视图后不切回默认：当前视图变成空值，表格还在显示旧条件 → 删除后显式切到默认视图。

边界：本例视图只存在内存，刷新会回到默认；真实项目可以把视图列表存到用户偏好接口或 localStorage，但保存的仍然只是查询条件。视图共享、权限控制、跨设备同步属于另一层能力。
