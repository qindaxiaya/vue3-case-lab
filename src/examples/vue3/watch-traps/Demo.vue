// ============================================================
// 案例：watch/watchEffect 三大陷阱（watch-traps）
// 1. reactive 深层属性：不加 deep 不触发 vs deep:true 触发
// 2. 过期异步：onCleanup 取消旧请求（只有最后一次生效）
// 3. flush 时机：sync 立即 / pre 渲染前 / post 渲染后（读 DOM）
// 每个实验区独立状态 + 重置按钮 + 时间戳日志
// ============================================================
<script setup lang="ts">
import { nextTick, onUnmounted, reactive, ref, watch } from 'vue'

// ============================================================
// 实验 1：deep 陷阱
// ============================================================

const obj = reactive({ nested: { count: 0 } })
/** 无 deep 的触发计数 */
const plainHits = ref(0)
/** deep:true 的触发计数 */
const deepHits = ref(0)
const log1 = ref<string[]>([])

function now(): string {
  const d = new Date()
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

//! watch(reactive 对象) 默认浅监听：只盯引用本身——改嵌套属性不触发
watch(obj, () => {
  plainHits.value++
  log1.value.unshift(`[${now()}] 无 deep 触发 (引用级)`)
  if (log1.value.length > 5) log1.value.pop()
})

//! deep: true 深递归收集嵌套属性——改任何层级都触发（代价：大对象开销大）
watch(
  obj,
  () => {
    deepHits.value++
    log1.value.unshift(`[${now()}] deep 触发 (深层)`)
    if (log1.value.length > 5) log1.value.pop()
  },
  { deep: true },
)

function bumpNested(): void {
  obj.nested.count++
}

function resetExp1(): void {
  obj.nested.count = 0
  plainHits.value = 0
  deepHits.value = 0
  log1.value = []
}

// ============================================================
// 实验 2：过期异步（onCleanup）
// ============================================================

const reqNo = ref(0)
const log2 = ref<string[]>([])
/** 最近完成的请求号（"只有最后一次生效"的直观证据） */
const finishedReq = ref(0)

//! watch 的异步回调：onCleanup 注册取消函数——新一次触发或组件卸载时先跑 cleanup
watch(
  reqNo,
  (no, _oldNo, onCleanup) => {
    log2.value.unshift(`[${now()}] 请求 #${no} 发出…`)
    if (log2.value.length > 6) log2.value.pop()

    let cancelled = false
    // 注册清理：下次 watch 触发前 / 卸载时执行
    onCleanup(() => {
      cancelled = true
      log2.value.unshift(`[${now()}] 请求 #${no} 已取消（过期）`)
      if (log2.value.length > 6) log2.value.pop()
    })

    // 模拟异步：耗时随请求号递增（先点两次看取消效果）
    const cost = 400 + no * 200
    setTimeout(() => {
      if (cancelled) return // 被 cleanup 标记，丢弃结果
      finishedReq.value = no
      log2.value.unshift(`[${now()}] 请求 #${no} 完成 (${cost}ms)`)
      if (log2.value.length > 6) log2.value.pop()
    }, cost)
  },
)

/** 连点两次：第二次触发时第一次被 cleanup 取消，完成的永远是最后一次 */
function fireRequest(): void {
  reqNo.value++
}

function resetExp2(): void {
  reqNo.value = 0
  finishedReq.value = 0
  log2.value = []
}

// ============================================================
// 实验 3：flush 时机
// ============================================================

const inputVal = ref('')
const log3 = ref<string[]>([])
/** 模板里的 span ref（post 实验要读渲染后的 DOM） */
const domRef = ref<HTMLElement | null>(null)

function pushLog3(msg: string): void {
  log3.value.unshift(`[${now()}] ${msg}`)
  if (log3.value.length > 6) log3.value.pop()
}

//! flush: 'sync'——每次响应式变更立即跑（回调里读到的是旧 DOM）
watch(
  inputVal,
  (v) => {
    pushLog3(`sync 回调：value="${v}" DOM="${domRef.value?.textContent ?? ''}"`)
  },
  { flush: 'sync' },
)

//! 默认 flush: 'pre'——渲染前跑：value 新、DOM 还没更新（空）
watch(inputVal, (v) => {
  pushLog3(`pre  回调：value="${v}" DOM="${domRef.value?.textContent ?? ''}"`)
})

//! flush: 'post'——渲染后跑：value 与 DOM 都已同步
watch(inputVal, (v) => {
  pushLog3(`post 回调：value="${v}" DOM="${domRef.value?.textContent ?? ''}"`)
})

async function resetExp3(): Promise<void> {
  inputVal.value = ''
  log3.value = []
  // 清空后等一拍，让 DOM 回到空串（下次实验基线一致）
  await nextTick()
}

// ---------- 卸载：stop 未销毁的 watcher（自动注册的无需手动，本例显式演示） ----------
// Vue 自动创建的 watcher 随组件卸载自动停止，这里不需额外清理。

onUnmounted(() => {
  // 防御性空清理：提醒真实项目里手动 watch 要保存 stopHandle
})
</script>

<template>
  <div class="traps-demo">
    <!-- 实验 1：deep -->
    <section
      class="exp"
      aria-label="deep 陷阱实验"
    >
      <header class="exp-head">
        <h3>1 · deep 陷阱</h3>
        <button
          class="btn-reset"
          @click="resetExp1"
        >
          重置
        </button>
      </header>
      <p class="exp-desc">
        改嵌套属性：<code>nested.count</code>。无 deep 只盯引用→不触发；deep 才递归收集。
      </p>
      <div class="exp-row">
        <button
          class="btn-act"
          @click="bumpNested"
        >
          nested.count++
        </button>
        <span class="metric">
          值 <b>{{ obj.nested.count }}</b> ·
          无 deep <b>{{ plainHits }}</b> 次 ·
          deep <b>{{ deepHits }}</b> 次
        </span>
      </div>
      <ul class="mini-log">
        <li
          v-for="(l, i) in log1"
          :key="i"
        >
          {{ l }}
        </li>
      </ul>
    </section>

    <!-- 实验 2：过期异步 -->
    <section
      class="exp"
      aria-label="过期异步实验"
    >
      <header class="exp-head">
        <h3>2 · onCleanup 取消过期异步</h3>
        <button
          class="btn-reset"
          @click="resetExp2"
        >
          重置
        </button>
      </header>
      <p class="exp-desc">
        快速点两次：第二次触发时第一次被取消，完成的永远是最后一次。
      </p>
      <div class="exp-row">
        <button
          class="btn-act"
          @click="fireRequest"
        >
          发起异步请求
        </button>
        <span class="metric">
          发出 <b>{{ reqNo }}</b> 次 · 完成的是 <b>#{{ finishedReq || '—' }}</b>
        </span>
      </div>
      <ul class="mini-log">
        <li
          v-for="(l, i) in log2"
          :key="i"
        >
          {{ l }}
        </li>
      </ul>
    </section>

    <!-- 实验 3：flush -->
    <section
      class="exp"
      aria-label="flush 时机实验"
    >
      <header class="exp-head">
        <h3>3 · flush 时机（sync / pre / post）</h3>
        <button
          class="btn-reset"
          @click="resetExp3"
        >
          重置
        </button>
      </header>
      <p class="exp-desc">
        输入任意字符：看三个回调里 DOM 值的差异（sync 读旧 DOM，post 已同步）。
      </p>
      <div class="exp-row">
        <input
          v-model="inputVal"
          class="exp-input"
          placeholder="输入触发三种 flush…"
        >
        <span
          ref="domRef"
          class="metric"
        >DOM 显示：{{ inputVal }}</span>
      </div>
      <ul class="mini-log">
        <li
          v-for="(l, i) in log3"
          :key="i"
        >
          {{ l }}
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.traps-demo {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

/* ---------- 实验卡片 ---------- */

.exp {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.75rem;
  background-color: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.exp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h3 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }
}

.exp-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.05rem 0.3rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}

.exp-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.metric {
  font-size: 0.875rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

/* ---------- 按钮 ---------- */

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

.btn-reset {
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover {
    color: var(--text);
    border-color: var(--text-secondary);
  }
}

/* ---------- 输入框 ---------- */

.exp-input {
  flex: 1;
  min-width: 120px;
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: var(--bg);
  color: var(--text);
  font-size: 0.875rem;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

/* ---------- 日志 ---------- */

.mini-log {
  list-style: none;
  padding: 0.4rem 0.5rem;
  margin: 0;
  background-color: var(--code-bg);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.9;
  color: var(--text-secondary);
  min-height: 5.4rem;
}

/* 小屏：三栏折行 */
@media (max-width: 900px) {
  .traps-demo {
    grid-template-columns: 1fr;
  }
}
</style>
