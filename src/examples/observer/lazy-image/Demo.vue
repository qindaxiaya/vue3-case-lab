// ============================================================
// 案例：IntersectionObserver 图片懒加载（lazy-image）
// - 滚动容器 30 张占位色块，进入视口才「加载」（300ms 模拟网络）
// - 图片生命周期事件流：滚入记「开始加载」、300ms 后变色同时记「已显示」（与视觉严格同步）
// - rootMargin 预加载开关对比：100px 提前加载 vs 进视口才加载
// - onUnmounted disconnect() 释放观察器
// ============================================================
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

// ---------- 数据：30 张模拟图片（占位色块） ----------

/** 单张模拟图片 */
interface FakeImage {
  id: number
  /** 占位背景色（色相按序号错开） */
  color: string
  /** 是否已加载完成（进入视口 300ms 后置 true） */
  loaded: boolean
}

const images = ref<FakeImage[]>(
  Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    // HSL 色相轮转：一眼能区分不同「图片」
    color: `hsl(${(i * 37) % 360} 65% 72%)`,
    loaded: false,
  })),
)

/** 已加载数量（进度展示） */
const loadedCount = ref(0)

// ---------- 观察器配置与日志 ----------

/** 是否启用 100px 预加载（rootMargin 对比开关） */
const usePreload = ref(true)

/**
 * 是否持续观察已加载的图片
 * 关闭：加载完成即 unobserve（真实懒加载的常规做法）
 * 打开：保留观察，能继续看到已加载图片的「滚入 / 滚出」事件
 */
const keepObserving = ref(false)

/** 滚动容器（模板 ref）：给观察器当 root，也限定卡片查询范围 */
const scrollRoot = ref<HTMLElement | null>(null)

/** 观察器日志条目（图片生命周期事件，与视觉严格同步） */
interface LogEntry {
  id: number
  /** in=滚入开始加载 loaded=图片已显示 out=滚出 */
  kind: 'in' | 'loaded' | 'out'
  text: string
}

/** 回调日志（最新在前；20 条足够看清一轮「滚入 → 完成 → 滚出」） */
const logs = ref<LogEntry[]>([])
const MAX_LOGS = 20

/** 统一写日志：最新在前，超过上限丢弃最旧的一条 */
function pushLog(id: number, kind: LogEntry['kind'], text: string): void {
  logs.value.unshift({ id, kind, text })
  if (logs.value.length > MAX_LOGS) logs.value.pop()
}

/** 观察器实例（卸载 disconnect 用） */
let observer: IntersectionObserver | null = null

/** 每张图的加载延时句柄（卸载时清掉，防止回调已销毁的组件状态） */
const loadTimers = new Map<number, ReturnType<typeof setTimeout>>()

/**
 * （重新）建立观察器：切换 rootMargin 配置时销毁旧的重建
 * root 默认不传 = 视口（注意：不是传 null）
 */
function setupObserver(): void {
  observer?.disconnect()
  // 清掉未完成的加载延时（重建即重置状态）
  loadTimers.forEach((t) => clearTimeout(t))
  loadTimers.clear()
  images.value.forEach((img) => {
    img.loaded = false
  })
  loadedCount.value = 0

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        // 用 data-id 反查是哪张图（entry.target 来自模板 ref）
        const target = entry.target as HTMLElement
        const id = Number(target.dataset.id)
        const img = images.value[id - 1]
        if (!img) continue

        if (entry.isIntersecting) {
          if (!img.loaded) {
            // 同一张图在加载完成前可能反复触发：已有计时器就不再重复打「开始加载」
            if (!loadTimers.has(id)) {
              pushLog(id, 'in', `第 ${id} 张：滚入 → 开始加载`)
              loadTimers.set(
                id,
                setTimeout(() => {
                  const current = images.value[id - 1]
                  if (current && !current.loaded) {
                    //! 加载完成的同一时刻变色 + 打日志（两者严格同步）
                    current.loaded = true
                    loadedCount.value++
                    pushLog(id, 'loaded', `第 ${id} 张：加载完成`)
                    //! 加载完成才停止观察：此时这张图不会再触发加载，unobserve 才是安全的
                    if (!keepObserving.value) observer?.unobserve(target)
                  }
                  loadTimers.delete(id)
                }, 300),
              )
            }
          } else if (keepObserving.value) {
            // 持续观察模式下，已加载图片再次进入也记录，事件流才完整
            pushLog(id, 'in', `第 ${id} 张：滚入（已加载）`)
          }
        } else if (!img.loaded || keepObserving.value) {
          // 未加载 / 加载中的图片滚出也记；持续观察时已加载图片的滚出同样保留
          pushLog(id, 'out', `第 ${id} 张：滚出${img.loaded ? '（已加载）' : ''}`)
        }
      }
    },
    {
      // 交叉根：组件内的滚动容器（模板 ref），留空则退回视口
      root: scrollRoot.value ?? undefined,
      // 100px 预加载：视口外 100px 就提前触发进入
      rootMargin: usePreload.value ? '100px' : '0px',
      // 进入 0% 即触发（默认）；0.5 需进一半才触发（本例保持 0）
      threshold: 0,
    },
  )

  // 观察所有卡片 DOM：只在组件根节点内查，避免命中页面别处的同名 class
  scrollRoot.value?.querySelectorAll<HTMLElement>('.lazy-card').forEach((el) => {
    observer!.observe(el)
  })
}

/** 切换 rootMargin 配置后重建观察器（v-model 已更新 usePreload，这里不再取反） */
function rebuildObserver(): void {
  logs.value = []
  setupObserver()
}

/** 重置列表：清日志、恢复未加载状态、回到顶部，方便重新演示一轮 */
function resetList(): void {
  logs.value = []
  setupObserver()
  scrollRoot.value?.scrollTo({ top: 0, behavior: 'auto' })
}

/**
 * 切换「持续观察已加载图片」
 * 打开时把已加载的卡片重新 observe；关闭时把它们 unobserve，回到常规懒加载行为。
 */
function onKeepObservingChange(): void {
  const root = scrollRoot.value
  if (!root) return

  root.querySelectorAll<HTMLElement>('.lazy-card').forEach((el) => {
    const id = Number(el.dataset.id)
    const img = images.value[id - 1]
    if (!img) return

    if (keepObserving.value) observer?.observe(el)
    else if (img.loaded) observer?.unobserve(el)
  })
}

// ---------- 生命周期 ----------

onMounted(() => {
  setupObserver()
})

onUnmounted(() => {
  // 释放：观察器 + 未完成延时，缺一不可
  observer?.disconnect()
  observer = null
  loadTimers.forEach((t) => clearTimeout(t))
  loadTimers.clear()
})
</script>

<template>
  <div class="lazy-demo">
    <!-- 控制行：预加载开关 + 统计 -->
    <div class="controls">
      <label class="switch">
        <input
          v-model="usePreload"
          type="checkbox"
          @change="rebuildObserver"
        >
        rootMargin 100px 预加载
      </label>
      <label class="switch">
        <input
          v-model="keepObserving"
          type="checkbox"
          @change="onKeepObservingChange"
        >
        持续观察已加载图片
      </label>
      <n-button @click="resetList">
        重置列表
      </n-button>
      <span class="stat">
        已加载
        <b>{{ loadedCount }}</b> / {{ images.length }}
      </span>
    </div>

    <p class="hint">
      关闭「持续观察」时，图片加载完成就 unobserve，日志里不会再有它的「滚出」；打开后可以继续看到已加载图片的滚入 / 滚出，方便观察完整事件流。
    </p>

    <div class="body">
      <!-- 滚动容器（观察器的 root） -->
      <div
        ref="scrollRoot"
        class="scroll-area"
        aria-label="图片列表滚动容器"
      >
        <div
          v-for="img in images"
          :key="img.id"
          class="lazy-card"
          :data-id="img.id"
          :style="{ backgroundColor: img.loaded ? img.color : 'var(--bg)' }"
        >
          <!-- 加载前：骨架提示；加载后：模拟图片内容 -->
          <template v-if="img.loaded">
            图片 #{{ img.id }}
          </template>
          <template v-else>
            <span class="skeleton">待进入视口加载…</span>
          </template>
        </div>
      </div>

      <!-- 日志：图片生命周期事件流（与右侧图片变色严格同步） -->
      <div class="log-panel">
        <p class="log-title">
          图片事件流
        </p>
        <p
          v-if="logs.length === 0"
          class="log-empty"
        >
          滚动左侧列表：未加载的图滚入时记「开始加载」，300ms 后变色同时记「加载完成」。
          开启预加载时，图在滚进容器前就已加载完成（rootMargin 在容器外 100px 触发）。
          打开「持续观察已加载图片」后，已加载的图滚入 / 滚出也会记录。
        </p>
        <ul
          v-else
          class="log-list"
        >
          <li
            v-for="(log, i) in logs"
            :key="`${log.id}-${log.kind}-${i}`"
            class="log-item"
            :class="`log-item--${log.kind}`"
          >
            <span
              class="log-tag"
              aria-hidden="true"
            >{{ log.kind === 'in' ? '滚入' : log.kind === 'loaded' ? '完成' : '滚出' }}</span>
            {{ log.text }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lazy-demo {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.controls {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.switch {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9375rem;
  color: var(--text);
  cursor: pointer;

  input {
    accent-color: var(--primary);
  }
}

.stat {
  font-size: 0.9375rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.65;
  color: var(--text-secondary);
}

.body {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 0.75rem;
}

/* ---------- 滚动容器（观察器 root） ---------- */

.scroll-area {
  height: 320px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background-color: var(--bg);
}

.lazy-card {
  flex-shrink: 0;
  height: 72px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text);
  /* 背景色由内联样式切换（加载前 --bg，加载后随机色） */
  transition: background-color 0.3s ease-out;
}

.skeleton {
  color: var(--text-secondary);
  font-weight: 400;
}

/* ---------- 日志 ---------- */

.log-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.6rem 0.8rem;
  background-color: var(--code-bg);
  max-height: 320px;
  overflow-y: auto;
}

.log-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.4rem;
}

.log-empty {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0;
}

.log-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

/* 事件条目：按类型着色 + 最新一条淡入 */
.log-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.875rem;
  padding: 0.25rem 0.45rem;
  border-radius: var(--radius-sm);
  animation: log-in 0.25s ease-out;
}

@keyframes log-in {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 类型色：滚入=主色、已显示=绿色、滚出=灰 */
.log-item--in {
  background-color: color-mix(in srgb, var(--primary) 14%, transparent);
  color: var(--text);
}

.log-item--loaded {
  background-color: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--text);
}

.log-item--out {
  background-color: var(--bg-subtle);
  color: var(--text-secondary);
}

/* 事件类型标签（滚入/显示/滚出） */
.log-tag {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background-color: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.log-item--in .log-tag {
  border-color: var(--primary);
  color: var(--primary);
}

.log-item--loaded .log-tag {
  border-color: var(--success);
  color: var(--success);
}

/* 小屏：日志挪到下方 */
@media (max-width: 768px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
