# JSON 树查看器

## 1. 现象与场景

接口返回一大坨 JSON，直接 `<pre>` 展示没法折叠；用递归组件写树，深层数据一展开就卡，折叠时组件反复挂载卸载。

复现：点「载入示例」，展开/折叠节点、全展开/全折叠，观察行数与路径复制。

## 2. 原理

递归组件直观，但每个节点都是一个组件实例，深层 JSON 会创建大量实例；折叠/展开还会触发子树重挂载。

扁平化方案把「当前可见节点」一次性递归成行数组，模板只 `v-for` 平铺。折叠的本质是「递归时跳过子节点」，不需要组件树变化，性能稳定，也更容易接虚拟滚动。折叠状态用 `Set` 存路径，但 `Set` 的增删不是响应式的，必须替换成新 `Set` 才触发 `computed`。

## 3. 关键代码

```ts
function flatten(value: unknown, path: string, key: string, depth: number): Row[] {
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
  const isContainer = type === 'object' || type === 'array'
  const entries = isContainer ? Object.entries(value as object) : []

  const row: Row = { path, key, value, type, depth, hasChildren: entries.length > 0, childCount: entries.length }
  // 1. 折叠或空容器就不再下钻——折叠的全部实现
  if (!isContainer || collapsed.value.has(path) || entries.length === 0) return [row]

  const rows: Row[] = [row]
  for (const [k, v] of entries) {
    // 2. 路径用 $.a[0].b，复制出去可直接在控制台取值
    const childPath = Array.isArray(value) ? `${path}[${k}]` : `${path}.${k}`
    rows.push(...flatten(v, childPath, Array.isArray(value) ? `[${k}]` : k, depth + 1))
  }
  return rows
}

function toggle(path: string): void {
  const next = new Set(collapsed.value)
  next.has(path) ? next.delete(path) : next.add(path)
  // 3. Set 原地增删不会触发响应式，必须替换引用
  collapsed.value = next
}
```

## 4. 数据对比

| 指标 | 递归组件 | 扁平化行数组 |
|---|---|---|
| 节点组件实例 | 每个可见节点 1 个 | 0（纯 v-for） |
| 折叠操作 | 子树挂载/卸载 | 重新计算行数组 |
| 接虚拟滚动 | 困难 | 直接按行切片 |
| 路径复制 | 需逐层传 path | 行内自带完整 path |

测量方式：Chrome headless 1200×900 载入示例，观察展开/折叠后的行数与 DOM 结构；组件实例数由实现方式决定。数据量越大，扁平化在折叠时的优势越明显。

## 5. 追问与边界

**Q：扁平化后怎么保持展开状态？**
折叠状态存「路径集合」，不在行对象里；重新 `flatten` 时按路径判断是否下钻。

**Q：为什么不用 `JSON.stringify` 高亮？**
那样无法逐节点折叠，也没有类型着色与路径复制；只适合只读小 JSON。

**Q：超大 JSON 怎么办？**
扁平化数组本身也会很大，需要配虚拟滚动；解析放 Worker，避免主线程长时间阻塞。

坑：`collapsed` 用普通 `Set` 直接 `add`，computed 不会重算，页面看起来「点了没反应」。边界：需要编辑、搜索高亮、超大文件时用 vue-json-pretty 等成熟库。
