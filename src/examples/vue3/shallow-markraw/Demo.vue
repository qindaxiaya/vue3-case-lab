// ============================================================
// 案例：shallowRef / markRaw 性能边界（shallow-markraw）
// - 深响应 vs shallowRef vs markRaw 三种包裹的触发行为对比
// - 同一操作量级下「响应式开销计数」实时对比（proxy 代理层触发次数）
// - triggerRef 手动触发 shallowRef 顶层替换
// ============================================================
<script setup lang="ts">
import { markRaw, reactive, ref, shallowRef, triggerRef } from 'vue'

// ---------- 数据：同一份数据结构，三种包裹 ----------

/** 原始数据工厂：1000 个嵌套对象（模拟大列表/大状态） */
function makeBig(): { list: { id: number; nested: { v: number } }[] } {
  return {
    list: Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      nested: { v: 0 },
    })),
  }
}

/** 深响应：每个 nested.v 都被 proxy 代理 */
const deepState = reactive(makeBig())
/** shallowRef：只代理 .value 本身，list 数组内容不递归 */
const shallowState = shallowRef(makeBig())
/** markRaw：对象永不被转 proxy（塞进 ref 也不深代理） */
const rawState = ref(markRaw(makeBig()))

// ---------- 操作计数（触发即 +1，直观对比开销边界） ----------

const deepHits = ref(0)
const shallowHits = ref(0)
const rawHits = ref(0)

// ---------- 操作 ----------

/** 深响应：改嵌套属性 → 精确触发（代理收集到了 nested.v） */
function deepBump(): void {
  deepState.list[0].nested.v++
  deepHits.value++
}

/** shallowRef：改嵌套属性 → 不触发（未收集深层依赖） */
function shallowBump(): void {
  // list 本身不是响应式代理——改它毫无触发
  shallowState.value.list[0].nested.v++
  // 注意：这里 shallowHits 不加——因为 watcher 根本不会响应
}

/** shallowRef：替换整个 .value → 触发 */
function shallowReplace(): void {
  shallowState.value = makeBig()
  shallowHits.value++
}

/** shallowRef：顶层属性手动触发（不替换 .value 的场景） */
function shallowTrigger(): void {
  shallowState.value.list[0].nested.v++
  triggerRef(shallowState) // 手动告诉 Vue：顶层变了
  shallowHits.value++
}

/** markRaw：改嵌套属性 → 永不触发（对象根本不在响应式系统里） */
function rawBump(): void {
  rawState.value.list[0].nested.v++
}

/** markRaw 对象整体替换 .value → 触发（.value 的 ref 本身是响应式的） */
function rawReplace(): void {
  rawState.value = ref(markRaw(makeBig())).value
  rawHits.value++
}

/** 重置全部 */
function resetAll(): void {
  Object.assign(deepState, makeBig())
  shallowState.value = makeBig()
  rawState.value = ref(markRaw(makeBig())).value
  deepHits.value = 0
  shallowHits.value = 0
  rawHits.value = 0
}
</script>

<template>
  <div class="sm-demo">
    <!-- 三种包裹的行为矩阵 -->
    <div class="matrix">
      <!-- 深响应 -->
      <section
        class="cell"
        aria-label="深响应演示"
      >
        <header class="cell-head">
          <h3>reactive（深）</h3>
          <span class="hits">触发 <b>{{ deepHits }}</b> 次</span>
        </header>
        <p class="cell-desc">
          改 <code>list[0].nested.v</code>：代理逐层收集 → <b>精确触发</b>。1000 项全量代理，内存/初始化开销最大。
        </p>
        <div class="cell-row">
          <n-button
            type="primary"
            @click="deepBump"
          >
            改嵌套 .v
          </n-button>
          <span class="metric">v = {{ deepState.list[0].nested.v }}</span>
        </div>
      </section>

      <!-- shallowRef -->
      <section
        class="cell"
        aria-label="shallowRef 演示"
      >
        <header class="cell-head">
          <h3>shallowRef</h3>
          <span class="hits">触发 <b>{{ shallowHits }}</b> 次</span>
        </header>
        <p class="cell-desc">
          改嵌套 <b>不触发</b>；替换整个 <code>.value</code> 或 <code>triggerRef</code> 才触发。大数据首选。
        </p>
        <div class="cell-row">
          <n-button
            quaternary
            @click="shallowBump"
          >
            改嵌套（无反应）
          </n-button>
          <n-button
            type="primary"
            @click="shallowReplace"
          >
            替换 .value
          </n-button>
          <n-button
            type="primary"
            @click="shallowTrigger"
          >
            triggerRef
          </n-button>
        </div>
      </section>

      <!-- markRaw -->
      <section
        class="cell"
        aria-label="markRaw 演示"
      >
        <header class="cell-head">
          <h3>markRaw</h3>
          <span class="hits">触发 <b>{{ rawHits }}</b> 次</span>
        </header>
        <p class="cell-desc">
          对象永不进响应式系统（即使嵌在 ref 里）。适合放 <b>class 实例</b>、第三方库对象（ECharts 实例等）。
        </p>
        <div class="cell-row">
          <n-button
            quaternary
            @click="rawBump"
          >
            改嵌套（无反应）
          </n-button>
          <n-button
            type="primary"
            @click="rawReplace"
          >
            替换 .value
          </n-button>
          <n-button
            @click="resetAll"
          >
            重置
          </n-button>
        </div>
      </section>
    </div>

    <p class="footnote">
      计数口径：每点一次按钮 +1（浅/markRaw 的嵌套操作因不触发 watcher，计数不变——这正是「不触发 = 零开销」的证明）。
    </p>
  </div>
</template>

<style scoped>
.sm-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

/* ---------- 行为矩阵 ---------- */

.matrix {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.cell {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.75rem;
  background-color: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cell-head {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h3 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
  }
}

.hits {
  font-size: 0.8125rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.cell-desc {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.65;
  color: var(--text-secondary);

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.05rem 0.25rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }

  b {
    color: var(--text);
  }
}

.cell-row {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  align-items: center;
}

.metric {
  font-size: 0.875rem;
  color: var(--text-secondary);

  b,
  & {
    font-family: var(--font-mono);
  }
}

/* ---------- 按钮 ---------- */



/* 「无反应」按钮：视觉弱化，暗示点了也没事 */




.footnote {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

@media (max-width: 900px) {
  .matrix {
    grid-template-columns: 1fr;
  }
}
</style>
