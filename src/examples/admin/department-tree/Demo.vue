// ============================================================
// 案例：department-tree 树形部门选择
// 父部门不可选，搜索自动展开，选中后回显完整路径
// ============================================================
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

// ============================================================
// 类型与部门数据
// ============================================================

interface DeptNode {
  key: string
  label: string
  children?: DeptNode[]
  [key: string]: unknown
}

const DEPARTMENTS: DeptNode[] = [
  {
    key: 'hq',
    label: '总部',
    children: [
      {
        key: 'tech',
        label: '技术部',
        children: [
          { key: 'hz-dev', label: '杭州研发组' },
          { key: 'sh-dev', label: '上海研发组' },
        ],
      },
      {
        key: 'product',
        label: '产品部',
        children: [
          { key: 'design', label: '设计组' },
          { key: 'operation', label: '运营组' },
        ],
      },
      {
        key: 'finance',
        label: '财务部',
        children: [{ key: 'accounting', label: '会计组' }],
      },
    ],
  },
]

const keyword = ref('')
const selectedKeys = ref<string[]>([])
const expandedKeys = ref<string[]>([])
const rejectCount = ref(0)
const flatValue = ref<string | null>(null)

// ============================================================
// 树工具
// ============================================================

function flattenLeaves(nodes: DeptNode[]): DeptNode[] {
  return nodes.flatMap((node) => (node.children ? flattenLeaves(node.children) : [node]))
}

function allParentKeys(nodes: DeptNode[]): string[] {
  return nodes.flatMap((node) =>
    node.children ? [node.key, ...allParentKeys(node.children)] : [],
  )
}

function findNode(nodes: DeptNode[], key: string): DeptNode | null {
  for (const node of nodes) {
    if (node.key === key) return node
    if (node.children) {
      const found = findNode(node.children, key)
      if (found) return found
    }
  }
  return null
}

/** 从根到目标节点回溯完整路径，用来回显「总部 / 技术部 / 杭州研发组」 */
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

/** 给父节点加「含子部门」提示，避免用户以为它和叶子一样可选 */
function decorate(nodes: DeptNode[]): DeptNode[] {
  return nodes.map((node) =>
    node.children
      ? { ...node, label: `${node.label}（含子部门）`, children: decorate(node.children) }
      : node,
  )
}

/** 搜索时保留命中节点及其祖先；父节点命中则保留整棵子树 */
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

const decoratedTree = decorate(DEPARTMENTS)
const visibleTree = computed(() => filterTree(decoratedTree, keyword.value.trim()))
const visibleCount = computed(() => {
  const count = (nodes: DeptNode[]): number =>
    nodes.reduce((sum, node) => sum + 1 + (node.children ? count(node.children) : 0), 0)
  return count(visibleTree.value)
})

const flatOptions = flattenLeaves(DEPARTMENTS).map((node) => ({
  label: node.label,
  value: node.key,
}))

const selectedPath = computed(() => {
  if (!selectedKeys.value.length) return '未选择'
  const path = findPath(DEPARTMENTS, selectedKeys.value[0])
  return path ? path.join(' / ') : '未选择'
})

// ============================================================
// 交互
// ============================================================

function onSelectedKeys(keys: Array<string | number>): void {
  const key = keys.length ? String(keys[keys.length - 1]) : ''
  if (!key) return

  const node = findNode(DEPARTMENTS, key)
  //! 父部门只负责展开，不能作为选中值
  if (node?.children?.length) {
    rejectCount.value++
    return
  }
  selectedKeys.value = [key]
}

function onExpandedKeys(keys: Array<string | number>): void {
  expandedKeys.value = keys.map(String)
}

watch(keyword, () => {
  //! 搜索后自动展开命中路径，否则结果藏在折叠节点里
  expandedKeys.value = allParentKeys(visibleTree.value)
})

function reset(): void {
  keyword.value = ''
  selectedKeys.value = []
  expandedKeys.value = allParentKeys(decoratedTree)
  rejectCount.value = 0
  flatValue.value = null
}

expandedKeys.value = allParentKeys(decoratedTree)
</script>

<template>
  <div class="dt-demo">
    <p class="hint">
      部门有层级：平铺下拉会把同名小组混在一起，树形选择能看清路径。父部门只负责展开，
      真正可选的是末级部门。
    </p>

    <div class="toolbar">
      <n-input
        v-model:value="keyword"
        class="dt-search"
        clearable
        placeholder="搜索部门，例如 杭州"
      />
      <n-button
        size="small"
        quaternary
        @click="reset"
      >
        重置
      </n-button>
    </div>

    <div class="panels">
      <section class="panel">
        <div class="panel-head">
          <h3>平铺下拉</h3>
          <span class="badge">只有名字</span>
        </div>
        <n-select
          v-model:value="flatValue"
          :options="flatOptions"
          placeholder="选择部门"
        />
        <p class="note">
          「设计组」「运营组」还能分清，但两个「研发组」同名，选完不知道属于哪个部门。
        </p>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h3>部门树</h3>
          <span class="badge">含路径</span>
        </div>
        <n-tree
          class="dt-tree"
          :data="visibleTree"
          key-field="key"
          label-field="label"
          children-field="children"
          selectable
          block-line
          :cancelable="false"
          :selected-keys="selectedKeys"
          :expanded-keys="expandedKeys"
          @update:selected-keys="onSelectedKeys"
          @update:expanded-keys="onExpandedKeys"
        />
        <p class="note">
          父部门标了「含子部门」，点它只会展开；选中末级后下方显示完整路径。
        </p>
      </section>
    </div>

    <dl class="metrics">
      <div class="metric">
        <dt>选中路径</dt>
        <dd
          class="path"
          data-stat="selected-path"
        >
          {{ selectedPath }}
        </dd>
      </div>
      <div class="metric">
        <dt>父级被拒</dt>
        <dd data-stat="reject-count">
          {{ rejectCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>当前可见节点</dt>
        <dd data-stat="visible-count">
          {{ visibleCount }}
        </dd>
      </div>
    </dl>
  </div>
</template>

<style scoped lang="scss">
.dt-demo {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.dt-search {
  width: min(18rem, 100%);
}

.panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.panel {
  min-width: 0;
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.55rem;

  h3 {
    margin: 0;
    font-size: var(--demo-text-md);
  }
}

.dt-tree {
  min-height: 12rem;
  padding: 0.35rem;
  border-radius: 6px;
  background: var(--bg);
}

.note {
  margin: 0.6rem 0 0;
  color: var(--text-muted);
  font-size: var(--demo-text-xs);
  line-height: 1.7;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
}

.metric {
  min-width: 0;
  padding: 0.5rem 0.6rem;
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
  text-align: center;

  dt {
    color: var(--text-muted);
    font-size: var(--demo-text-xs);
  }

  dd {
    margin: 0.15rem 0 0;
    font-weight: 600;
  }
}

.path {
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .panels {
    grid-template-columns: minmax(0, 1fr);
  }

  .metrics {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
