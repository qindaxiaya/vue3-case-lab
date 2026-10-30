// ============================================================
// 案例：computed 缓存 vs 方法 vs watch（computed-cache）
// - computed 有缓存：依赖不变就不重算
// - 模板里的方法调用：每次渲染都执行（与依赖是否变化无关）
// - watch：只在依赖变化时触发（但它是副作用，不产生值）
// 点「改无关状态」→ 渲染次数涨、方法调用涨、computed 与 watch 计数不动
// ============================================================
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

// ============================================================
// 数据源：price / qty 是相关状态，noise 是无关状态
// ============================================================

const price = ref(120)
const qty = ref(2)
const noise = ref(0)

// ============================================================
// 计数（普通变量 + 一个 tick 驱动刷新）
// ============================================================

/** computed 求值次数 */
let computedRuns = 0
/** 方法调用次数（每次渲染都会 +1，可当作渲染次数看） */
let methodCalls = 0
/** 手动刷新信号（重置普通变量后触发一次渲染） */
const tick = ref(0)
/** watch 回调次数（响应式 ref，可直接展示） */
const watchHits = ref(0)

// ============================================================
// 三种取值方式
// ============================================================

/**
 * //! computed：读取时若依赖（price/qty）未变，直接返回缓存值
 */
const computedTotal = computed(() => {
  computedRuns++
  return price.value * qty.value
})

/**
 * //! 普通方法：模板每次渲染都会重新调用一次（没有缓存）
 */
function methodTotal(): number {
  methodCalls++
  return price.value * qty.value
}

/**
 * //! watch：依赖变化才触发；它不返回值，只做副作用
 */
watch([price, qty], () => {
  watchHits.value++
})

// ============================================================
// 操作
// ============================================================

/** 改无关状态：只应影响渲染次数与方法调用 */
function bumpNoise(): void {
  noise.value++
}

/** 改相关状态：三者都应变化 */
function bumpPrice(): void {
  price.value += 10
}

function resetAll(): void {
  price.value = 120
  qty.value = 2
  noise.value = 0
  computedRuns = 0
  methodCalls = 0
  watchHits.value = 0
  tick.value++
}
</script>

<template>
  <div
    class="cc-demo"
    :data-tick="tick"
  >
    <!-- 数据源 -->
    <div class="cc-source">
      <span class="cc-label">数据源</span>
      <span class="pill">price = {{ price }}</span>
      <span class="pill">qty = {{ qty }}</span>
      <span class="pill pill--noise">无关状态 noise = {{ noise }}</span>
    </div>

    <!-- 三种取值对比 -->
    <div class="cc-grid">
      <section class="cc-card">
        <h3>computed</h3>
        <p class="cc-value">
          {{ computedTotal }}
        </p>
        <p class="cc-count">
          求值 <b>{{ computedRuns }}</b> 次
        </p>
        <p class="cc-note">
          依赖不变 → 读缓存，不重算
        </p>
      </section>

      <section class="cc-card">
        <h3>方法调用</h3>
        <p class="cc-value">
          {{ methodTotal() }}
        </p>
        <p class="cc-count">
          调用 <b>{{ methodCalls }}</b> 次
        </p>
        <p class="cc-note">
          每次渲染都执行一次
        </p>
      </section>

      <section class="cc-card">
        <h3>watch</h3>
        <p class="cc-value">
          {{ watchHits }} 次
        </p>
        <p class="cc-count">
          方法调用 <b>{{ methodCalls }}</b> 次
        </p>
        <p class="cc-note">
          不产生值，只做副作用；方法调用数 ≈ 渲染次数
        </p>
      </section>
    </div>

    <!-- 操作 -->
    <div class="cc-actions">
      <n-button
        type="primary"
        @click="bumpNoise"
      >
        改无关状态 noise++
      </n-button>
      <n-button
        type="primary"
        @click="bumpPrice"
      >
        改相关状态 price += 10
      </n-button>
      <n-button
        @click="resetAll"
      >
        重置
      </n-button>
    </div>

    <p class="cc-hint">
      点「改无关状态」：渲染 +1、方法 +1，而 computed 与 watch 计数不动 —— 这就是缓存。
    </p>
  </div>
</template>

<style scoped>
.cc-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

/* ---------- 数据源 ---------- */

.cc-source {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.cc-label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.pill {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  background-color: var(--code-bg);
  color: var(--text);
}

.pill--noise {
  color: var(--warning);
}

/* ---------- 三卡 ---------- */

.cc-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
}

.cc-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.7rem;
  text-align: center;

  h3 {
    margin: 0 0 0.2rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
  }
}

.cc-value {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--primary);
}

.cc-count {
  margin: 0.15rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--text);
  }
}

.cc-note {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* ---------- 操作 ---------- */

.cc-actions {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}





.cc-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

@media (max-width: 760px) {
  .cc-grid {
    grid-template-columns: 1fr;
  }
}
</style>
