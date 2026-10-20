<!-- ============================================================
     递归树节点：文件名即组件名，script setup 中可直接自引用
     ============================================================ -->
<script setup lang="ts">
import { ref } from 'vue'
import type { TreeNodeData } from './types'

const props = defineProps<{
  node: TreeNodeData
  /** 当前层级（根为 0），透传给插槽用于缩进/配色 */
  depth: number
}>()

/** 是否展开（默认展开前两层） */
const open = ref(props.depth < 1)

/** 是否有子节点 */
const hasChildren = (): boolean => Boolean(props.node.children?.length)
</script>

<template>
  <li class="tree-node">
    <div class="tree-row">
      <!-- 展开/收起按钮（叶子节点留占位保持对齐） -->
      <button
        v-if="hasChildren()"
        class="tree-toggle"
        type="button"
        :aria-expanded="open"
        @click="open = !open"
      >
        {{ open ? '▾' : '▸' }}
      </button>
      <span
        v-else
        class="tree-toggle tree-toggle--leaf"
        aria-hidden="true"
      >·</span>

      <!-- //! 作用域插槽：父级可完全接管节点渲染（图标、标签、按钮） -->
      <slot
        :node="node"
        :depth="depth"
      >
        <span class="tree-label">{{ node.label }}</span>
      </slot>
    </div>

    <!-- //! 递归：v-if 控制展开，子节点继续渲染自己 -->
    <ul
      v-if="open && hasChildren()"
      class="tree-children"
    >
      <TreeNode
        v-for="child in node.children"
        :key="child.label"
        :node="child"
        :depth="depth + 1"
      >
        <!-- 把父级的插槽继续向下透传，保证任意层级都能自定义 -->
        <template #default="slotProps">
          <slot v-bind="slotProps" />
        </template>
      </TreeNode>
    </ul>
  </li>
</template>

<style scoped>
.tree-node {
  list-style: none;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.12rem 0;
}

.tree-toggle {
  width: 1.1rem;
  height: 1.1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 0.7rem;
  cursor: pointer;
  flex-shrink: 0;

  &--leaf {
    cursor: default;
    opacity: 0.4;
  }

  &:not(&--leaf):hover {
    color: var(--primary);
  }
}

.tree-children {
  margin: 0;
  padding-left: 1rem;
  border-left: 1px dashed var(--border);
}

.tree-label {
  font-size: 0.78rem;
  color: var(--text);
}
</style>
