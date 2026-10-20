// ============================================================
// 案例：路由转场动画（前进/后退方向）
// 模拟路由栈：push → 左滑进入；back → 右滑返回
// 用 Transition 按方向切换动画类，配合滚动位置记忆说明
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

// ============================================================
// 模拟路由栈
// ============================================================

const pages = ['首页', '商品列表', '商品详情', '评价列表']

/** 历史栈（最后一个 = 当前页） */
const stack = ref<string[]>(['首页'])

/** 导航方向：决定用哪套过渡动画 */
const dir = ref<'forward' | 'back'>('forward')

const current = computed(() => stack.value[stack.value.length - 1])

/** 前进：入栈 */
function push(page: string): void {
  // 防止 push 当前页
  if (page === current.value) return
  dir.value = 'forward'
  stack.value.push(page)
}

/** 后退：出栈（模拟浏览器返回） */
function back(): void {
  if (stack.value.length <= 1) return
  dir.value = 'back'
  stack.value.pop()
}

/** 重置 */
function resetAll(): void {
  stack.value = ['首页']
  dir.value = 'forward'
}

/** 过渡名：forward 左滑，back 右滑 */
const transitionName = computed(() => (dir.value === 'forward' ? 'slide-left' : 'slide-right'))

/** 当前页序号（用于展示“滚动位置恢复”的思路） */
const pageIndex = computed(() => pages.indexOf(current.value) + 1)
</script>

<template>
  <div class="rt-demo">
    <!-- 导航 -->
    <div class="rt-tabs">
      <button
        v-for="p in pages"
        :key="p"
        class="rt-tab"
        :class="{ active: p === current }"
        @click="push(p)"
      >
        {{ p }}
      </button>
      <button
        class="rt-tab rt-tab--back"
        :disabled="stack.length <= 1"
        @click="back"
      >
        ← 返回
      </button>
      <button
        class="rt-tab rt-tab--reset"
        @click="resetAll"
      >
        重置
      </button>
    </div>

    <!-- 方向指示 -->
    <p class="rt-meta">
      方向：<b>{{ dir === 'forward' ? '前进（左滑）' : '后退（右滑）' }}</b>
      · 过渡名：<code>{{ transitionName }}</code>
      · 栈深：<b>{{ stack.length }}</b>
    </p>

    <!-- 过渡舞台 -->
    <div class="rt-stage">
      <Transition
        :name="transitionName"
        mode="out-in"
      >
        <section
          :key="current"
          class="rt-page"
        >
          <span class="rt-index">{{ pageIndex }}</span>
          <h3>{{ current }}</h3>
          <p class="rt-desc">
            当前页面内容占位。点顶部标签前进 / 点返回后退，观察进出方向。
          </p>
        </section>
      </Transition>
    </div>

    <!-- 历史栈 -->
    <div class="rt-stack">
      <span class="rt-stack-label">历史栈</span>
      <span
        v-for="(p, i) in stack"
        :key="`${p}-${i}`"
        class="rt-chip"
        :class="{ current: i === stack.length - 1 }"
      >
        {{ p }}
      </span>
    </div>

    <p class="rt-hint">
      真实项目里方向由 <code>router.beforeEach</code> 比较 <code>to</code>/<code>from</code> 的路由深度
      或 <code>history.state.position</code> 得出；配合 <code>&lt;Transition mode="out-in"&gt;</code> 使用。
    </p>
  </div>
</template>

<style scoped>
.rt-demo {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

/* ---------- 标签 ---------- */

.rt-tabs {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.rt-tab {
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

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &--back {
    border-style: dashed;
  }

  &--reset {
    margin-left: auto;
    font-size: 0.8125rem;
  }
}

.rt-meta {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.02rem 0.24rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}

/* ---------- 舞台 ---------- */

.rt-stage {
  position: relative;
  min-height: 160px;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.7rem;
  overflow: hidden;
}

.rt-page {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  position: relative;

  h3 {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text);
  }
}

.rt-index {
  position: absolute;
  right: 0;
  top: 0;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.rt-desc {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.7;
}

/* ---------- 过渡动画 ---------- */

/*! 前进：新页从右进、旧页向左出 */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.28s ease, opacity 0.28s ease;
}

.slide-left-enter-from {
  transform: translateX(36px);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(-36px);
  opacity: 0;
}

/*! 后退：方向相反 */
.slide-right-enter-from {
  transform: translateX(-36px);
  opacity: 0;
}

.slide-right-leave-to {
  transform: translateX(36px);
  opacity: 0;
}

/* ---------- 历史栈 ---------- */

.rt-stack {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.rt-stack-label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.rt-chip {
  font-size: 0.8125rem;
  padding: 0.08rem 0.45rem;
  border-radius: 999px;
  background-color: var(--code-bg);
  color: var(--text-secondary);

  &.current {
    background-color: var(--primary-soft);
    color: var(--primary-soft-text);
    font-weight: 600;
  }
}

.rt-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.65;

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.02rem 0.24rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}
</style>
