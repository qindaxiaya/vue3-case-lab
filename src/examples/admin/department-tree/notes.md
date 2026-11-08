# DepartmentTree：部门选择别只给平铺列表

## 1. 现象 / 场景

后台按部门筛选数据，下拉框把三级部门拍平：两个「研发组」同名，选完不知道是杭州的还是上海的；用户想选「杭州研发组」，只能靠猜顺序。

复现步骤：

1. 打开案例，左侧平铺下拉里能看到两个「研发组」，没有上级路径。
2. 点右侧树里的「技术部」：父级被拒绝，计数变成 1，选中路径仍为空。
3. 搜索「杭州」：树只保留命中叶子及其祖先，「技术部」路径可见。
4. 点「杭州研发组」：路径显示「总部 / 技术部 / 杭州研发组」。

## 2. 原理

部门本身是树，选择器应该保留层级。父部门通常只是分组，不能作为业务归属；真正可选的是末级部门。

搜索时不能只返回命中叶子：用户需要看到它属于哪个部门。过滤函数要保留命中节点的祖先，并自动展开这些祖先，否则结果藏在折叠节点里。

选中值只存叶子 key；展示时用 key 回溯完整路径。这样接口拿到的是稳定的末级部门 id，界面又能显示人类可读的层级。

## 3. 方案：关键代码

```ts
//! 搜索时保留命中节点及其祖先；父节点命中则保留整棵子树
function filterTree(nodes: DeptNode[], text: string): DeptNode[] {
  if (!text) return nodes
  return nodes.flatMap((node) => {
    const children = node.children ? filterTree(node.children, text) : []
    if (node.label.includes(text)) {
      return [{ ...node, children: node.children ? node.children : undefined }]
    }
    return children.length ? [{ ...node, children }] : []
  })
}

//! 父部门只负责展开，不能作为选中值
function onSelectedKeys(keys: Array<string | number>): void {
  const key = keys.length ? String(keys[keys.length - 1]) : ''
  if (!key) return
  const node = findNode(DEPARTMENTS, key)
  if (node?.children?.length) {
    rejectCount.value++
    return
  }
  selectedKeys.value = [key]
}

//! 从根到目标节点回溯完整路径
function findPath(nodes: DeptNode[], key: string, path: string[] = []): string[] | null {
  for (const node of nodes) {
    const nextPath = [...path, node.label]
    if (node.key === key) return nextPath
    if (node.children) {
      const found = findPath(node.children, key, nextPath)
      if (found) return found
    }
  }
  return null
}
```

三处关键选择：

1. 过滤函数保留祖先，而不是只返回命中节点；搜索「杭州」时「总部 / 技术部」必须一起出现。
2. 父节点在选中回调里拒绝，不依赖组件是否禁用；这样父节点仍能展开，只是不能成为值。
3. 路径回溯只读完整部门表，不受搜索过滤影响；选中后不会因为清空搜索而丢失路径。

## 4. 数据对比

| 操作 | 选中路径 | 父级被拒 | 可见节点 | 测量方式 |
| --- | --- | --- | --- | --- |
| 初始 | 未选择 | 0 | 9 | 页面 data-stat 读数 |
| 点「技术部」 | 未选择 | 1 | 9 | 同上 |
| 搜索「杭州」 | 未选择 | 1 | 3 | 同上 |
| 点「杭州研发组」 | 总部 / 技术部 / 杭州研发组 | 1 | 3 | 同上 |
| 重置 | 未选择 | 0 | 9 | 同上 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/department-tree`。
- 取样：`npm run check:ui -- --only 部门树` 的常驻场景，同一页面顺序操作。
- 部门树共 9 个节点（3 个分组 + 5 个末级部门），搜索「杭州」后剩 3 个节点。

## 5. 追问与边界（面试高频）

- Q: 为什么父部门不能选？ → A: 父部门是分组，业务归属要落到具体末级部门；允许选父级会让统计口径变模糊。
- Q: 搜索为什么不直接过滤叶子？ → A: 叶子离开祖先就没有上下文，用户不知道「研发组」属于哪个部门。
- Q: 选中值存 key 还是完整路径？ → A: 存 key。路径会随组织调整变化，key 更稳定；展示时再回溯。

踩坑（≤3 条）：

1. 搜索只返回叶子：用户看到两个「研发组」仍分不清 → 保留祖先路径。
2. 父节点直接禁用：点击没反馈，用户以为坏了 → 可以拒绝并提示，或明确标「含子部门」。
3. 只存路径字符串：组织改名后历史数据对不上 → 存叶子 key，路径只用于展示。

边界：真实组织树可能很大，需要懒加载子节点、虚拟滚动；本例用内存树演示选择规则，不处理远程加载。
