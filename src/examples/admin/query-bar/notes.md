# QueryBar：后台查询栏别堆成一排

## 1. 现象 / 场景

后台列表页的条件越加越多，最后挤成两三排；改完关键词点查询，表格却没变化——因为表格读的还是上一次的条件；网络慢时连点两下，又发出两个重复请求。

复现步骤：

1. 打开案例，初始 12 条数据、0 项条件。
2. 只改关键词但不点查询，结果仍是 12 条，条件标签也不出现。
3. 选好状态和负责人后连点两次查询，最终只完成 1 次查询，结果 1 条。
4. 点负责人标签上的 ×，条件立即少一项，结果变成 2 条。

## 2. 原理

查询栏其实有两份状态：用户正在编辑的表单值，和已经生效的查询条件。表格只应该读后者。

如果输入框一变就拿去过滤，会出现两个问题：用户还没点查询，列表先闪一下；接口请求和输入节奏绑在一起，输入越快请求越多。把「编辑」和「生效」拆开，查询时再收一份快照，表格数据就稳定了。

条件多的时候需要收起，但收起只是隐藏输入框，条件标签仍要显示；重置必须同时清空表单、已生效条件和在途请求，否则用户会看到「条件清空了，结果还是旧的」。

## 3. 方案：关键代码

```ts
//! 表单值和已生效条件分开：表格只认 applied
const keyword = ref('')
const status = ref<Status | 'all'>('all')
const applied = ref<Filters>({ keyword: '', status: 'all', owner: 'all' })

//! 查询时收快照；loading 期间直接 return，连点不会重复请求
function runQuery(): void {
  if (loading.value) return
  const snapshot = currentFilters()
  loading.value = true
  queryTimer = window.setTimeout(() => {
    applied.value = snapshot
    loading.value = false
    queryTimer = null
  }, 450)
}

//! 重置要连在途请求一起取消，否则旧回调还会把结果写回来
function reset(): void {
  if (queryTimer !== null) {
    window.clearTimeout(queryTimer)
    queryTimer = null
  }
  loading.value = false
  keyword.value = ''
  status.value = 'all'
  owner.value = 'all'
  applied.value = { keyword: '', status: 'all', owner: 'all' }
}
```

三处关键选择：

1. `currentFilters()` 在点击查询时调用，而不是在 `computed` 里直接读输入框——避免「输入即过滤」。
2. `loading` 既是按钮状态也是并发锁，查询中按钮 `disabled`，函数里再 `return` 一次，防止键盘回车绕过按钮禁用。
3. 定时器在 `onUnmounted` 里清理，组件卸载后不再改状态。

## 4. 数据对比

| 操作 | 结果条数 | 已生效条件 | 测量方式 |
| --- | --- | --- | --- |
| 初始 | 12 | 0 | 页面 data-stat 读数 |
| 只改关键词「报表」，未查询 | 12 | 0 | 同上 |
| 查询（关键词 + 启用 + 张三） | 1 | 3 | 同上 |
| 连点两次查询 | 1 次查询 | 3 | 查询次数计数 |
| 点负责人标签 × | 2 | 2 | 同上 |
| 重置 | 12 | 0 | 重置次数 1 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/query-bar`。
- 取样：`npm run check:ui -- --only 查询栏` 的常驻场景，同一页面顺序执行。
- 查询延迟 450ms 是 Demo 固定值，用来制造「加载中」窗口；不是接口性能结论。

## 5. 追问与边界（面试高频）

- Q: 为什么不让输入框直接过滤？ → A: 输入和请求节奏绑在一起会抖，且用户没点查询就看到结果变化，容易误以为条件已生效。
- Q: 重置为什么还要取消定时器？ → A: 旧请求的回调晚到，会把刚清空的结果又写回去；重置要连在途请求一起作废。
- Q: 条件多了一定要收起吗？ → A: 不一定。收起是为了不让筛选区占掉半屏；条件少时直接平铺更好，别为了「看起来像后台」强行折叠。

踩坑（≤3 条）：

1. 只清表单不清 `applied`：输入框空了，表格还是旧条件 → 重置要两份状态一起清。
2. 查询中只禁用按钮、函数里不判断：回车或脚本仍能触发第二次 → `runQuery` 开头补 `if (loading.value) return`。
3. 标签直接读输入框：用户改字但没查询，标签先变 → 标签只从 `applied` 生成。

边界：需要分享链接、刷新还原条件时，把 `applied` 同步到 URL（可参考 `basics/url-search-params`）；本例不展开，避免和已有案例重复。
