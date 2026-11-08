// ============================================================
// 案例：transfer-list 穿梭框
// 搜索、禁用项、已选计数，移动时都不能丢
// ============================================================

<script setup lang="ts">
import { computed, ref } from 'vue'

// ============================================================
// 数据与状态
// ============================================================

interface TransferItem {
  id: number
  label: string
  disabled: boolean
}

const initialItems: TransferItem[] = [
  { id: 1, label: '用户管理', disabled: false },
  { id: 2, label: '角色管理', disabled: false },
  { id: 3, label: '报表查看', disabled: false },
  { id: 4, label: '报表导出', disabled: false },
  { id: 5, label: '审计日志', disabled: false },
  { id: 6, label: '系统设置', disabled: true },
]

/** 重置时复制一份新对象，避免把移动过的引用再塞回源列表 */
function createSource(): TransferItem[] {
  return initialItems.map((item) => ({ ...item }))
}

const source = ref<TransferItem[]>(createSource())
const target = ref<TransferItem[]>([])
const selectedSource = ref<number[]>([])
const selectedTarget = ref<number[]>([])
const keyword = ref('')

// ============================================================
// 派生状态
// ============================================================

function matches(item: TransferItem): boolean {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return true
  return item.label.toLowerCase().includes(text)
}

/** 搜索只影响显示，不改变已选；隐藏的已选项仍然保留在数组里 */
const sourceVisible = computed(() => source.value.filter(matches))
const targetVisible = computed(() => target.value.filter(matches))
const visibleCount = computed(
  () => sourceVisible.value.length + targetVisible.value.length,
)
const selectedCount = computed(
  () => selectedSource.value.length + selectedTarget.value.length,
)
const disabledCount = computed(
  () =>
    source.value.filter((item) => item.disabled).length +
    target.value.filter((item) => item.disabled).length,
)

// ============================================================
// 选择与移动
// ============================================================

function toggleSource(id: number, checked: boolean): void {
  if (checked) {
    if (!selectedSource.value.includes(id)) {
      selectedSource.value = [...selectedSource.value, id]
    }
    return
  }
  selectedSource.value = selectedSource.value.filter((itemId) => itemId !== id)
}

function toggleTarget(id: number, checked: boolean): void {
  if (checked) {
    if (!selectedTarget.value.includes(id)) {
      selectedTarget.value = [...selectedTarget.value, id]
    }
    return
  }
  selectedTarget.value = selectedTarget.value.filter((itemId) => itemId !== id)
}

/** 全选只选当前可见且未禁用的源项，禁用项不参与批量移动 */
function selectAllSource(): void {
  selectedSource.value = sourceVisible.value
    .filter((item) => !item.disabled)
    .map((item) => item.id)
}

function moveSelected(): void {
  const ids = new Set(selectedSource.value)
  const moving = source.value.filter((item) => ids.has(item.id) && !item.disabled)
  const movingIds = new Set(moving.map((item) => item.id))
  source.value = source.value.filter((item) => !movingIds.has(item.id))
  target.value = [...target.value, ...moving]
  selectedSource.value = []
}

function moveBack(): void {
  const ids = new Set(selectedTarget.value)
  const moving = target.value.filter((item) => ids.has(item.id))
  const movingIds = new Set(moving.map((item) => item.id))
  target.value = target.value.filter((item) => !movingIds.has(item.id))
  source.value = [...source.value, ...moving]
  selectedTarget.value = []
}

function reset(): void {
  source.value = createSource()
  target.value = []
  selectedSource.value = []
  selectedTarget.value = []
  keyword.value = ''
}
</script>

<template>
  <div class="tl-demo">
    <div class="tl-toolbar">
      <n-input
        v-model:value="keyword"
        data-field="keyword"
        class="tl-search"
        clearable
        placeholder="搜索权限名称"
      />
      <n-button
        size="small"
        @click="selectAllSource"
      >
        全选可移
      </n-button>
      <n-button
        size="small"
        type="primary"
        @click="moveSelected"
      >
        移动选中
      </n-button>
      <n-button
        size="small"
        @click="reset"
      >
        重置
      </n-button>
    </div>

    <div class="tl-panels">
      <section
        class="tl-panel"
        data-side="source"
      >
        <header class="tl-panel-head">
          <strong>可选权限</strong>
          <span>{{ sourceVisible.length }}</span>
        </header>
        <div class="tl-list">
          <n-checkbox
            v-for="item in sourceVisible"
            :key="item.id"
            :data-item="item.id"
            :checked="selectedSource.includes(item.id)"
            :disabled="item.disabled"
            @update:checked="toggleSource(item.id, $event)"
          >
            {{ item.label }}
            <em v-if="item.disabled">禁用</em>
          </n-checkbox>
        </div>
        <p
          v-if="!sourceVisible.length"
          class="tl-empty"
        >
          没有匹配项
        </p>
      </section>

      <div class="tl-middle">
        <n-button
          size="small"
          @click="moveBack"
        >
          移回
        </n-button>
      </div>

      <section
        class="tl-panel"
        data-side="target"
      >
        <header class="tl-panel-head">
          <strong>已选权限</strong>
          <span>{{ targetVisible.length }}</span>
        </header>
        <div class="tl-list">
          <n-checkbox
            v-for="item in targetVisible"
            :key="item.id"
            :data-item="item.id"
            :checked="selectedTarget.includes(item.id)"
            :disabled="item.disabled"
            @update:checked="toggleTarget(item.id, $event)"
          >
            {{ item.label }}
          </n-checkbox>
        </div>
        <p
          v-if="!targetVisible.length"
          class="tl-empty"
        >
          还没有已选权限
        </p>
      </section>
    </div>

    <div class="tl-stats">
      <span>源 <b data-stat="source-count">{{ source.length }}</b></span>
      <span>目标 <b data-stat="target-count">{{ target.length }}</b></span>
      <span>已选 <b data-stat="selected-count">{{ selectedCount }}</b></span>
      <span>禁用 <b data-stat="disabled-count">{{ disabledCount }}</b></span>
      <span>可见 <b data-stat="visible-count">{{ visibleCount }}</b></span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tl-demo {
  display: grid;
  gap: 0.75rem;
}

.tl-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.tl-search {
  width: 14rem;
  max-width: 100%;
}

.tl-panels {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 0.6rem;
  align-items: stretch;
}

.tl-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 15rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  overflow: hidden;
}

.tl-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-subtle);
  font-size: var(--demo-text-sm);
}

.tl-panel-head span {
  min-width: 1.5rem;
  padding: 0.05rem 0.4rem;
  border-radius: var(--radius-tag);
  background: var(--bg);
  color: var(--text-soft);
  font-size: var(--demo-text-xs);
  text-align: center;
}

.tl-list {
  display: grid;
  align-content: start;
  gap: 0.15rem;
  max-height: 18rem;
  padding: 0.5rem;
  overflow-y: auto;
}

.tl-list :deep(.n-checkbox) {
  display: flex;
  width: 100%;
  padding: 0.35rem 0.45rem;
  border-radius: var(--demo-radius);
  font-size: var(--demo-text-sm);
}

.tl-list :deep(.n-checkbox:hover) {
  background: var(--bg-subtle);
}

.tl-list em {
  margin-left: 0.35rem;
  padding: 0.02rem 0.3rem;
  border-radius: var(--radius-tag);
  background: color-mix(in srgb, var(--warning) 14%, var(--bg));
  color: var(--warning);
  font-size: var(--demo-text-xs);
  font-style: normal;
}

.tl-middle {
  display: flex;
  align-items: center;
  justify-content: center;
}

.tl-empty {
  margin: 0;
  padding: 1rem;
  color: var(--text-soft);
  font-size: var(--demo-text-sm);
  text-align: center;
}

.tl-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
  color: var(--text-soft);
  font-size: var(--demo-text-sm);
}

.tl-stats b {
  color: var(--text);
}

@media (max-width: 760px) {
  .tl-panels {
    grid-template-columns: minmax(0, 1fr);
  }

  .tl-middle {
    justify-content: flex-start;
  }

  .tl-panel {
    min-height: 11rem;
  }
}
</style>
