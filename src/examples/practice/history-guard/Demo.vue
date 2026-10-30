// ============================================================
// 案例：History 拦截返回（history-guard）
// 有未保存内容时点「浏览器返回」：先弹确认，取消则留在当前页。
// Demo 用状态机模拟（不动真实 history）；下方给出真实实现要点。
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

// ============================================================
// 编辑器状态
// ============================================================

/** 已保存的正文 */
const savedText = ref('第一版内容')
/** 编辑中的草稿 */
const draft = ref('第一版内容')

/** 是否有未保存修改 */
const dirty = computed(() => draft.value !== savedText.value)

/** 确认弹层 */
const confirmOpen = ref(false)

/** 日志 */
const logs = ref<string[]>([])

function pushLog(msg: string): void {
  logs.value.unshift(msg)
  if (logs.value.length > 6) logs.value.pop()
}

// ============================================================
// 保存 / 模拟返回
// ============================================================

function save(): void {
  savedText.value = draft.value
  pushLog('💾 已保存，脏标记清除')
}

/**
 * //! 模拟浏览器返回（真实项目由 popstate / onBeforeRouteLeave 触发）
 */
function tryBack(): void {
  if (!dirty.value) {
    pushLog('↩ 无未保存内容，直接返回成功')
    return
  }
  //! 有脏数据 → 拦下来问用户
  confirmOpen.value = true
  pushLog('🛑 拦截返回：存在未保存修改，弹出确认')
}

function confirmLeave(): void {
  confirmOpen.value = false
  pushLog('🚪 用户确认离开，丢弃草稿')
  // 模拟离开后草稿被重置
  draft.value = savedText.value
}

function cancelLeave(): void {
  confirmOpen.value = false
  pushLog('✋ 用户取消，停留在当前页（草稿保留）')
}

function resetAll(): void {
  savedText.value = '第一版内容'
  draft.value = '第一版内容'
  confirmOpen.value = false
  logs.value = []
}
</script>

<template>
  <div class="hg-demo">
    <!-- 编辑区 -->
    <section class="hg-card">
      <header class="hg-head">
        <h3>模拟编辑页</h3>
        <span
          class="hg-flag"
          :class="{ dirty }"
        >
          {{ dirty ? '● 有未保存修改' : '✓ 已保存' }}
        </span>
      </header>

      <textarea
        v-model="draft"
        class="hg-area"
        rows="4"
        aria-label="编辑内容"
      />

      <div class="hg-actions">
        <n-button
          type="primary"
          @click="save"
        >
          保存
        </n-button>
        <n-button
          type="warning"
          @click="tryBack"
        >
          模拟浏览器返回
        </n-button>
        <n-button
          @click="resetAll"
        >
          重置
        </n-button>
      </div>
    </section>

    <!-- 确认框（内联在 Demo 里，真实项目可用 Dialog 组件） -->
    <div
      v-if="confirmOpen"
      class="hg-confirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hg-confirm-title"
    >
      <h4 id="hg-confirm-title">
        离开当前页面？
      </h4>
      <p>你有未保存的修改，离开后将丢失。</p>
      <div class="hg-confirm-actions">
        <n-button
          @click="cancelLeave"
        >
          取消
        </n-button>
        <n-button
          type="error"
          @click="confirmLeave"
        >
          确认离开
        </n-button>
      </div>
    </div>

    <!-- 日志 -->
    <ul class="hg-log">
      <li
        v-for="(l, i) in logs"
        :key="i"
      >
        {{ l }}
      </li>
    </ul>

    <!-- 真实实现 -->
    <section class="hg-note">
      <h3>真实项目怎么接</h3>
      <ol>
        <li>
          路由级：<code>onBeforeRouteLeave((to, from, next) =&gt; { if (dirty) next(window.confirm('离开？')) else next() })</code>
        </li>
        <li>
          浏览器关闭/刷新：<code>beforeunload</code> 事件 + <code>e.preventDefault()</code>（浏览器只允许显示默认文案）
        </li>
        <li>
          前进后退拦截：监听 <code>popstate</code>；取消时用 <code>history.pushState</code> 把栈“顶回去”
        </li>
      </ol>
      <p class="hg-warn">
        ⚠️ history 拦截是侵入式方案：会影响浏览器前进/后退语义，优先用路由守卫；
        确认框不要用原生 <code>confirm</code>（体验差且不可定制）。
      </p>
    </section>
  </div>
</template>

<style scoped>
.hg-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  position: relative;
}

/* ---------- 编辑卡 ---------- */

.hg-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.hg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;

  h3 {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--text);
  }
}

.hg-flag {
  font-size: 0.8125rem;
  color: var(--success);

  &.dirty {
    color: var(--warning);
  }
}

.hg-area {
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
  color: var(--text);
  font-size: 0.875rem;
  line-height: 1.6;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.hg-actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

/* ---------- 确认框 ---------- */

.hg-confirm {
  position: absolute;
  inset: auto 0 auto 0;
  top: 25%;
  margin: 0 auto;
  width: min(320px, 92%);
  z-index: 10;
  background-color: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  box-shadow: 0 14px 40px rgb(0 0 0 / 0.2);
  padding: 0.8rem;

  h4 {
    margin: 0 0 0.25rem;
    font-size: 0.9375rem;
    color: var(--text);
  }

  p {
    margin: 0 0 0.55rem;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }
}

.hg-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
}

/* ---------- 日志 ---------- */

.hg-log {
  list-style: none;
  margin: 0;
  padding: 0.4rem 0.55rem;
  background-color: var(--code-bg);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.9;
  color: var(--text-secondary);
  min-height: 4.6rem;
}

/* ---------- 说明 ---------- */

.hg-note {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.7rem;

  h3 {
    margin: 0 0 0.3rem;
    font-size: 0.875rem;
    color: var(--text);
  }

  ol {
    margin: 0;
    padding-left: 1.1rem;
    font-size: 0.8125rem;
    line-height: 1.9;
    color: var(--text-secondary);
  }

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.02rem 0.24rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}

.hg-warn {
  margin: 0.4rem 0 0;
  font-size: 0.8125rem;
  color: var(--warning);
  line-height: 1.6;
}
</style>
