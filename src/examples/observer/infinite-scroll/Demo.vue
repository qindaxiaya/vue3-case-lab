// ============================================================
// 案例：无限滚动加载（infinite-scroll）
// - IntersectionObserver 哨兵元素：滚到底部前 200px 就预取下一页
// - 每页 20 条模拟数据，「加载中」状态防重复触发
// - 滚到底显示「没有更多了」终态
// - onUnmounted disconnect() 释放观察器
// ============================================================
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

// ---------- 数据与分页状态 ----------

/** 每页条数 */
const PAGE_SIZE = 20
/** 已加载的最大页（0 = 未开始） */
const page = ref(0)
/** 总页数（模拟服务端数据有限） */
const TOTAL_PAGES = 5
/** 是否正在加载（防观察器重复触发） */
const loading = ref(false)

/** 列表数据：每项含序号与确定性文案 */
interface Item {
  id: number
  text: string
}

const items = ref<Item[]>([])

/** 是否已到末页 */
const done = ref(false)

/** 日志（最新在前，最多 5 条） */
const logs = ref<string[]>([])

function log(msg: string): void {
  logs.value.unshift(msg)
  if (logs.value.length > 5) logs.value.pop()
}

/** 模拟请求一页数据（300ms 网络延迟） */
async function loadPage(): Promise<void> {
  // 防重入：上一页没回来不再触发
  if (loading.value || done.value) return
  loading.value = true
  const next = page.value + 1
  log(`请求第 ${next} 页…`)

  await new Promise((r) => setTimeout(r, 300))

  const start = next * PAGE_SIZE
  const batch: Item[] = Array.from({ length: PAGE_SIZE }, (_, i) => ({
    id: start + i,
    text: `条目 #${start + i} · 第 ${next} 页`,
  }))
  items.value.push(...batch)
  page.value = next
  loading.value = false

  if (next >= TOTAL_PAGES) {
    done.value = true
    log(`第 ${next} 页加载完成——没有更多了`)
  } else {
    log(`第 ${next} 页加载完成（${PAGE_SIZE} 条）`)
  }
}

// ---------- 哨兵观察器 ----------

/** 观察器实例 */
let observer: IntersectionObserver | null = null
/** 哨兵 DOM（模板 ref） */
const sentinel = ref<HTMLElement | null>(null)

onMounted(() => {
  // rootMargin '200px'：哨兵距容器底 200px 就预取——用户滚到底前数据已就位
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          log('哨兵进入预取区（底部 200px 内）')
          void loadPage()
        }
      }
    },
    {
      root: document.getElementById('is-scroll') ?? undefined,
      rootMargin: '0px 0px 200px 0px', // 只向下扩 200px（下方向预取）
      threshold: 0,
    },
  )
  if (sentinel.value) observer.observe(sentinel.value)

  // 首屏立即加载第一页
  void loadPage()
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div class="is-demo">
    <div class="stats">
      <span>第 <b>{{ page }}</b> / {{ TOTAL_PAGES }} 页</span>
      <span>共 <b>{{ items.length }}</b> 条</span>
      <span v-if="loading">加载中…</span>
      <span
        v-else-if="done"
        class="done-tag"
      >没有更多了</span>
    </div>

    <div class="body">
      <!-- 列表滚动容器 -->
      <div
        id="is-scroll"
        class="list-area"
      >
        <div
          v-for="item in items"
          :key="item.id"
          class="list-item"
        >
          {{ item.text }}
        </div>

        <!-- 加载中占位 -->
        <div
          v-if="loading"
          class="list-loading"
        >
          加载中…
        </div>

        <!-- 哨兵：观察器盯着它，进入底部 200px 就预取 -->
        <div
          ref="sentinel"
          class="sentinel"
          aria-hidden="true"
        >
          <template v-if="done">
            — 到底了 —
          </template>
        </div>
      </div>

      <!-- 事件日志 -->
      <div class="log-panel">
        <p class="log-title">
          加载事件流
        </p>
        <p
          v-if="logs.length === 0"
          class="log-empty"
        >
          列表加载中，每页请求与哨兵触发都会记录
        </p>
        <ul
          v-else
          class="log-list"
        >
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
.is-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.stats {
  display: flex;
  gap: 1.1rem;
  font-size: 0.9375rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.done-tag {
  color: var(--success);
}

.body {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 0.75rem;
}

/* ---------- 列表 ---------- */

.list-area {
  height: 340px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.list-item {
  flex-shrink: 0;
  padding: 0.45rem 0.7rem;
  font-size: 0.9375rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
}

.list-loading {
  flex-shrink: 0;
  text-align: center;
  padding: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

/* 哨兵：高度固定，观察器锚点 */
.sentinel {
  flex-shrink: 0;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

/* ---------- 日志 ---------- */

.log-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.6rem 0.8rem;
  background-color: var(--code-bg);
  max-height: 340px;
  overflow-y: auto;
}

.log-title {
  margin: 0 0 0.4rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.log-empty {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.log-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.875rem;
  line-height: 1.9;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
