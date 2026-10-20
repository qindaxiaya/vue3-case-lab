// ============================================================
// 搜索弹窗：半透明遮罩 + 居中面板
// - 点击顶栏搜索框打开，Esc / 点遮罩关闭
// - 输入即过滤（标题 / 摘要 / 标签），结果以卡片模块展示
// - 上下键选择、回车或点击直接进入案例详情
// ============================================================
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { categories } from '../examples/categories'
import { allCases, filterCases } from '../examples/registry'

const props = defineProps<{
  /** 弹窗是否打开（由顶栏持有） */
  open: boolean
}>()

const emit = defineEmits<{
  /** 请求关闭弹窗 */
  (e: 'close'): void
}>()

const router = useRouter()

/** 搜索关键词（每次打开清空） */
const keyword = ref('')
/** 键盘当前选中项下标 */
const activeIndex = ref(0)
/** 输入框（打开后自动聚焦） */
const inputEl = ref<HTMLInputElement | null>(null)
/** 结果列表容器（键盘移动时把选中项滚进视野） */
const listEl = ref<HTMLElement | null>(null)

/** 打开弹窗前页面原本的滚动锁状态，关闭时原样还原 */
let prevOverflow = ''

/** 全量匹配数（用于顶部计数，列表本身最多展示 8 条） */
const matchCount = computed(() => {
  const q = keyword.value.trim()
  return q ? filterCases(allCases, q).length : 0
})

/** 结果计数文案（超过 8 条时说明只展示前 8 条） */
const metaText = computed(() => {
  const q = keyword.value.trim()
  if (!q) return '推荐案例'
  return matchCount.value > 8
    ? `找到 ${matchCount.value} 个案例，展示前 8 个`
    : `找到 ${matchCount.value} 个案例`
})

/**
 * 展示的结果
 * - 有关键词：标题 / 摘要 / 标签命中，最多 8 条
 * - 无关键词：给 6 条推荐，避免打开后一片空白
 */
const results = computed(() => {
  const q = keyword.value.trim()
  if (!q) return allCases.slice(0, 6)
  return filterCases(allCases, q).slice(0, 8)
})

/** 分类 id → 中文名 */
const categoryName = computed(() => {
  const map = new Map(categories.map((c) => [c.id, c.name]))
  return (id: string): string => map.get(id) ?? id
})

/** 难度 → 中文文案 */
function difficultyLabel(difficulty: string): string {
  const map: Record<string, string> = {
    beginner: '入门',
    intermediate: '进阶',
    advanced: '高级',
  }
  return map[difficulty] ?? difficulty
}

/** 难度 → 标签语义色 */
function difficultyClass(difficulty: string): string {
  const map: Record<string, string> = {
    beginner: 'tag--success',
    intermediate: 'tag--warning',
    advanced: 'tag--danger',
  }
  return map[difficulty] ?? ''
}

/** 打开/关闭副作用：聚焦、清空、锁页面滚动 */
watch(
  () => props.open,
  async (open) => {
    if (open) {
      keyword.value = ''
      activeIndex.value = 0
      // 记录原值，关闭时还原，避免覆盖其他组件设置的 overflow
      prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      await nextTick()
      inputEl.value?.focus()
    } else {
      document.body.style.overflow = prevOverflow
    }
  },
)

/** 结果变化时回到第一条 */
watch(results, () => {
  activeIndex.value = 0
})

/** 键盘移动选中项（循环） */
function moveActive(delta: number): void {
  const len = results.value.length
  if (len === 0) return
  activeIndex.value = (activeIndex.value + delta + len) % len
  // 等 DOM 更新出高亮类后再滚动，保证选中项始终可见
  void nextTick(() => {
    listEl.value
      ?.querySelector<HTMLElement>('.result-item--active')
      ?.scrollIntoView({ block: 'nearest' })
  })
}

/** 进入案例详情并关闭弹窗 */
function goCase(categoryId: string, caseId: string): void {
  emit('close')
  void router.push(`/cases/${categoryId}/${caseId}`)
}

/** 回车打开当前选中项 */
function openActive(): void {
  const item = results.value[activeIndex.value]
  if (!item) return
  goCase(item.categoryId, item.meta.id)
}

/** 输入框内键盘操作：上下选择 / 回车进入 / Esc 关闭 */
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    moveActive(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    moveActive(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    openActive()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

// 组件销毁时兜底解锁（例如弹窗打开状态下路由被强制切换）
onBeforeUnmount(() => {
  document.body.style.overflow = prevOverflow
})
</script>

<template>
  <Teleport to="body">
    <Transition name="search-modal">
      <!-- 遮罩点空白处关闭；点面板内部不触发（.self） -->
      <div
        v-if="open"
        class="search-overlay"
        @click.self="emit('close')"
      >
        <section
          class="search-panel"
          role="dialog"
          aria-modal="true"
          aria-label="搜索案例"
        >
          <!-- 搜索输入行 -->
          <div class="search-bar">
            <span
              class="search-bar-icon"
              aria-hidden="true"
            >🔍</span>
            <input
              ref="inputEl"
              v-model="keyword"
              class="search-field"
              type="search"
              placeholder="搜索案例标题、标签或摘要……"
              autocomplete="off"
              @keydown="onKeydown"
            >
            <button
              class="search-close"
              type="button"
              @click="emit('close')"
            >
              Esc
            </button>
          </div>

          <!-- 结果计数：读屏也会播报 -->
          <p
            class="search-meta"
            aria-live="polite"
          >
            {{ metaText }}
          </p>

          <!-- 结果模块列表 -->
          <ul
            v-if="results.length"
            ref="listEl"
            class="result-list"
          >
            <li
              v-for="(item, index) in results"
              :key="`${item.categoryId}/${item.meta.id}`"
            >
              <button
                class="result-item"
                :class="{ 'result-item--active': index === activeIndex }"
                type="button"
                @click="goCase(item.categoryId, item.meta.id)"
                @mouseenter="activeIndex = index"
              >
                <div class="result-head">
                  <span class="result-title">{{ item.meta.title }}</span>
                  <span class="tag tag--primary result-cat">
                    {{ categoryName(item.categoryId) }}
                  </span>
                  <span
                    class="tag result-diff"
                    :class="difficultyClass(item.meta.difficulty)"
                  >
                    {{ difficultyLabel(item.meta.difficulty) }}
                  </span>
                </div>
                <p class="result-summary">
                  {{ item.meta.summary }}
                </p>
              </button>
            </li>
          </ul>

          <!-- 无结果 -->
          <div
            v-else
            class="result-empty"
          >
            <p>没有匹配「{{ keyword }}」的案例</p>
            <p class="result-empty-tip">
              试试「虚拟列表」「防抖」「路由」「动画」等关键词
            </p>
          </div>

          <!-- 操作提示 -->
          <p class="search-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
            <span><kbd>Enter</kbd> 打开</span>
            <span><kbd>Esc</kbd> 关闭</span>
          </p>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ---------- 遮罩：半透明 + 轻模糊 ---------- */
.search-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12vh 1rem 2rem;
  background-color: rgb(17 24 39 / 0.55);
  backdrop-filter: blur(3px);
}

/* ---------- 面板 ---------- */
.search-panel {
  width: min(44rem, 100%);
  max-height: 72vh;
  display: flex;
  flex-direction: column;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: 0 24px 60px rgb(0 0 0 / 0.28);
  overflow: hidden;
}

/* 输入行：图标 + 无边框输入框 + Esc 按钮 */
.search-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border);
}

.search-bar-icon {
  font-size: 0.95rem;
  opacity: 0.6;
}

.search-field {
  flex: 1;
  min-width: 0;
  padding: 0.2rem 0;
  font-family: inherit;
  font-size: 1rem;
  color: var(--text);
  background: none;
  border: none;
  outline: none;
}

.search-field::placeholder {
  color: var(--text-secondary);
}

.search-close {
  flex-shrink: 0;
  padding: 0.2rem 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-secondary);
  background-color: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.search-close:hover {
  color: var(--text);
}

/* 结果计数 */
.search-meta {
  margin: 0;
  padding: 0.6rem 1rem 0.35rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* ---------- 结果列表 ---------- */
.result-list {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0.25rem 0.5rem 0.6rem;
  list-style: none;
  overflow-y: auto;
}

.result-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.7rem 0.75rem;
  font-family: inherit;
  text-align: left;
  background: none;
  border: none;
  border-radius: var(--radius-btn);
  cursor: pointer;
  transition: background-color var(--transition);
}

/* 键盘/鼠标选中态：主色浅底 */
.result-item--active {
  background-color: var(--primary-soft);
}

.result-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.result-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
}

.result-cat,
.result-diff {
  font-size: 0.68rem;
  padding: 0.05rem 0.45rem;
}

.result-summary {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--text-secondary);
  /* 摘要最多两行，避免长文案把面板撑高 */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

/* ---------- 空结果 ---------- */
.result-empty {
  padding: 2.25rem 1rem;
  text-align: center;

  p {
    margin: 0 0 0.5rem;
    color: var(--text);
    font-size: 0.9rem;
  }
}

.result-empty-tip {
  color: var(--text-secondary) !important;
  font-size: 0.8rem !important;
}

/* ---------- 底部操作提示 ---------- */
.search-foot {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin: 0;
  padding: 0.55rem 1rem;
  border-top: 1px solid var(--border);
  font-size: 0.72rem;
  color: var(--text-secondary);
  background-color: var(--bg);

  kbd {
    display: inline-block;
    min-width: 1.1rem;
    padding: 0 0.25rem;
    margin-right: 0.2rem;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-align: center;
    color: var(--text-secondary);
    background-color: var(--surface);
    border: 1px solid var(--border);
    border-radius: 0.25rem;
  }
}

/* ---------- 出现/消失动画 ---------- */
.search-modal-enter-active,
.search-modal-leave-active {
  transition: opacity 0.2s ease-out;
}

.search-modal-enter-from,
.search-modal-leave-to {
  opacity: 0;
}

.search-modal-enter-active .search-panel {
  transition: transform 0.22s ease-out;
}

.search-modal-enter-from .search-panel {
  transform: translateY(-12px) scale(0.98);
}

/* ---------- 移动端 ---------- */
@media (max-width: 560px) {
  .search-overlay {
    padding: 6vh 0.75rem 1rem;
  }

  .search-panel {
    max-height: 82vh;
  }

  .search-foot {
    display: none;
  }
}
</style>
