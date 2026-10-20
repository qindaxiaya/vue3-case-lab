// ============================================================
// 案例：响应式依赖注入（reactive-inject）
// 三层结构 Parent → Child → GrandChild（render 函数内联，自包含）
// - provide/inject 传 ref：底层切换、顶层同步（跨层响应式）
// - Symbol key 防污染 + InjectionKey 类型
// - computed 只读注入：底层写操作无效
// - readonly 包裹注入：写操作警告且不生效
// - 每层「谁在读 / 谁在写」日志
// ============================================================
<script setup lang="ts">
/* eslint-disable vue/one-component-per-file -- 内联三层子组件保证「demo源码」自包含 */
import {
  computed,
  defineComponent,
  h,
  inject,
  provide,
  reactive,
  readonly,
  ref,
  type InjectionKey,
  type Ref,
} from 'vue'

// ---------- Symbol key（类型化 InjectionKey，防字符串污染） ----------

/** 主题注入 key（字面量联合类型，切换映射表才能正确索引） */
const THEME_KEY: InjectionKey<Ref<'light' | 'dark' | 'auto'>> = Symbol('theme')
/** 只读计数上限注入 key（computed 只读） */
const MAX_KEY: InjectionKey<Readonly<Ref<number>>> = Symbol('maxCount')
/** readonly 对象注入 key */
const STATE_KEY: InjectionKey<Readonly<{ visits: number }>> = Symbol('state')

// ---------- 顶层状态 ----------

/** 三态主题：亮 / 暗 / 跟随系统 */
const theme = ref<'light' | 'dark' | 'auto'>('light')
/** 可变状态（readonly 注入到底层做写警告演示） */
const state = reactive({ visits: 0 })

/** 日志：每层读/写记录（最新在前） */
const logs = ref<string[]>([])

function log(msg: string): void {
  logs.value.unshift(msg)
  if (logs.value.length > 8) logs.value.pop()
}

// ---------- provide（setup 同步执行，底层 inject 才拿得到） ----------

provide(THEME_KEY, theme)
//! computed 天然只读：底层拿到的只有 getter，赋值无效（也不会警告，静默失败）
provide(
  MAX_KEY,
  computed(() => 10),
)
//! readonly：写操作在开发模式下打警告 + 不生效（比静默失败更友好）
provide(STATE_KEY, readonly(state))

log('[Parent] provide theme/max/readonly-state')

// ---------- 三层子组件（render 函数） ----------

/** Child：中层——读主题、可切换主题（有写权限） */
const Child = defineComponent({
  name: 'Child',
  setup() {
    const t = inject(THEME_KEY)!
    const max = inject(MAX_KEY)!
    log('[Child] inject theme + max')

    return () =>
      h('div', { class: 'ri-child' }, [
        h('p', { class: 'ri-layer' }, 'Child（中层）'),
        h(
          'button',
          {
            class: 'ri-btn',
            onClick: () => {
              // 三态轮换
              const next = { light: 'dark', dark: 'auto', auto: 'light' } as const
              t.value = next[t.value]
              log(`[Child] 写 theme → ${t.value}`)
            },
          },
          `切换主题（当前：${t.value}）`,
        ),
        h('p', { class: 'ri-readonly' }, `只读上限（computed）：${max.value}`),
        h(GrandChild),
      ])
  },
})

/** GrandChild：底层——写只读注入演示 */
const GrandChild = defineComponent({
  name: 'GrandChild',
  setup() {
    const t = inject(THEME_KEY)!
    const max = inject(MAX_KEY)!
    const st = inject(STATE_KEY)!
    log('[GrandChild] inject theme/max/readonly-state')

    return () =>
      h('div', { class: 'ri-grand' }, [
        h('p', { class: 'ri-layer' }, 'GrandChild（底层）'),
        h(
          'button',
          {
            class: 'ri-btn',
            onClick: () => {
              // @ts-expect-error 故意写 readonly 注入——TS 禁止，运行时 Vue 警告且不生效（演示点）
              st.visits++
              log(`[GrandChild] 写 readonly visits → ${st.visits}（开发模式有警告，值不变）`)
            },
          },
          '写 readonly.visits++',
        ),
        h(
          'button',
          {
            class: 'ri-btn ri-btn--danger',
            onClick: () => {
              // @ts-expect-error 故意写只读注入——TS 层面本就报错，运行时静默无效
              max.value = 99
              log('[GrandChild] 写 computed max=99 → 无效（getter 只读，静默失败）')
            },
          },
          '写 computed.max = 99',
        ),
        h('p', { class: 'ri-state' }, `主题：${t.value} · readonly.visits：${st.visits}`),
      ])
  },
})

// ---------- 顶层模板展示 ----------

/** 顶层读到的实时主题（证明跨层同步） */
const themeEcho = computed(() => theme.value)
</script>

<template>
  <div class="ri-demo">
    <div class="panels">
      <!-- Parent 层 -->
      <div class="ri-parent">
        <p class="ri-layer">
          Parent（顶层）
        </p>
        <p class="ri-state">
          实时主题：<b>{{ themeEcho }}</b> · visits：<b>{{ state.visits }}</b>
        </p>
        <p class="ri-hint">
          底层/中层操作都会同步回顶层（provide 传 ref）
        </p>
        <!-- 中层组件 -->
        <Child />
      </div>

      <!-- 读写日志 -->
      <div class="log-panel">
        <p class="log-title">
          每层读 / 写日志
        </p>
        <ul class="log-list">
          <li
            v-for="(l, i) in logs"
            :key="i"
          >
            {{ l }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ri-demo {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.panels {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 0.75rem;
}

/* ---------- 层级卡片（:deep 穿透内联 render 子组件） ---------- */

.ri-parent {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.9rem;
  background-color: var(--bg);
}

:deep(.ri-child) {
  border: 1px dashed var(--border);
  border-radius: var(--radius-btn);
  padding: 0.75rem;
  margin-top: 0.6rem;
}

:deep(.ri-grand) {
  border: 1px dashed var(--primary);
  border-radius: var(--radius-btn);
  padding: 0.75rem;
  margin-top: 0.6rem;
}

:deep(.ri-layer) {
  margin: 0 0 0.4rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

:deep(.ri-state) {
  margin: 0.2rem 0;
  font-size: 0.875rem;
  color: var(--text);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

:deep(.ri-readonly) {
  margin: 0.35rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

:deep(.ri-hint) {
  margin: 0.4rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

:deep(.ri-btn) {
  margin: 0.25rem 0.35rem 0.25rem 0;
  padding: 0.28rem 0.65rem;
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

:deep(.ri-btn--danger) {
  border-color: var(--danger);
  color: var(--danger);

  &:hover {
    background-color: var(--danger);
    color: #fff;
  }
}

/* ---------- 日志 ---------- */

.log-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.65rem 0.8rem;
  background-color: var(--code-bg);
  max-height: 320px;
  overflow-y: auto;
}

.log-title {
  margin: 0 0 0.4rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.log-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.9;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .panels {
    grid-template-columns: 1fr;
  }
}
</style>
