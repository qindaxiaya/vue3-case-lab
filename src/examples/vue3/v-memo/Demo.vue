// ============================================================
// 案例：v-memo 渲染缓存（v-memo）
// - 200 行列表 + v-memo="[row.id, row.text]"：依赖数组没变就跳过整棵子树 patch
// - 每行渲染次数用非响应式 Map 计数（render 中写入——v-memo 跳过时计数不涨，语义即证明）
// - 「无关更新」按钮：改全局 tick——无 v-memo 时 200 行全部重渲染，有 v-memo 零行重渲染
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

// ---------- 数据 ----------

/** 行数（200 行足以感知差异） */
const ROW_COUNT = 200

interface Row {
  id: number
  text: string
}

const rows = ref<Row[]>(
  Array.from({ length: ROW_COUNT }, (_, i) => ({
    id: i,
    text: `初始内容 ${i}`,
  })),
)

/** 无关状态：更新它不该影响任何一行（v-memo 的价值证明） */
const globalTick = ref(0)

/**
 * 每行渲染次数（非响应式 Map）——
 * 关键手法：在模板 render 过程中写入；v-memo 命中缓存跳过 patch 时这段代码不执行，
 * 计数自然不涨。「计数总和」就是全列表的真实渲染开销。
 */
const renderCounts = new Map<number, number>()

function countRender(id: number): number {
  renderCounts.set(id, (renderCounts.get(id) ?? 0) + 1)
  return renderCounts.get(id)!
}

/** 总渲染次数（只在显示时求和，非响应式依赖） */
const totalRenders = computed(() => {
  let sum = 0
  renderCounts.forEach((v) => {
    sum += v
  })
  return sum
})

// ---------- 操作 ----------

/** 随机改一行文本（该行依赖变化 → v-memo 失效 → 只 patch 这一行） */
function editRandomRow(): void {
  const idx = Math.floor(Math.random() * ROW_COUNT)
  rows.value[idx].text = `已修改 ${Date.now() % 100000}`
}

/** 改指定行 */
function editRow(idx: number): void {
  rows.value[idx].text = `已修改 ${Date.now() % 100000}`
}

/** 无关更新：tick 变化不在任何行的 v-memo 依赖数组里 → 全列表零重渲染 */
function bumpTick(): void {
  globalTick.value++
}

/** 重置渲染计数 */
function resetCounts(): void {
  renderCounts.clear()
}
</script>

<template>
  <div class="vm-demo">
    <!-- 控制行 -->
    <div class="controls">
      <button
        class="btn-act"
        @click="editRandomRow"
      >
        随机改一行
      </button>
      <button
        class="btn-act"
        @click="editRow(0)"
      >
        改第 1 行
      </button>
      <button
        class="btn-act btn-act--warn"
        @click="bumpTick"
      >
        无关更新 tick++（{{ globalTick }}）
      </button>
      <button
        class="btn-reset"
        @click="resetCounts"
      >
        重置计数
      </button>
      <span class="stat">
        总渲染 <b>{{ totalRenders }}</b> 次 · 基线 {{ ROW_COUNT }} 行 × 首次渲染
      </span>
    </div>

    <!-- 列表：v-memo 依赖数组 = [row.id, row.text] -->
    <div class="list">
      <div
        v-for="row in rows"
        :key="row.id"
        v-memo="[row.id, row.text]"
        class="row"
        :class="{ 'row--edited': row.text.startsWith('已修改') }"
      >
        <span class="row-id">#{{ row.id }}</span>
        <span class="row-text">{{ row.text }}</span>
        <span class="row-count">渲染 ×{{ countRender(row.id) }}</span>
      </div>
    </div>

    <p class="footnote">
      点「无关更新」：tick 不在依赖数组里，v-memo 命中缓存——总渲染次数<b>不涨</b>；
      若无 v-memo，200 行每次全量重渲染。点「随机改一行」：该行 text 变化 → 只这一行 +1。
    </p>
  </div>
</template>

<style scoped>
.vm-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-act {
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.875rem;
  cursor: pointer;

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

.btn-act--warn {
  border-color: var(--warning);
  color: var(--warning);

  &:hover {
    background-color: var(--warning);
    color: #fff;
  }
}

.btn-reset {
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;

  &:hover {
    color: var(--text);
    border-color: var(--text-secondary);
  }
}

.stat {
  font-size: 0.875rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

/* ---------- 列表 ---------- */

.list {
  height: 320px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.3rem;
  contain: strict;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  height: 28px;
  padding: 0 0.6rem;
  font-size: 0.8125rem;
  border-bottom: 1px solid var(--border);
}

.row--edited {
  background-color: color-mix(in srgb, var(--primary) 8%, transparent);
}

.row-id {
  font-family: var(--font-mono);
  color: var(--text-secondary);
  width: 3em;
}

.row-text {
  flex: 1;
  color: var(--text);
}

.row-count {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--primary);
}

.footnote {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.7;
  color: var(--text-secondary);

  b {
    color: var(--text);
  }
}
</style>
