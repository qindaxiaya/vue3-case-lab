// ============================================================
// 案例：递归组件 + 作用域插槽（recursive-tree）
// - TreeNode.vue 自引用渲染任意层级
// - 父级通过 #default="{ node, depth }" 接管节点样式
// - 展开/收起全部：改 key 强制重建（演示组件递归状态）
// ============================================================
<script setup lang="ts">
import { ref } from 'vue'
import TreeNode from './TreeNode.vue'
import type { TreeNodeData } from './types'

// ============================================================
// 示例数据：文件树（3 层，演示任意深度）
// ============================================================

const tree: TreeNodeData = {
  label: 'src',
  kind: 'dir',
  children: [
    {
      label: 'components',
      kind: 'dir',
      children: [
        { label: 'Button.vue', kind: 'vue' },
        { label: 'Modal.vue', kind: 'vue' },
        {
          label: 'tree',
          kind: 'dir',
          children: [
            { label: 'TreeNode.vue', kind: 'vue' },
            { label: 'TreeUtil.ts', kind: 'ts' },
          ],
        },
      ],
    },
    {
      label: 'composables',
      kind: 'dir',
      children: [
        { label: 'useTheme.ts', kind: 'ts' },
        { label: 'useFetch.ts', kind: 'ts' },
      ],
    },
    { label: 'main.ts', kind: 'ts' },
    { label: 'App.vue', kind: 'vue' },
  ],
}

/** 重建 key：点「全部折叠/展开」时强制子树重新初始化 */
const treeKey = ref(0)

/** 自定义插槽用的图标 */
const kindIcon: Record<string, string> = {
  dir: '📁',
  vue: '🟢',
  ts: '🔵',
}

function rebuild(): void {
  treeKey.value++
}

/** 统计节点总数（递归 + 扁平化） */
function countNodes(node: TreeNodeData): number {
  return 1 + (node.children?.reduce((sum, c) => sum + countNodes(c), 0) ?? 0)
}

const total = countNodes(tree)
</script>

<template>
  <div class="tree-demo">
    <header class="tree-head">
      <p class="tree-meta">
        共 <b>{{ total }}</b> 个节点 · 深度任意 · 插槽接管渲染
      </p>
      <button
        class="btn-act"
        @click="rebuild"
      >
        重置展开状态
      </button>
    </header>

    <div class="tree-card">
      <!-- //! 作用域插槽：node / depth 由递归组件逐层透传 -->
      <ul class="tree-root">
        <TreeNode
          :key="treeKey"
          :node="tree"
          :depth="0"
        >
          <template #default="{ node, depth }">
            <span
              class="tree-custom"
              :style="{ paddingLeft: `${depth * 0.1}rem` }"
            >
              <span aria-hidden="true">{{ kindIcon[node.kind ?? ''] ?? '📄' }}</span>
              <span class="tree-name">{{ node.label }}</span>
              <span
                v-if="node.children?.length"
                class="tree-badge"
              >{{ node.children.length }}</span>
            </span>
          </template>
        </TreeNode>
      </ul>
    </div>

    <p class="tree-hint">
      点 ▸ / ▾ 展开收起；「重置」利用 <code>:key</code> 变化重建整棵树，回到默认展开层级。
    </p>
  </div>
</template>

<style scoped>
.tree-demo {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.tree-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tree-meta {
  margin: 0;
  font-size: 0.76rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.tree-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.65rem 0.7rem;
  max-height: 360px;
  overflow: auto;
}

.tree-root {
  margin: 0;
  padding: 0;
}

.tree-custom {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
}

.tree-name {
  color: var(--text);
}

.tree-badge {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background-color: var(--code-bg);
  color: var(--text-secondary);
}

.btn-act {
  padding: 0.26rem 0.65rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.74rem;
  cursor: pointer;

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

.tree-hint {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-secondary);
  line-height: 1.6;

  code {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 0.02rem 0.25rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}
</style>
