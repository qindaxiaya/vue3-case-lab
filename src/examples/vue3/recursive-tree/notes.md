# 递归组件 + 作用域插槽

## 1. 现象与场景

组织架构/文件目录层级不确定，每个节点都复制同一段模板；想改节点样式要改好几处，展开状态也散落在各层。

复现：点 ▸ / ▾ 展开收起；点「重置展开状态」用 `:key` 重建整棵树，回到默认展开层级。

## 2. 原理

组件可以引用自己：节点组件渲染子节点时再用一次自己，递归就成立了。`<script setup>` 里组件名等于文件名，可直接在模板中引用自身。

父级想控制节点长什么样，用作用域插槽把 `node` / `depth` 传出去；递归时要把插槽继续向下透传，否则只有第一层能自定义。展开状态放父级（`Set`）才能一键全部展开；需要彻底重置时用 `:key` 重建。

## 3. 关键代码

```vue
<!-- TreeNode.vue：文件名即组件名 -->
<script setup lang="ts">
defineProps<{ node: TreeNodeData; depth: number }>()
</script>

<template>
  <li>
    <!-- 1. 把节点与深度交给父级插槽渲染 -->
    <slot :node="node" :depth="depth" />
    <ul v-if="node.children?.length">
      <!-- 2. 自己渲染自己，children 为空自然终止 -->
      <TreeNode
        v-for="child in node.children"
        :key="child.label"
        :node="child"
        :depth="depth + 1"
      />
    </ul>
  </li>
</template>
```

```vue
<!-- 递归时继续透传插槽，否则深层节点丢失自定义 -->
<TreeNode :node="tree" :depth="0">
  <template #default="slotProps"><slot v-bind="slotProps" /></template>
</TreeNode>
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 节点总数 | 12 |
| 层级 | 任意（示例 3 层） |
| 展开状态 | 父级 Set / 组件内 ref |
| 重置方式 | `:key` 变化重建 |
| 自定义渲染 | 作用域插槽 |

测量方式：Chrome headless 1200×900 读取「共 12 个节点」；展开/收起观察子节点增删；点重置观察 key 重建后的默认层级。节点数为 Demo 数据。

## 5. 追问与边界

**Q：为什么插槽要透传？**
子节点也是 `TreeNode`，如果父级只在最外层传插槽，深层节点会使用默认插槽，样式不一致。

**Q：几千个节点怎么办？**
不要全量渲染，配虚拟列表或懒加载子节点；递归深度正常业务（<50 层）不用担心调用栈。

**Q：展开状态放组件内还是父级？**
需要「全部展开/折叠」就放父级受控；只做单节点展开可以放组件内。

坑：`key` 用 index，拖拽/增删会错位；递归组件里深拷贝父级 props 会导致指数级开销。边界：树节点含异步加载时，展开前要处理 loading 与失败重试。
