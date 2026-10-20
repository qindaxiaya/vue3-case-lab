// ============================================================
// 案例：effectScope 批量停止副作用（effect-scope）
// 模拟「反复挂载 / 卸载」：不用 effectScope 时 watch + 定时器不断累积；
// 用 effectScope + onScopeDispose 批量创建、一次性 stop，存活数回到 0。
// ============================================================
<script setup lang="ts">
import { effectScope, onScopeDispose, ref, watch } from 'vue'

// ============================================================
// 共享数据源（模拟会被 watch 的全局/store 状态）
// ============================================================

const source = ref(0)

// ============================================================
// 统计
// ============================================================

/** 错误写法：累计存活的副作用数（watch + 定时器） */
const leakedAlive = ref(0)
/** 正确写法：本轮停止后的存活数（应恒为 0） */
const scopedAlive = ref(0)
/** 正确写法：本轮 stop 前的副作用数（证明确实创建过） */
const scopedBeforeStop = ref(0)
/** 累计挂载-卸载轮次 */
const cycles = ref(0)
/** 日志 */
const logs = ref<string[]>([])

/** 错误写法的泄漏资源句柄（只在「重置」时才清） */
let leakedTimers: number[] = []
let leakedStops: (() => void)[] = []

function pushLog(msg: string): void {
  logs.value.unshift(msg)
  if (logs.value.length > 6) logs.value.pop()
}

// ============================================================
// 错误写法：创建后不清理
// ============================================================

/**
 * //! 每个组件实例都创建 10 个 watcher + 10 个定时器，卸载时没人收尾
 * → 反复进出页面，内存和回调队列持续膨胀
 */
function mountWrong(): void {
  for (let i = 0; i < 10; i++) {
    leakedTimers.push(window.setInterval(() => {}, 60 * 60 * 1000))
    // watch 返回 stop 句柄，但我们故意不调用（模拟组件没在 onUnmounted 清理）
    leakedStops.push(watch(source, () => {}))
  }
  leakedAlive.value = leakedTimers.length + leakedStops.length
  cycles.value++
  pushLog(`❌ 第 ${cycles.value} 轮：泄漏累计 ${leakedAlive.value} 个（watch ${leakedStops.length} + timer ${leakedTimers.length}）`)
}

// ============================================================
// 正确写法：effectScope 统一收口
// ============================================================

/**
 * //! effectScope() 创建一个「副作用作用域」：
 * scope.run() 内创建的 watch / computed / 定时器（配合 onScopeDispose）归它管
 * scope.stop() 一次性全部停止，且可重复执行
 */
function mountRight(): void {
  let beforeStop = 0

  for (let i = 0; i < 10; i++) {
    const scope = effectScope()
    scope.run(() => {
      // 定时器：onScopeDispose 注册清理回调（scope.stop 时执行）
      const timer = window.setInterval(() => {}, 60 * 60 * 1000)
      onScopeDispose(() => window.clearInterval(timer))

      // watch：作用域内的监听器会被自动 stop
      watch(source, () => {})
    })

    // 记录 stop 前的作用域内副作用数（watch 通常 1 个；定时器不算 effect）
    beforeStop += scope.effects.length
    scope.stop()
    // stop 后 scope.effects 已被清空
    scopedAlive.value += scope.effects.length
  }
  scopedBeforeStop.value = beforeStop
  cycles.value++
  pushLog(`✅ 第 ${cycles.value} 轮：stop 前 ${beforeStop} 个 effect → stop 后累计存活 ${scopedAlive.value} 个`)
}

// ============================================================
// 触发 source（看看错误写法下这些 watcher 还在不在跑）
// ============================================================

const sourceHits = ref(0)
watch(source, () => {
  sourceHits.value++
})

function bumpSource(): void {
  source.value++
}

// ============================================================
// 重置：把泄漏资源真正清掉
// ============================================================

function resetAll(): void {
  leakedTimers.forEach((t) => window.clearInterval(t))
  leakedStops.forEach((stop) => stop())
  leakedTimers = []
  leakedStops = []
  leakedAlive.value = 0
  scopedAlive.value = 0
  scopedBeforeStop.value = 0
  cycles.value = 0
  sourceHits.value = 0
  logs.value = []
}
</script>

<template>
  <div class="scope-demo">
    <!-- 说明 -->
    <p class="scope-intro">
      模拟「页面反复进入 / 离开」：每次卸载都创建一批副作用。看右侧存活数会不会回落。
    </p>

    <!-- 两个实验区 -->
    <div class="scope-grid">
      <section
        class="scope-card"
        aria-label="未清理副作用实验"
      >
        <header class="scope-head">
          <h3>❌ 不清理</h3>
          <span class="scope-count danger">{{ leakedAlive }}</span>
        </header>
        <p class="scope-desc">
          每轮创建 10 个 <code>watch</code> + 10 个 <code>setInterval</code>，卸载不 stop → 只涨不降。
        </p>
        <button
          class="btn-act"
          @click="mountWrong"
        >
          挂载并卸载 1 轮
        </button>
      </section>

      <section
        class="scope-card"
        aria-label="effectScope 实验"
      >
        <header class="scope-head">
          <h3>✅ effectScope</h3>
          <span class="scope-count success">{{ scopedAlive }}</span>
        </header>
        <p class="scope-desc">
          每轮建一个 scope，<code>scope.stop()</code> 一键收口；<code>onScopeDispose</code> 清定时器。
        </p>
        <button
          class="btn-act"
          @click="mountRight"
        >
          挂载并卸载 1 轮
        </button>
        <p class="scope-meta">
          stop 前 effects：<b>{{ scopedBeforeStop }}</b> → stop 后：<b>{{ scopedAlive }}</b>
        </p>
      </section>
    </div>

    <!-- 触发源 -->
    <div class="scope-row">
      <button
        class="btn-ghost-line"
        @click="bumpSource"
      >
        source++（触发所有存活 watcher）
      </button>
      <span class="scope-meta">
        source = <b>{{ source }}</b> · 外部 watcher 触发 <b>{{ sourceHits }}</b> 次
      </span>
      <button
        class="btn-reset"
        @click="resetAll"
      >
        重置
      </button>
    </div>

    <!-- 日志 -->
    <ul class="scope-log">
      <li
        v-for="(l, i) in logs"
        :key="i"
      >
        {{ l }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.scope-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.scope-intro {
  margin: 0;
  font-size: 0.76rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* ---------- 两卡 ---------- */

.scope-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.scope-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.scope-head {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h3 {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text);
  }
}

.scope-count {
  font-family: var(--font-mono);
  font-size: 1.15rem;
  font-weight: 700;

  &.danger {
    color: var(--danger);
  }

  &.success {
    color: var(--success);
  }
}

.scope-desc {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.7;
  color: var(--text-secondary);

  code {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 0.02rem 0.25rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}

.scope-meta {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

/* ---------- 操作 ---------- */

.scope-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-act {
  align-self: flex-start;
  padding: 0.28rem 0.65rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.75rem;
  cursor: pointer;

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

.btn-ghost-line {
  padding: 0.28rem 0.65rem;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;

  &:hover {
    color: var(--text);
    border-color: var(--text-secondary);
  }
}

.btn-reset {
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.72rem;
  cursor: pointer;

  &:hover {
    color: var(--text);
  }
}

/* ---------- 日志 ---------- */

.scope-log {
  list-style: none;
  margin: 0;
  padding: 0.4rem 0.55rem;
  background-color: var(--code-bg);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  line-height: 1.9;
  color: var(--text-secondary);
  min-height: 5rem;
}

@media (max-width: 760px) {
  .scope-grid {
    grid-template-columns: 1fr;
  }
}
</style>
