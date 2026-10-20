// ============================================================
// 案例详情页（/cases/:categoryId/:caseId）
// 结构：面包屑 → 页头（标题+难度+标签）→ 演示区 → 说明/源码 tab
// 说明与源码共用一个 tab 组：默认说明，源码按需切换查看
// ============================================================
<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { categories } from '../examples/categories'
import { getCase } from '../examples/registry'
import CodeWorkbench from '../components/CodeWorkbench.vue'

const route = useRoute()
const router = useRouter()

// 路由参数查找案例（不存在渲染空状态）
const item = computed(() =>
  getCase(String(route.params.categoryId), String(route.params.caseId)),
)

/**
 * 路由切换时重置内容 tab
 * CasePage 在同一路由记录内复用（只换 params），组件不会重建；
 * 不重置的话，从上一个案例的源码切过来会直接停在源码面板。
 */
watch(
  () => route.fullPath,
  () => {
    activeTab.value = 'explain'
  },
)

/** 当前分类展示名（面包屑用，找不到回退为原始 id） */
const categoryName = computed(
  () =>
    categories.find((c) => c.id === route.params.categoryId)?.name ??
    String(route.params.categoryId),
)

/** 难度 → tag 语义色类 */
const difficultyClass = computed(() => {
  const map = {
    beginner: 'tag--success',
    intermediate: 'tag--warning',
    advanced: 'tag--danger',
  } as const
  return map[item.value?.meta.difficulty ?? 'beginner']
})

/** 难度 → 中文文案 */
const difficultyLabel = computed(() => {
  const map = {
    beginner: '入门',
    intermediate: '进阶',
    advanced: '高级',
  } as const
  return map[item.value?.meta.difficulty ?? 'beginner']
})

// ============================================================
// 返回列表：优先走浏览器历史，才能恢复原来的滚动位置
// ============================================================

/**
 * 返回案例列表
 * - 上一条历史正是列表页 → router.back()（触发 scrollBehavior 的 savedPosition）
 * - 否则（直接打开详情/从首页进入）→ push 到列表
 */
function backToList(): void {
  // Vue Router 4 会把上一条路径写进 history.state.back
  const back = window.history.state?.back as string | undefined
  if (back && (back === '/cases' || back.startsWith('/cases?'))) {
    router.back()
  } else {
    void router.push('/cases')
  }
}

// ============================================================
// 案例说明：自动从教学代码的 //! 重点行提取要点
// ============================================================

const keyPoints = computed<string[]>(() => {
  if (!item.value) return []

  const points: string[] = []
  const seen = new Set<string>()

  for (const tab of item.value.codeTabs) {
    for (const line of tab.content.split('\n')) {
      // 与代码区同一套约定：行首 //! 是重点行
      const match = line.match(/^\s*\/\/!\s?(.+)$/)
      if (!match) continue

      const text = match[1].trim()
      // 过滤过短/过长的行，避免把零散标记当要点
      if (text.length < 8 || text.length > 120) continue
      if (seen.has(text)) continue

      seen.add(text)
      points.push(text)
    }
  }

  return points.slice(0, 8)
})

// ============================================================
// 说明 / 源码 tab
// ============================================================

/** 默认展示说明：先看演示与讲解，源码不占首屏 */
const activeTab = ref<'explain' | 'code'>('explain')
/** tab 栏（吸顶容器）：切换后需要据此判断是否把页面拉回视野 */
const tabsWrapEl = ref<HTMLElement | null>(null)
/** 两个 tab 按钮：键盘左右切换后把焦点交给新选中的按钮 */
const explainTabEl = ref<HTMLButtonElement | null>(null)
const codeTabEl = ref<HTMLButtonElement | null>(null)

/** 是否开启了系统「减少动态效果」 */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 切换说明 / 源码
 * 吸顶状态下如果已经滚到代码中段，切过去会从中间开始看；
 * 因此切换后把 tab 栏拉回顶部（只在已滚过 tab 栏时执行，避免页面跳动）
 */
async function switchTab(next: 'explain' | 'code'): Promise<void> {
  if (activeTab.value === next) return
  activeTab.value = next
  await nextTick()

  const wrap = tabsWrapEl.value
  if (!wrap) return
  // 顶栏高 64px，留出吸顶位置
  const target = wrap.getBoundingClientRect().top + window.scrollY - 64
  if (window.scrollY > target) {
    window.scrollTo({
      top: target,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }
}

/** tablist 键盘操作：左右键切换并移动焦点 */
function onTabKeydown(
  e: KeyboardEvent,
  current: 'explain' | 'code',
): void {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()

  const next = current === 'explain' ? 'code' : 'explain'
  void switchTab(next)
  void nextTick(() => {
    const target = next === 'explain' ? explainTabEl : codeTabEl
    target.value?.focus()
  })
}

// ============================================================
// 回到顶部：滚动超过一屏后出现
// ============================================================

/** 按钮是否显示 */
const showBackTop = ref(false)
/** 当前阅读进度 0..1（画在按钮外圈的进度环） */
const scrollProgress = ref(0)
/** 滚动回调的逐帧节流开关：一帧最多计算一次 */
let scrollTicking = false

/** 滚动监听：passive + 逐帧节流，避免每个滚动事件都触发响应式更新 */
function onWindowScroll(): void {
  if (scrollTicking) return
  scrollTicking = true

  requestAnimationFrame(() => {
    const y = window.scrollY
    showBackTop.value = y > 480

    // 进度 = 已滚距离 / 可滚总距离（内容不足一屏时保持 0）
    const max = document.documentElement.scrollHeight - window.innerHeight
    scrollProgress.value = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0

    scrollTicking = false
  })
}

/** 平滑回到顶部（系统要求减少动态时直接跳转） */
function backToTop(): void {
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  })
}

onMounted(() => {
  // 刷新时可能已处于滚动位置，先同步一次
  onWindowScroll()
  window.addEventListener('scroll', onWindowScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onWindowScroll)
})

// ============================================================
// SBAC 说明：场景 / 背景 / 做法 / 结论
// ============================================================

/** 已补齐说明的案例按四段渲染；未补齐时回退到「卖点 + 代码要点」 */
const explain = computed(() => item.value?.meta.explain ?? null)

const explainBlocks = computed(() => {
  const e = explain.value
  if (!e) return []
  return [
    { key: 'S', label: '场景', text: e.situation },
    { key: 'B', label: '背景', text: e.background },
    { key: 'A', label: '做法', text: e.action },
    { key: 'C', label: '结论', text: e.conclusion },
  ]
})
</script>

<template>
  <div class="case-page">
    <!-- 空状态：案例不存在 -->
    <div
      v-if="!item"
      class="case-empty"
    >
      <h1>案例不存在</h1>
      <p>请从左侧导航选择一个案例，或返回案例列表。</p>
      <RouterLink
        class="btn-primary"
        to="/cases"
      >
        返回案例库
      </RouterLink>
    </div>

    <template v-else>
      <!-- 返回条：返回按钮 + 面包屑（返回优先走历史，恢复列表滚动位置） -->
      <div class="case-toolbar">
        <button
          class="back-btn"
          type="button"
          @click="backToList"
        >
          <span aria-hidden="true">←</span>
          返回列表
        </button>

        <nav
          class="crumbs"
          aria-label="面包屑"
        >
          <button
            class="crumb-link"
            type="button"
            @click="backToList"
          >
            案例库
          </button>
          <span
            class="crumb-sep"
            aria-hidden="true"
          >/</span>
          <span>{{ categoryName }}</span>
          <span
            class="crumb-sep"
            aria-hidden="true"
          >/</span>
          <span
            class="crumb-current"
            aria-current="page"
          >{{ item.meta.title }}</span>
        </nav>
      </div>

      <!-- 页头：标题 + 难度/标签一行 + 摘要（文档站紧凑规格） -->
      <header class="case-header">
        <h1 class="case-title">
          {{ item.meta.title }}
        </h1>
        <div class="case-meta">
          <span
            class="tag"
            :class="difficultyClass"
          >{{ difficultyLabel }}</span>
          <span
            v-for="tag in item.meta.tags"
            :key="tag"
            class="tag tag--primary"
          >
            {{ tag }}
          </span>
        </div>
        <p class="case-summary">
          {{ item.meta.summary }}
        </p>
      </header>
      <!-- ① 演示区：直接展示可交互演示 -->
      <section aria-label="可交互演示">
        <div class="card demo-card">
          <component :is="item.demoComponent" />
        </div>
      </section>

      <!-- ② 说明 / 源码：共用一个 tab 组，默认说明，源码按需切换 -->
      <section aria-label="案例说明与源码">
        <div
          ref="tabsWrapEl"
          class="content-tabs-wrap"
        >
          <div
            class="content-tabs"
            role="tablist"
            aria-label="说明与源码切换"
          >
            <button
              id="tab-explain"
              ref="explainTabEl"
              class="content-tab"
              :class="{ 'content-tab--active': activeTab === 'explain' }"
              type="button"
              role="tab"
              :aria-selected="activeTab === 'explain'"
              aria-controls="panel-explain"
              @click="switchTab('explain')"
              @keydown="onTabKeydown($event, 'explain')"
            >
              说明
            </button>
            <button
              id="tab-code"
              ref="codeTabEl"
              class="content-tab"
              :class="{ 'content-tab--active': activeTab === 'code' }"
              type="button"
              role="tab"
              :aria-selected="activeTab === 'code'"
              aria-controls="panel-code"
              @click="switchTab('code')"
              @keydown="onTabKeydown($event, 'code')"
            >
              源码
              <span
                v-if="item.codeTabs.length > 1"
                class="content-tab-count"
                :title="`共 ${item.codeTabs.length} 段核心代码`"
              >{{ item.codeTabs.length }}</span>
            </button>
          </div>
        </div>

        <!-- 面板一：案例说明（SBAC 四段；未补齐时回退到卖点 + 代码要点） -->
        <div
          v-show="activeTab === 'explain'"
          id="panel-explain"
          class="content-panel"
          role="tabpanel"
          aria-labelledby="tab-explain"
        >
          <div class="card note-card">
            <template v-if="explain">
              <p class="note-lead">
                {{ item.meta.sell }}
              </p>

              <ol class="sbac-list">
                <li
                  v-for="block in explainBlocks"
                  :key="block.key"
                  class="sbac-row"
                >
                  <span
                    class="sbac-badge"
                    :class="`sbac-${block.key.toLowerCase()}`"
                    aria-hidden="true"
                  >{{ block.key }}</span>
                  <div class="sbac-body">
                    <h3 class="sbac-label">
                      {{ block.label }}
                    </h3>
                    <p class="sbac-text">
                      {{ block.text }}
                    </p>
                  </div>
                </li>
              </ol>
            </template>

            <template v-else>
              <div class="note-sell">
                <span class="note-sell-label">为什么看</span>
                <p class="note-sell-text">
                  {{ item.meta.sell }}
                </p>
              </div>

              <ul
                v-if="keyPoints.length"
                class="note-points"
              >
                <li
                  v-for="point in keyPoints"
                  :key="point"
                >
                  {{ point }}
                </li>
              </ul>
            </template>
          </div>
        </div>

        <!-- 面板二：源码工作台（核心代码 / demo源码 两个子 tab） -->
        <div
          v-show="activeTab === 'code'"
          id="panel-code"
          class="content-panel"
          role="tabpanel"
          aria-labelledby="tab-code"
        >
          <CodeWorkbench
            :tabs="item.codeTabs"
            :demo-source="item.demoSource"
          />
        </div>
      </section>

      <!-- 回到顶部：滚动超过一屏后浮现，外圈是阅读进度 -->
      <Transition name="back-top">
        <button
          v-if="showBackTop"
          class="back-top"
          type="button"
          aria-label="回到顶部"
          @click="backToTop"
        >
          <svg
            class="back-top-ring"
            viewBox="0 0 44 44"
            aria-hidden="true"
          >
            <circle
              class="back-top-track"
              cx="22"
              cy="22"
              r="20"
            />
            <circle
              class="back-top-bar"
              cx="22"
              cy="22"
              r="20"
              :style="{ strokeDashoffset: `${125.66 * (1 - scrollProgress)}` }"
            />
          </svg>
          <span
            class="back-top-arrow"
            aria-hidden="true"
          >↑</span>
        </button>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.case-page {
  /* width:100% 必须显式声明：父级是 flex column，仅靠 max-width + margin:auto
     会禁用 stretch 而退化为 fit-content——页面宽度将随代码行内容实时变化
     （切「demo源码」tab 时长行会把整页撑宽的根因） */
  width: 100%;
  max-width: 84rem;
  margin: 0 auto;
  padding: 2rem 2.5rem 5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* ---------- 返回条 ---------- */

.case-toolbar {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.34rem 0.8rem;
  font-size: 0.82rem;
  font-family: inherit;
  color: var(--text-secondary);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  transition:
    color var(--transition),
    border-color var(--transition),
    background-color var(--transition),
    transform var(--transition);

  &:hover {
    color: var(--primary);
    border-color: var(--primary);
    background-color: var(--primary-soft);
  }

  &:active {
    transform: scale(0.97);
  }
}

/* ---------- 面包屑 ---------- */

.crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.83rem;
  color: var(--text-secondary);
}

.crumb-link {
  padding: 0;
  font-size: inherit;
  font-family: inherit;
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;

  &:hover {
    color: var(--primary);
  }
}

.crumb-sep {
  opacity: 0.5;
}

.crumb-current {
  color: var(--text);
  font-weight: 500;
}

/* 空状态 */
.case-empty {
  text-align: center;
  padding: 4rem 0;

  p {
    color: var(--text-secondary);
    margin-bottom: 1.25rem;
  }
}

/* 页头：文档页 h1 规格 */
.case-title {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 0.6rem;
}

.case-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.65rem;
}

.case-summary {
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.7;
  margin: 0;
}

/* ---------- 说明 / 源码 tab 组 ---------- */

/* 吸顶容器：滚动查看长代码时 tab 保持可见，随时切回说明 */
.content-tabs-wrap {
  position: sticky;
  top: 64px; /* 顶栏高度 */
  z-index: 10;
  margin: -0.4rem 0 0.9rem;
  padding: 0.45rem 0;
  /* 半透明 + 模糊：内容从下方滚过时不与 tab 文字互相干扰 */
  background-color: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
}

/* 面板切换：v-show 重新显示时重播动画，避免「啪」地硬切 */
.content-panel {
  animation: panel-in 0.24s var(--ease-out);
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

.content-tabs {
  display: inline-flex;
  gap: 0.2rem;
  padding: 0.25rem;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  box-shadow: var(--shadow-soft);
}

.content-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2rem;
  padding: 0.34rem 1.15rem;
  font-size: 0.86rem;
  font-family: inherit;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  transition:
    color var(--transition),
    background-color var(--transition),
    box-shadow var(--transition);
}

.content-tab:hover {
  color: var(--text);
  background-color: var(--bg);
}

.content-tab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.content-tab--active,
.content-tab--active:hover {
  color: #fff;
  font-weight: 500;
  background-color: var(--primary);
  box-shadow: var(--shadow-soft);
}

/* 「源码」后的代码段数：小号胶囊，提示有多少段可看 */
.content-tab-count {
  min-width: 1.15rem;
  padding: 0 0.3rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  line-height: 1.15rem;
  text-align: center;
  border-radius: 999px;
  color: var(--text-secondary);
  background-color: var(--bg);
}

.content-tab--active .content-tab-count {
  color: #fff;
  background-color: rgb(255 255 255 / 0.22);
}

/* 演示卡：宽屏下给足留白，避免显得局促 */
.demo-card {
  padding: 2rem 2.25rem;
}

/* ---------- 说明卡 ---------- */

.note-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.35rem 1.6rem;
}

/* 顶部导语：一句话卖点 */
.note-lead {
  margin: 0;
  padding: 0.7rem 0.9rem;
  border-left: 3px solid var(--primary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background-color: var(--primary-soft);
  color: var(--primary);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.7;
}

/* ---------- SBAC 四段 ---------- */

.sbac-list {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sbac-row {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
}

/* 竖线把四段串成一条阅读路径 */
.sbac-row:not(:last-child)::before {
  content: '';
  position: absolute;
  top: 2.05rem;
  bottom: -1.2rem;
  left: 0.85rem;
  width: 1px;
  background-color: var(--border);
}

.sbac-badge {
  flex-shrink: 0;
  width: 1.7rem;
  height: 1.7rem;
  margin-top: 0.1rem;
  display: grid;
  place-items: center;
  border-radius: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 700;
}

/* 四种语义色：场景/背景/做法/结论一眼区分 */
.sbac-s {
  color: var(--primary);
  background-color: var(--primary-soft);
}

.sbac-b {
  color: var(--warning);
  background-color: color-mix(in srgb, var(--warning) 16%, transparent);
}

.sbac-a {
  color: var(--success);
  background-color: color-mix(in srgb, var(--success) 16%, transparent);
}

.sbac-c {
  color: var(--danger);
  background-color: color-mix(in srgb, var(--danger) 13%, transparent);
}

.sbac-body {
  min-width: 0;
}

.sbac-label {
  margin: 0 0 0.3rem;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}

.sbac-text {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.9;
  color: var(--text);
  /* 做法段用换行列步骤时保留换行 */
  white-space: pre-line;
}

@media (max-width: 560px) {
  .note-card {
    padding: 1.1rem;
    gap: 1rem;
  }

  .sbac-text {
    font-size: 0.88rem;
    line-height: 1.85;
  }
}

.note-sell {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.note-sell-label {
  flex-shrink: 0;
  padding: 0.12rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--primary-soft-text);
  background-color: var(--primary-soft);
  border-radius: 999px;
}

.note-sell-text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--text);
}

.note-points {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 1.5rem;

  li {
    position: relative;
    padding-left: 1rem;
    font-size: 0.86rem;
    line-height: 1.65;
    color: var(--text-secondary);
    word-break: break-word;

    /* 主色圆点，弱化视觉重量 */
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0.55em;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background-color: var(--primary);
      opacity: 0.6;
    }
  }
}

/* ---------- 回到顶部 ---------- */

.back-top {
  position: fixed;
  right: 1.75rem;
  bottom: 1.75rem;
  z-index: 30;
  width: 2.85rem;
  height: 2.85rem;
  display: grid;
  place-items: center;
  font-size: 1rem;
  color: var(--primary);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50%;
  box-shadow: var(--shadow-soft-lg);
  cursor: pointer;
  transition:
    transform var(--transition),
    border-color var(--transition),
    color var(--transition),
    box-shadow var(--transition);
}

.back-top:hover {
  transform: translateY(-3px);
  color: var(--primary-hover);
  border-color: var(--primary);
  box-shadow: 0 10px 24px rgb(0 0 0 / 0.16);
}

/* 按下回弹：给点击一个明确的触感 */
.back-top:active {
  transform: translateY(-1px) scale(0.92);
}

.back-top:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3px var(--primary-soft),
    var(--shadow-soft-lg);
}

/* 阅读进度环：贴按钮内圈，从 12 点方向顺时针补齐 */
.back-top-ring {
  position: absolute;
  inset: 2px;
  transform: rotate(-90deg);
  pointer-events: none;
}

.back-top-track,
.back-top-bar {
  fill: none;
  stroke-width: 2;
}

.back-top-track {
  stroke: var(--border);
}

.back-top-bar {
  stroke: var(--primary);
  stroke-linecap: round;
  /* 圆周长 2πr ≈ 125.66：dashoffset 由进度动态控制 */
  stroke-dasharray: 125.66;
  transition: stroke-dashoffset 0.12s linear;
}

.back-top-arrow {
  position: relative;
  line-height: 1;
  transition: transform var(--transition);
}

.back-top:hover .back-top-arrow {
  transform: translateY(-2px);
}

/* 出现：上浮 + 放大（柔和收尾）；消失：快速收紧 */
.back-top-enter-active {
  transition:
    opacity 0.3s var(--ease-out),
    transform 0.3s var(--ease-out);
}

.back-top-leave-active {
  transition:
    opacity 0.18s ease-in,
    transform 0.18s ease-in;
}

.back-top-enter-from,
.back-top-leave-to {
  opacity: 0;
  transform: translateY(18px) scale(0.7);
}

/* ---------- 移动端 ---------- */

@media (max-width: 768px) {
  .case-page {
    padding: 1.5rem 1.25rem 3rem;
    gap: 1.5rem;
  }

  /* 移动端 tab 组铺满一行，方便点按 */
  .content-tabs {
    display: flex;
    width: 100%;
  }

  .content-tab {
    flex: 1;
    justify-content: center;
    padding: 0.45rem 1rem;
  }

  .back-top {
    right: 1rem;
    bottom: 1rem;
    width: 2.5rem;
    height: 2.5rem;
  }

  .demo-card {
    padding: 1.15rem;
  }

  .note-card {
    padding: 1.1rem;
  }

  .note-points {
    grid-template-columns: 1fr;
  }
}
</style>
