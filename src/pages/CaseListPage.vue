// ============================================================
// 案例列表页（/cases，全宽）
// - 顶栏搜索改为全局弹窗，本页只负责分类筛选
// - 分类分组的案例卡片：标题 / 摘要 / 难度 / 标签，点击进详情
// ============================================================
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { categories } from '../examples/categories'
import { allCases } from '../examples/registry'

/** 分类筛选持久化键：从详情页返回时保留用户选中的分类 */
const FILTER_KEY = 'moyu-cases-filter'

/** 选中的分类 id（'' = 全部；chips 本地状态，sessionStorage 记忆） */
const activeCategory = ref(sessionStorage.getItem(FILTER_KEY) ?? '')

// 恢复的筛选可能已不存在（分类被删/改名）→ 回退到「全部」
if (activeCategory.value && !categories.some((c) => c.id === activeCategory.value)) {
  activeCategory.value = ''
}

// 筛选变化即写入会话存储（关闭标签页后自动清空）
watch(activeCategory, (value) => {
  sessionStorage.setItem(FILTER_KEY, value)
})

/**
 * 分类筛选 chips 数据
 * 只列「有案例」的分类（空分类不显示，避免点了空页面）
 */
const chips = computed(() => [
  { id: '', name: '全部', count: allCases.length },
  ...categories
    .map((cat) => ({
      ...cat,
      count: allCases.filter((c) => c.categoryId === cat.id).length,
    }))
    .filter((cat) => cat.count > 0),
])

/** 当前分类过滤后的案例（chips 与分组列表共用） */
const visibleCases = computed(() =>
  activeCategory.value
    ? allCases.filter((c) => c.categoryId === activeCategory.value)
    : allCases,
)

/**
 * 过滤后的分组列表（分类 + 命中案例）
 * 选了分类就只展示该分组；「全部」则展示所有有命中的分组
 */
const grouped = computed(() =>
  categories
    .map((category) => ({
      ...category,
      cases: visibleCases.value.filter((c) => c.categoryId === category.id),
    }))
    .filter((group) => group.cases.length > 0),
)

/** 无任何命中的总数（搜索/筛选双重条件） */
const totalHits = computed(() => visibleCases.value.length)

/** 难度 → tag 语义色类 */
function difficultyClass(difficulty: string): string {
  const map: Record<string, string> = {
    beginner: 'tag--success',
    intermediate: 'tag--warning',
    advanced: 'tag--danger',
  }
  return map[difficulty] ?? ''
}

/** 难度 → 中文文案 */
function difficultyLabel(difficulty: string): string {
  const map: Record<string, string> = {
    beginner: '入门',
    intermediate: '进阶',
    advanced: '高级',
  }
  return map[difficulty] ?? difficulty
}
</script>

<template>
  <div class="case-list-page">
    <header class="page-header">
      <h1 class="page-title">
        案例库
      </h1>
      <p class="page-desc">
        点分类筛选，或点顶栏搜索（支持标题 / 标签 / 摘要）
      </p>
    </header>

    <!-- 分类筛选 chips（侧边栏的替代入口） -->
    <div
      v-if="chips.length > 1"
      class="filter-chips"
      role="group"
      aria-label="按分类筛选"
    >
      <button
        v-for="chip in chips"
        :key="chip.id"
        type="button"
        class="filter-chip"
        :class="{ 'filter-chip--active': activeCategory === chip.id }"
        :aria-pressed="activeCategory === chip.id"
        @click="activeCategory = chip.id"
      >
        {{ chip.name }}
        <span class="chip-count">{{ chip.count }}</span>
      </button>
    </div>

    <!-- 分类无案例时的空结果 -->
    <div
      v-if="totalHits === 0"
      class="empty-state"
    >
      <p>该分类暂无案例</p>
    </div>

    <!-- 分类分组卡片 -->
    <section
      v-for="group in grouped"
      :key="group.id"
      class="category-section"
      :aria-labelledby="`cat-${group.id}`"
    >
      <h2
        :id="`cat-${group.id}`"
        class="category-title"
      >
        {{ group.name }}
      </h2>

      <div class="case-grid">
        <RouterLink
          v-for="item in group.cases"
          :key="item.meta.id"
          :to="`/cases/${group.id}/${item.meta.id}`"
          class="case-card card card--interactive"
        >
          <!-- 卡片头：标题 + 难度 tag -->
          <div class="card-head">
            <h3 class="card-title">
              {{ item.meta.title }}
            </h3>
            <span
              class="tag"
              :class="difficultyClass(item.meta.difficulty)"
            >
              {{ difficultyLabel(item.meta.difficulty) }}
            </span>
          </div>

          <!-- 摘要 -->
          <p class="card-summary">
            {{ item.meta.summary }}
          </p>

          <!-- API 标签 pills -->
          <div class="card-tags">
            <span
              v-for="tag in item.meta.tags"
              :key="tag"
              class="tag tag--primary"
            >
              {{ tag }}
            </span>
          </div>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.case-list-page {
  /* 全宽布局（侧边栏删除），限宽避免行过长。
     width:100% 显式声明，防止 flex 父级下 auto margin 禁用 stretch
     导致宽度随内容漂移（与 CasePage 同一机制） */
  width: 100%;
  max-width: 84rem;
  margin: 0 auto;
  padding: 2.5rem 2.5rem 5rem;
}

.page-header {
  margin-bottom: 1.25rem;
}

.page-title {
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
}

.page-desc {
  color: var(--text-secondary);
  margin: 0;
}

/* ---------- 分类筛选 chips ---------- */

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.9rem;
  font-size: 0.85rem;
  font-family: inherit;
  color: var(--text-secondary);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  transition:
    color var(--transition),
    border-color var(--transition),
    background-color var(--transition);
}

.filter-chip:hover {
  color: var(--primary);
  border-color: var(--primary);
}

/* 选中态：主色浅底 + 主色文字 + 主色边框 */
.filter-chip--active {
  color: var(--primary);
  background-color: var(--primary-soft);
  border-color: var(--primary);
  font-weight: 500;
}

/* 计数徽标：更浅的次级数字 */
.chip-count {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  opacity: 0.75;
}

.empty-state {
  color: var(--text-secondary);
  padding: 3rem 0;
  text-align: center;
}

.category-section {
  margin-bottom: 2.5rem;
}

/* 分类标题：文档站小节规格 */
.category-title {
  font-size: 1.125rem;
  font-weight: 600;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1rem;
}

/* 卡片网格：三列（全宽后可放三列） */
.case-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.875rem;
}

.case-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.125rem 1.25rem;
  color: var(--text);
}

/* RouterLink 的 card 需要去掉默认下划线 */
.case-card:hover {
  text-decoration: none;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.card-title {
  font-size: 0.975rem;
  font-weight: 600;
  margin: 0;
  line-height: 1.5;
}

.card-summary {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: auto; /* 标签沉底，卡片等高对齐 */
}

/* 小屏：降为单列 */
@media (max-width: 768px) {
  .case-list-page {
    padding: 1.5rem 1.25rem 3rem;
  }

  .case-grid {
    grid-template-columns: 1fr;
  }
}
</style>
