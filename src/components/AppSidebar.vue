// ============================================================
// 侧边栏：按分类分组列出案例 + 搜索过滤联动
// props 传入当前搜索词，内部计算过滤后的分组列表
// ============================================================
<script setup lang="ts">
import { computed } from 'vue'
import { categories } from '../examples/categories'
import { allCases, filterCases } from '../examples/registry'
import type { RegisteredCase } from '../examples/registry'

// 父组件传入的搜索词（空串 = 显示全部）
const props = defineProps<{ query: string }>()

/** 过滤后的分组结构：每组 = 分类 + 该分类下命中的案例 */
const grouped = computed(() =>
  categories
    .map((category) => ({
      ...category,
      // 本分类下命中的案例（先全局过滤再按分类归属筛选）
      cases: filterCases(allCases, props.query).filter(
        (c: RegisteredCase) => c.categoryId === category.id,
      ),
    }))
    // 无命中案例的分类整组隐藏（搜索时侧边栏更聚焦）
    .filter((group) => group.cases.length > 0),
)

/** 全局命中总数（空状态判断用） */
const totalHits = computed(() => grouped.value.reduce((n, g) => n + g.cases.length, 0))
</script>

<template>
  <nav
    class="app-sidebar"
    aria-label="案例导航"
  >
    <!-- 搜索无结果的空状态 -->
    <p
      v-if="totalHits === 0"
      class="sidebar-empty"
    >
      没有匹配的案例
    </p>

    <div
      v-for="group in grouped"
      :key="group.id"
      class="sidebar-group"
    >
      <!-- 分类标题 -->
      <h2 class="group-title">
        {{ group.name }}
      </h2>

      <ul class="case-list">
        <li
          v-for="item in group.cases"
          :key="item.meta.id"
        >
          <!-- 当前路由项由 RouterLink 自动加 aria-current="page" -->
          <RouterLink
            :to="`/c/${group.id}/${item.meta.id}`"
            class="case-link"
            active-class="case-link--active"
          >
            <span class="case-title">{{ item.meta.title }}</span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </nav>
</template>

<style scoped>
.app-sidebar {
  width: 16rem;
  flex-shrink: 0;
  padding: 1.25rem 0.75rem;
  border-right: 1px solid var(--border);
  overflow-y: auto; /* 案例多时侧边栏独立滚动 */
}

.sidebar-empty {
  color: var(--text-secondary);
  font-size: 0.9rem;
  padding: 0.5rem 0.75rem;
}

.sidebar-group {
  margin-bottom: 1.25rem;
}

.group-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  padding: 0 0.75rem;
  margin-bottom: 0.4rem;
}

.case-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.case-link {
  display: block;
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-btn);
  color: var(--text);
  font-size: 0.9rem;
  transition:
    background-color var(--transition),
    color var(--transition);
}

.case-link:hover {
  background-color: var(--bg);
  text-decoration: none;
}

/* 当前选中项：主色浅底 + 主色文字 */
.case-link--active {
  background-color: var(--primary-soft);
  color: var(--primary-soft-text);
  font-weight: 500;
}
</style>
