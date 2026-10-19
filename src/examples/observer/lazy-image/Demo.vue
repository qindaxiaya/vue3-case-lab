// ============================================================
// 案例：IntersectionObserver 图片懒加载（lazy-image）
// - 滚动容器 30 张占位色块，进入视口才「加载」（300ms 模拟网络）
// - 观察器回调日志实时打印 isIntersecting / intersectionRatio
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

/** 观察器回调日志条目（结构化，便于按类型着色） */
interface LogEntry {
  id: number
  /** in-preload=命中预加载区 in-view=真进入视口 out=离开 */
  kind: 'in-preload' | 'in-view' | 'out'
  text: string
}

/** 回调日志（最新在前，最多 6 条） */
const logs = ref<LogEntry[]>([])

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
        const id = Number((entry.target as HTMLElement).dataset.id)
        const ratio = entry.intersectionRatio

        // 人话日志：区分「命中预加载区」（ratio=0，rootMargin 外扩命中）与「真进视口」
        if (!entry.isIntersecting) {
          logs.value.unshift({ id, kind: 'out', text: `第 ${id} 张：离开` })
        } else if (ratio === 0) {
          logs.value.unshift({ id, kind: 'in-preload', text: `第 ${id} 张：进入预加载区（提前触发）` })
        } else {
          logs.value.unshift({ id, kind: 'in-view', text: `第 ${id} 张：进入视口 → 开始加载` })
        }
        if (logs.value.length > 6) logs.value.pop()

        if (entry.isIntersecting) {
          // 进入视口才开始「加载」（真实场景：data-src → src）
          // 每次进入先取消上次未完成的加载，避免重复计数
          const old = loadTimers.get(id)
          if (old) clearTimeout(old)
          loadTimers.set(
            id,
            setTimeout(() => {
              const img = images.value[id - 1]
              if (!img.loaded) {
                img.loaded = true
                loadedCount.value++
              }
              loadTimers.delete(id)
            }, 300),
          )
          // 加载过就停止观察（真实懒加载的常规释放手段）
          if (images.value[id - 1].loaded) observer?.unobserve(entry.target)
        }
      }
    },
    {
      // 交叉根：留空 = 视口（容器 demo 作为 root 见下方 observe 说明）
      root: document.getElementById('lazy-scroll') ?? undefined,
      // 100px 预加载：视口外 100px 就提前触发进入
      rootMargin: usePreload.value ? '100px' : '0px',
      // 进入 0% 即触发（默认）；0.5 需进一半才触发（本例保持 0）
      threshold: 0,
    },
  )

  // 观察所有卡片 DOM
  document.querySelectorAll<HTMLElement>('#lazy-scroll .lazy-card').forEach((el) => {
    observer!.observe(el)
  })
}

/** 切换预加载开关：重建观察器（状态重置，方便来回对比） */
function togglePreload(): void {
  usePreload.value = !usePreload.value
  setupObserver()
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
          @change="togglePreload"
        >
        rootMargin 100px 预加载
      </label>
      <span class="stat">
        已加载
        <b>{{ loadedCount }}</b> / {{ images.length }}
      </span>
    </div>

    <div class="body">
      <!-- 滚动容器（观察器的 root） -->
      <div
        id="lazy-scroll"
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

      <!-- 回调日志：类型着色的事件流 -->
      <div class="log-panel">
        <p class="log-title">
          观察器事件流
        </p>
        <p
          v-if="logs.length === 0"
          class="log-empty"
        >
          滚动右侧列表，每张图的进入/离开都会记录在这里
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
            >{{ log.kind === 'out' ? '离开' : log.kind === 'in-view' ? '视口' : '预载' }}</span>
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
  font-size: 0.85rem;
  color: var(--text);
  cursor: pointer;

  input {
    accent-color: var(--primary);
  }
}

.stat {
  font-size: 0.85rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
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
  font-size: 0.8rem;
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
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.4rem;
}

.log-empty {
  font-size: 0.8rem;
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
  font-size: 0.78rem;
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

/* 类型色：真进视口=主色底、预加载区=虚线淡底、离开=灰 */
.log-item--in-view {
  background-color: color-mix(in srgb, var(--primary) 14%, transparent);
  color: var(--text);
}

.log-item--in-preload {
  background-color: color-mix(in srgb, var(--warning, #f59e0b) 14%, transparent);
  color: var(--text);
}

.log-item--out {
  background-color: var(--bg-subtle);
  color: var(--text-secondary);
}

/* 事件类型标签（视口/预载/离开） */
.log-tag {
  flex-shrink: 0;
  font-size: 0.66rem;
  font-weight: 600;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background-color: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.log-item--in-view .log-tag {
  border-color: var(--primary);
  color: var(--primary);
}

.log-item--in-preload .log-tag {
  border-color: var(--warning, #f59e0b);
}

/* 小屏：日志挪到下方 */
@media (max-width: 768px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
