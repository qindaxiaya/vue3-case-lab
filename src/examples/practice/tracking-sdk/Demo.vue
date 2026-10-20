// ============================================================
// 案例：埋点 SDK（tracking-sdk）
// 事件委托收点击 + IntersectionObserver 收曝光 → 内存队列
// → 满 5 条或每 2 秒批量上报（模拟），日志里能看到每个批次的内容。
// ============================================================
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

type EventType = 'click' | 'exposure' | 'pv'

interface TrackEvent {
  id: number
  type: EventType
  name: string
  extra: string
  ts: string
}

interface Batch {
  id: number
  at: string
  count: number
  events: TrackEvent[]
}

const BATCH_SIZE = 5
const FLUSH_MS = 2000

let eventId = 0
let batchId = 0

const queue = ref<TrackEvent[]>([])
const batches = ref<Batch[]>([])
const totalSent = ref(0)
const autoFlush = ref(true)
const logs = ref<string[]>([])

function now(): string {
  const d = new Date()
  return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function log(text: string): void {
  logs.value.unshift(`${now()}  ${text}`)
  if (logs.value.length > 20) logs.value.pop()
}

// ============================================================
// 入队
// ============================================================

function track(type: EventType, name: string, extra = ''): void {
  queue.value.push({ id: ++eventId, type, name, extra, ts: now() })

  //! 满了立刻发：减少丢失窗口
  if (queue.value.length >= BATCH_SIZE) flush()
}

/** 事件委托：整个页面只挂一个监听器 */
function onClick(e: MouseEvent): void {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-track]')
  if (!el) return
  track('click', el.dataset.track ?? 'unknown', el.dataset.extra ?? '')
}

// ============================================================
// 曝光：进入视口 60% 记一次（每个元素只记一次）
// ============================================================

const scroller = ref<HTMLElement | null>(null)
let exposed = new WeakSet<Element>()
let observer: IntersectionObserver | null = null

onMounted(() => {
  track('pv', 'page_view', 'path=/practice/tracking-sdk')

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const el = entry.target as HTMLElement
        //! 曝光去重：同一个商品反复进出视口只算一次
        if (exposed.has(el)) continue
        exposed.add(el)
        track('exposure', el.dataset.track ?? 'unknown')
        observer?.unobserve(el)
      }
    },
    { root: scroller.value, threshold: 0.6 },
  )

  scroller.value?.querySelectorAll<HTMLElement>('.tk-card').forEach((el) => observer?.observe(el))
})

// ============================================================
// 上报
// ============================================================

function flush(): void {
  if (!queue.value.length) return

  const batch = queue.value.splice(0)
  totalSent.value += batch.length
  batches.value.unshift({
    id: ++batchId,
    at: now(),
    count: batch.length,
    events: batch,
  })
  if (batches.value.length > 8) batches.value.pop()

  //! 真实项目：
  //! navigator.sendBeacon('/collect', new Blob([JSON.stringify({ events: batch })]))
  //! 页面卸载时也能可靠发出，不阻塞跳转
  log(`↑ 上报批次 #${batchId}：${batch.length} 条`)
}

// 定时上报
const timer = window.setInterval(() => {
  if (autoFlush.value && queue.value.length) flush()
}, FLUSH_MS)

onBeforeUnmount(() => {
  window.clearInterval(timer)
  observer?.disconnect()
  // 卸载前把剩余事件发出去
  flush()
})

function reset(): void {
  queue.value = []
  batches.value = []
  totalSent.value = 0
  logs.value = []
  eventId = 0
  batchId = 0
  exposed = new WeakSet()
  observer?.disconnect()
  observer = null

  // 重新建立观察
  if (scroller.value) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          if (exposed.has(el)) continue
          exposed.add(el)
          track('exposure', el.dataset.track ?? 'unknown')
          observer?.unobserve(el)
        }
      },
      { root: scroller.value, threshold: 0.6 },
    )
    scroller.value.querySelectorAll<HTMLElement>('.tk-card').forEach((el) => observer?.observe(el))
  }
}

const cards = [
  { id: 'sku-1001', title: '机械键盘', price: '¥399' },
  { id: 'sku-1002', title: '人体工学椅', price: '¥1299' },
  { id: 'sku-1003', title: '4K 显示器', price: '¥1899' },
  { id: 'sku-1004', title: '降噪耳机', price: '¥899' },
  { id: 'sku-1005', title: '桌面音箱', price: '¥599' },
  { id: 'sku-1006', title: '显示器支架', price: '¥259' },
]
</script>

<template>
  <div
    class="tk-demo"
    @click="onClick"
  >
    <!-- 顶部状态 -->
    <div class="tk-bar">
      <span class="tk-kv">队列 <b>{{ queue.length }}</b> / {{ BATCH_SIZE }}</span>
      <span class="tk-kv">已上报 <b>{{ totalSent }}</b></span>
      <span class="tk-kv">批次 <b>{{ batches.length }}</b></span>
      <label class="tk-switch">
        <input
          v-model="autoFlush"
          type="checkbox"
        >
        每 2s 自动上报
      </label>
      <button
        class="btn-ghost"
        @click="flush"
      >
        立即上报
      </button>
      <button
        class="btn-ghost"
        @click="reset"
      >
        重置
      </button>
    </div>

    <div class="tk-body">
      <!-- 模拟页面 -->
      <div
        ref="scroller"
        class="tk-page"
      >
        <div
          class="tk-banner"
          data-track="banner"
          data-extra="position=top"
        >
          点我：banner 点击埋点
        </div>

        <div
          class="tk-grid"
        >
          <div
            v-for="card in cards"
            :key="card.id"
            class="tk-card"
            :data-track="card.id"
          >
            <div class="tk-card-title">
              {{ card.title }}
            </div>
            <div class="tk-card-price">
              {{ card.price }}
            </div>
            <div class="tk-card-meta">
              data-track="{{ card.id }}"
            </div>
          </div>
        </div>

        <button
          class="tk-cta"
          data-track="cta_buy"
          data-extra="source=demo"
        >
          加入购物车（cta_buy）
        </button>
      </div>

      <!-- 队列与日志 -->
      <div class="tk-side">
        <div class="tk-panel">
          <div class="tk-panel-title">
            待上报队列
          </div>
          <div class="tk-queue">
            <div
              v-for="ev in queue"
              :key="ev.id"
              class="tk-event"
            >
              <span
                class="tk-type"
                :class="ev.type"
              >{{ ev.type }}</span>
              <span class="tk-name">{{ ev.name }}</span>
              <span class="tk-time">{{ ev.ts }}</span>
            </div>
            <p
              v-if="!queue.length"
              class="tk-empty"
            >
              空（满 {{ BATCH_SIZE }} 条或 2 秒后自动上报）
            </p>
          </div>
        </div>

        <div class="tk-panel">
          <div class="tk-panel-title">
            上报批次
          </div>
          <div class="tk-batches">
            <div
              v-for="b in batches"
              :key="b.id"
              class="tk-batch"
            >
              <div class="tk-batch-head">
                #{{ b.id }} · {{ b.at }} · {{ b.count }} 条
              </div>
              <div class="tk-batch-events">
                {{ b.events.map((e) => e.type + ':' + e.name).join(', ') }}
              </div>
            </div>
            <p
              v-if="!batches.length"
              class="tk-empty"
            >
              还没有上报
            </p>
          </div>
        </div>

        <div class="tk-panel">
          <div class="tk-panel-title">
            SDK 日志
          </div>
          <div class="tk-logs">
            <div
              v-for="(line, i) in logs"
              :key="`${i}-${line}`"
              class="tk-log"
            >
              {{ line }}
            </div>
            <p
              v-if="!logs.length"
              class="tk-empty"
            >
              等待事件…
            </p>
          </div>
        </div>
      </div>
    </div>

    <p class="tk-hint">
      卡片进入视口 60% 自动记一次曝光（每个只记一次）；点击用事件委托，整页只有一个监听器。
      真实 SDK 还差三件事：<code>sendBeacon</code> 保证卸载前送达、失败重试与本地缓存、采样与批量压缩。
    </p>
  </div>
</template>

<style scoped>
.tk-demo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ---------- 顶栏 ---------- */

.tk-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.tk-kv {
  font-size: 0.8125rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.tk-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.btn-ghost {
  padding: 0.18rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  cursor: pointer;
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);

  &:hover {
    background-color: var(--code-bg);
    color: var(--text);
  }
}

/* ---------- 主体 ---------- */

.tk-body {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: 0.5rem;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
}

/* ---------- 模拟页面 ---------- */

.tk-page {
  height: 26rem;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tk-banner {
  padding: 1rem;
  border-radius: var(--radius-sm);
  background: linear-gradient(120deg, var(--primary), #06b6d4);
  color: #fff;
  font-size: 0.875rem;
  text-align: center;
  cursor: pointer;
}

.tk-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}

.tk-card {
  padding: 0.55rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--code-bg);
  cursor: pointer;
  transition: border-color 0.15s;

  &:hover {
    border-color: var(--primary);
  }
}

.tk-card-title {
  font-size: 0.8125rem;
  color: var(--text);
}

.tk-card-price {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--primary);
  margin-top: 0.15rem;
}

.tk-card-meta {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin-top: 0.2rem;
  word-break: break-all;
}

.tk-cta {
  margin-top: 0.2rem;
  padding: 0.5rem;
  border: 1px solid var(--primary);
  border-radius: var(--radius-sm);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

/* ---------- 侧栏 ---------- */

.tk-side {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}

.tk-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background-color: var(--bg);
}

.tk-panel-title {
  padding: 0.26rem 0.5rem;
  background-color: var(--code-bg);
  border-bottom: 1px solid var(--border);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.tk-queue,
.tk-batches,
.tk-logs {
  max-height: 7.6rem;
  overflow-y: auto;
  padding: 0.3rem 0.45rem;
}

.tk-event {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  line-height: 1.7;
}

.tk-type {
  padding: 0 0.3rem;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  background-color: var(--code-bg);
  color: var(--text-secondary);

  &.click {
    color: var(--primary);
  }

  &.exposure {
    color: var(--success);
  }

  &.pv {
    color: var(--warning);
  }
}

.tk-name {
  font-family: var(--font-mono);
  color: var(--text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tk-time {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.tk-batch {
  font-size: 0.8125rem;
  padding: 0.15rem 0;
  border-bottom: 1px dashed var(--border);

  &:last-child {
    border-bottom: none;
  }
}

.tk-batch-head {
  font-family: var(--font-mono);
  color: var(--primary);
}

.tk-batch-events {
  font-family: var(--font-mono);
  color: var(--text-secondary);
  word-break: break-all;
  line-height: 1.5;
}

.tk-log {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.7;
  color: var(--text-secondary);
}

.tk-empty {
  margin: 0;
  padding: 0.5rem 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  text-align: center;
}

.tk-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.02rem 0.24rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}
</style>
