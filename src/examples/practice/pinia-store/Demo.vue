// ============================================================
// 案例：状态管理（Pinia 范式 + 持久化 + 拆分）
// 站点自身不引 Pinia，这里用 20 行等价实现演示「setup store」的核心：
// 1. 一个 reactive 状态 + 一组方法（= Pinia setup store）
// 2. watch deep → localStorage 持久化（= 持久化插件）
// 3. 两个互不相关的组件共享同一模块状态（= 跨组件/跨模块）
// 页面下方给出真实 Pinia 的对应写法
// ============================================================
<script setup lang="ts">
/* eslint-disable vue/one-component-per-file -- 两个内联组件用于演示跨组件共享状态 */
import { defineComponent, h, reactive, ref, watch } from 'vue'

const STORAGE_KEY = 'moyu-demo-store'

// ============================================================
// 模块级 store（等价于 defineStore('demo', () => { ... })）
// ============================================================

interface DemoState {
  count: number
  user: string
  todos: string[]
}

/** 初始值 */
function initialState(): DemoState {
  return { count: 0, user: '张三', todos: ['学习 Vue', '写案例'] }
}

/** //! 模块级 reactive：所有组件 import 到的是同一个实例 */
const store = reactive<DemoState>(initialState())

/** 恢复持久化数据（刷新不丢） */
function restore(): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as Partial<DemoState>
    if (typeof saved.count === 'number') store.count = saved.count
    if (typeof saved.user === 'string') store.user = saved.user
    if (Array.isArray(saved.todos)) store.todos = saved.todos.filter((t) => typeof t === 'string')
  } catch {
    // 数据损坏时忽略，用初始值
  }
}

restore()

/** //! 持久化：等价于 pinia-plugin-persistedstate 的核心一行 */
watch(
  store,
  (value) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  },
  { deep: true },
)

// ============================================================
// store 方法（等价于 setup store 里 return 的 actions）
// ============================================================

function increment(): void {
  store.count++
}

function resetStore(): void {
  Object.assign(store, initialState())
  window.localStorage.removeItem(STORAGE_KEY)
}

function addTodo(text: string): void {
  const t = text.trim()
  if (t) store.todos.push(t)
}

// ============================================================
// 两个独立组件：共享同一 store
// ============================================================

const CounterPanel = defineComponent({
  name: 'CounterPanel',
  setup() {
    return () =>
      h('div', { class: 'ps-panel' }, [
        h('h4', '组件 A：计数器'),
        h('p', { class: 'ps-big' }, String(store.count)),
        h(
          'button',
          { class: 'ps-btn', onClick: increment },
          '+1（改的是共享 store）',
        ),
      ])
  },
})

const TodoPanel = defineComponent({
  name: 'TodoPanel',
  setup() {
    const input = ref('')
    return () =>
      h('div', { class: 'ps-panel' }, [
        h('h4', '组件 B：待办'),
        h('ul', { class: 'ps-list' }, store.todos.map((t) => h('li', { key: t }, t))),
        h('div', { class: 'ps-add' }, [
          h('input', {
            class: 'ps-input',
            value: input.value,
            placeholder: '新增待办',
            onInput: (e: Event) => {
              input.value = (e.target as HTMLInputElement).value
            },
            onKeydown: (e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                addTodo(input.value)
                input.value = ''
              }
            },
          }),
          h(
            'button',
            {
              class: 'ps-btn',
              onClick: () => {
                addTodo(input.value)
                input.value = ''
              },
            },
            '添加',
          ),
        ]),
      ])
  },
})

// ============================================================
// 用户信息（展示跨模块修改）
// ============================================================

const nameDraft = ref(store.user)

function rename(): void {
  store.user = nameDraft.value.trim() || '匿名'
}

function resetAll(): void {
  resetStore()
  nameDraft.value = store.user
}
</script>

<template>
  <div class="ps-demo">
    <!-- 共享状态 -->
    <section class="ps-user">
      <span class="ps-label">共享用户：<b>{{ store.user }}</b></span>
      <input
        v-model="nameDraft"
        class="ps-input"
        placeholder="改名"
        @keydown.enter="rename"
      >
      <n-button
        type="primary"
        @click="rename"
      >
        改名
      </n-button>
      <n-button
        @click="resetAll"
      >
        重置全部
      </n-button>
    </section>

    <!-- 两个组件共享同一 store -->
    <div class="ps-grid">
      <CounterPanel />
      <TodoPanel />
    </div>

    <p class="ps-hint">
      组件 A 的 +1 与组件 B 的待办操作都改同一个 <code>reactive</code>，互不相关但状态同步；
      修改后刷新页面，值仍在（localStorage）。
    </p>

    <!-- 真实 Pinia 写法 -->
    <section class="ps-code">
      <h3>真实项目里的 Pinia 写法</h3>
      <pre>// stores/demo.ts
export const useDemoStore = defineStore('demo', () => {
  const count = ref(0)
  const user = ref('张三')
  const todos = ref&lt;string[]&gt;([])

  function increment() { count++ }

  return { count, user, todos, increment }
}, {
  // pinia-plugin-persistedstate
  persist: { key: 'moyu-demo-store' },
})

// 组件里
const store = useDemoStore()
store.increment()
// 解构要保持响应式：storeToRefs(store)</pre>
      <p class="ps-warn">
        ⚠️ 本 Demo 用 20 行等价实现讲原理；真实项目直接装 Pinia + 持久化插件，不要手写。
      </p>
    </section>
  </div>
</template>

<style scoped>
.ps-demo {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

/* ---------- 用户行 ---------- */

.ps-user {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.ps-label {
  font-size: 0.8125rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.ps-input {
  padding: 0.28rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
  color: var(--text);
  font-size: 0.8125rem;
  width: 9rem;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.ps-btn {
  padding: 0.26rem 0.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

.ps-btn--ghost {
  border-color: var(--border);
  color: var(--text-secondary);

  &:hover {
    background-color: transparent;
    color: var(--text);
  }
}

/* ---------- 两个面板 ---------- */

.ps-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

/* 内联组件渲染的节点没有 scoped 属性，用 :deep 穿透 */
.ps-demo :deep(.ps-panel) {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  h4 {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text);
  }
}

.ps-demo :deep(.ps-big) {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
}

.ps-demo :deep(.ps-btn) {
  align-self: flex-start;
  padding: 0.26rem 0.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.8125rem;
  cursor: pointer;
}

.ps-demo :deep(.ps-list) {
  margin: 0;
  padding-left: 1rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.8;
}

.ps-demo :deep(.ps-add) {
  display: flex;
  gap: 0.35rem;
}

.ps-demo :deep(.ps-input) {
  flex: 1;
  min-width: 0;
  padding: 0.26rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
  color: var(--text);
  font-size: 0.8125rem;
}

/* ---------- 说明 ---------- */

.ps-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.02rem 0.24rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}

.ps-code {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.7rem;

  h3 {
    margin: 0 0 0.35rem;
    font-size: 0.875rem;
    color: var(--text);
  }

  pre {
    margin: 0;
    padding: 0.5rem 0.6rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.65;
    color: var(--text-secondary);
    overflow-x: auto;
  }
}

.ps-warn {
  margin: 0.4rem 0 0;
  font-size: 0.8125rem;
  color: var(--warning);
  line-height: 1.6;
}

@media (max-width: 760px) {
  .ps-grid {
    grid-template-columns: 1fr;
  }
}
</style>
