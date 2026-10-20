// ============================================================
// 案例：KeepAlive + LRU 页面缓存（keep-alive-lru）
// KeepAlive :max="2" 真实运行：切走页面不销毁、切回来保留输入；
// 同时最多缓存 2 个，超出按 LRU 淘汰最久未访问的（触发 unmount）。
// 日志区分 mount / activate / unmount，一眼看懂缓存生命周期。
// ============================================================
<script setup lang="ts">
 
import { defineComponent, h, onActivated, onMounted, onUnmounted, ref } from 'vue'

// ============================================================
// 日志与页面列表
// ============================================================

const pages = ['订单列表', '商品详情', '用户中心', '数据报表']
const current = ref(0)
const logs = ref<string[]>([])
const mounts = ref(0)
const activations = ref(0)
const unmounts = ref(0)

function pushLog(msg: string): void {
  logs.value.unshift(msg)
  if (logs.value.length > 10) logs.value.pop()
}

// ============================================================
// 被缓存的页面组件
// ============================================================

const DemoPage = defineComponent({
  name: 'DemoPage',
  props: {
    name: { type: String, required: true },
  },
  setup(props) {
    /** 本页面的挂载次数（keep-alive 命中时不会增加） */
    const pageMounts = ref(0)
    /** 本页面的激活次数（每次切回来 +1） */
    const pageActivations = ref(0)

    onMounted(() => {
      pageMounts.value++
      mounts.value++
      pushLog(`🟢 mount ${props.name}（新建实例）`)
    })

    onActivated(() => {
      pageActivations.value++
      activations.value++
      pushLog(`🔵 activate ${props.name}（复用缓存）`)
    })

    onUnmounted(() => {
      unmounts.value++
      pushLog(`🔴 unmount ${props.name}（被 LRU 淘汰）`)
    })

    return () =>
      h('div', { class: 'ka-page' }, [
        h('h3', props.name),
        h('p', { class: 'ka-stat' }, `mount ${pageMounts.value} 次 · activate ${pageActivations.value} 次`),
        h('input', {
          class: 'ka-input',
          placeholder: '在这里输入内容，切走再回来看看是否还在',
        }),
        h('p', { class: 'ka-tip' }, '输入框内容保留 = 组件实例被缓存（没重新 mount）'),
      ])
  },
})

// ============================================================
// 切换
// ============================================================

function go(index: number): void {
  current.value = index
}

function next(): void {
  current.value = (current.value + 1) % pages.length
}

function resetAll(): void {
  current.value = 0
  logs.value = []
  mounts.value = 0
  activations.value = 0
  unmounts.value = 0
}
</script>

<template>
  <div class="ka-demo">
    <!-- 统计 -->
    <div class="ka-meta">
      <span>mount <b>{{ mounts }}</b></span>
      <span>activate <b>{{ activations }}</b></span>
      <span>unmount <b>{{ unmounts }}</b></span>
      <span class="ka-rule">缓存上限 max = 2（LRU）</span>
      <button
        class="btn-reset"
        @click="resetAll"
      >
        重置
      </button>
    </div>

    <!-- 页面切换 -->
    <div class="ka-tabs">
      <button
        v-for="(p, i) in pages"
        :key="p"
        class="ka-tab"
        :class="{ active: current === i }"
        @click="go(i)"
      >
        {{ p }}
      </button>
      <button
        class="ka-tab ka-tab--next"
        @click="next"
      >
        下一个 →
      </button>
    </div>

    <!-- //! KeepAlive + 动态组件：key 决定缓存边界 -->
    <div class="ka-stage">
      <KeepAlive :max="2">
        <component
          :is="DemoPage"
          :key="pages[current]"
          :name="pages[current]"
        />
      </KeepAlive>
    </div>

    <!-- 日志 -->
    <ul class="ka-log">
      <li
        v-for="(l, i) in logs"
        :key="i"
      >
        {{ l }}
      </li>
    </ul>

    <p class="ka-hint">
      按 订单 → 商品 → 用户 → 订单 的顺序点：第 4 次点「订单」时会看到它被重新 mount
      （因为缓存里只剩最近 2 个，订单最先被淘汰）。
    </p>
  </div>
</template>

<style scoped>
.ka-demo {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

/* ---------- 统计 ---------- */

.ka-meta {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
  font-size: 0.8125rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.ka-rule {
  padding: 0.08rem 0.4rem;
  border-radius: 999px;
  background-color: var(--primary-soft);
  color: var(--primary-soft-text);
  font-size: 0.8125rem;
}

.btn-reset {
  margin-left: auto;
  padding: 0.18rem 0.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;
}

/* ---------- 标签 ---------- */

.ka-tabs {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.ka-tab {
  padding: 0.24rem 0.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;

  &.active {
    border-color: var(--primary);
    background-color: var(--primary);
    color: #fff;
  }

  &--next {
    border-style: dashed;
  }
}

/* ---------- 舞台 ---------- */

.ka-stage {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.65rem;
  min-height: 130px;
}

/* 内联组件渲染节点无 scoped 属性，用 :deep 穿透 */
.ka-demo :deep(.ka-page) {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  h3 {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--text);
  }
}

.ka-demo :deep(.ka-stat) {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.ka-demo :deep(.ka-input) {
  padding: 0.32rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
  color: var(--text);
  font-size: 0.875rem;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.ka-demo :deep(.ka-tip) {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

/* ---------- 日志 ---------- */

.ka-log {
  list-style: none;
  margin: 0;
  padding: 0.4rem 0.55rem;
  background-color: var(--code-bg);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.85;
  color: var(--text-secondary);
  min-height: 5.6rem;
}

.ka-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;
}
</style>
