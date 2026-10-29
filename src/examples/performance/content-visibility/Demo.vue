// ============================================================
// 案例：content-visibility 长列表（content-visibility）
// - 一次渲染 3000 条卡片，节点数始终不变
// - 对比默认渲染与跳过屏外渲染：各测三次取中位数
// - 关键是 contain-intrinsic-size 给屏外内容一个预估高度
// ============================================================
<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

interface Row {
  id: number
  title: string
  level: 'info' | 'warn' | 'error'
  code: string
}

const TOTAL = 3000

/** 固定数据：避免随机数让每次测量不可比 */
const rows: Row[] = Array.from({ length: TOTAL }, (_, i) => ({
  id: i,
  title: `日志条目 ${i + 1} · ${['请求完成', '缓存命中', '任务排队', '连接重试'][i % 4]}`,
  level: i % 11 === 0 ? 'error' : i % 5 === 0 ? 'warn' : 'info',
  code: `trace-${String(i).padStart(5, '0')}`,
}))

const enabled = ref(false)
const listKey = ref(0)
const listEl = ref<HTMLElement | null>(null)
const measuring = ref(false)

/** 两种模式的渲染耗时中位数（毫秒） */
const result = ref<{ off: number | null; on: number | null }>({ off: null, on: null })
const domCount = ref(0)

const speedup = computed(() => {
  if (result.value.off === null || result.value.on === null || result.value.on === 0) return null
  return (result.value.off / result.value.on).toFixed(2)
})

/** 等两帧，覆盖样式计算、布局与绘制提交 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

/** 取中位数：三次测量避免偶然抖动 */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

/** 重新挂载整张列表并测一次：从改开关到两帧后的耗时 */
async function measureOnce(useCv: boolean): Promise<number> {
  enabled.value = useCv
  // 换 key 强制重建节点，两种模式都从零开始，避免复用旧节点
  listKey.value++
  const startedAt = performance.now()

  await nextTick()
  // 强制读取一次尺寸，确保布局真的发生，而不是被浏览器推迟
  const el = listEl.value
  if (el) void el.offsetHeight
  await nextFrame()

  domCount.value = el?.querySelectorAll('.cv-item').length ?? 0
  return performance.now() - startedAt
}

/** 两种模式各跑三次，取中位数后停留在开启模式 */
async function measureBoth(): Promise<void> {
  if (measuring.value) return
  measuring.value = true

  const off: number[] = []
  const on: number[] = []
  for (let i = 0; i < 3; i++) off.push(await measureOnce(false))
  for (let i = 0; i < 3; i++) on.push(await measureOnce(true))

  result.value = {
    off: Math.round(median(off) * 10) / 10,
    on: Math.round(median(on) * 10) / 10,
  }
  measuring.value = false
}

/** 手动切换：只改当前模式，不清空已有测量结果 */
/** 切换渲染模式（n-radio-group 发出的是原始值，收窄成布尔） */
function setMode(next: string | number | boolean | undefined): void {
  if (typeof next !== 'boolean') return
  if (measuring.value || enabled.value === next) return
  enabled.value = next
  listKey.value++
  nextTick(() => {
    domCount.value = listEl.value?.querySelectorAll('.cv-item').length ?? 0
  })
}

/** 回到默认模式并清空结果 */
function reset(): void {
  if (measuring.value) return
  enabled.value = false
  listKey.value++
  result.value = { off: null, on: null }
  domCount.value = 0
}
</script>

<template>
  <div class="cv-demo">
    <div class="bar">
      <!-- 互斥模式组：Naive 单选按钮组自带选中态与键盘操作 -->
      <n-radio-group
        class="modes"
        :value="enabled"
        aria-label="渲染模式"
        :disabled="measuring"
        @update:value="setMode"
      >
        <n-radio-button :value="false">
          默认渲染
        </n-radio-button>
        <n-radio-button :value="true">
          跳过屏外渲染（推荐）
        </n-radio-button>
      </n-radio-group>
      <n-button
        type="primary"
        :disabled="measuring"
        @click="measureBoth"
      >
        {{ measuring ? '测量中…' : '重测两种模式' }}
      </n-button>
      <n-button
        :disabled="measuring"
        @click="reset"
      >
        重置
      </n-button>
    </div>

    <div class="stats">
      <span>总条数 <b>{{ TOTAL }}</b></span>
      <span>实际节点 <b>{{ domCount || '—' }}</b></span>
      <span>默认 <b>{{ result.off ?? '—' }}</b> ms</span>
      <span>跳过屏外 <b>{{ result.on ?? '—' }}</b> ms</span>
      <span v-if="speedup">提速 <b>{{ speedup }}×</b></span>
      <span class="mode-tag">{{ enabled ? '跳过屏外' : '默认' }}</span>
    </div>

    <div
      ref="listEl"
      class="list"
      :class="{ 'list--cv': enabled }"
    >
      <article
        v-for="row in rows"
        :key="`${listKey}-${row.id}`"
        class="cv-item"
        :class="`level-${row.level}`"
      >
        <span class="no">{{ row.id + 1 }}</span>
        <span class="title">{{ row.title }}</span>
        <code>{{ row.code }}</code>
        <span class="badge">{{ row.level }}</span>
      </article>
    </div>

    <p class="hint">
      两种模式节点数都是 3000，区别在于屏幕外的卡片是否参与排版与绘制。
      测量从重建列表开始，到连续两帧结束后停止；各跑三次取中位数。
    </p>
  </div>
</template>

<style scoped>
.cv-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.modes {
  display: inline-flex;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.mode-tag {
  margin-left: auto;
  padding: 0.05rem 0.45rem;
  border-radius: var(--radius-tag);
  background-color: var(--primary-soft);
  color: var(--primary);
  font-size: var(--demo-text-xs);
}

.list {
  height: 360px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
  padding: 0.5rem 0.6rem;
}

.cv-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  height: 64px;
  padding: 0 0.65rem;
  border-bottom: 1px solid var(--border);
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

/* 关键样式：屏外卡片先跳过渲染，高度用预估尺寸撑住滚动条 */
.list--cv .cv-item {
  content-visibility: auto;
  contain-intrinsic-size: auto 64px;
}

.no {
  width: 2.8rem;
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}

code {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.badge {
  flex-shrink: 0;
  min-width: 3.2rem;
  text-align: center;
  padding: 0.05rem 0.35rem;
  border-radius: var(--radius-tag);
  font-size: var(--demo-text-xs);
}

.level-info .badge {
  background-color: var(--primary-soft);
  color: var(--primary);
}

.level-warn .badge {
  background-color: var(--warning-soft);
  color: var(--warning);
}

.level-error .badge {
  background-color: var(--danger-soft);
  color: var(--danger);
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 640px) {
  .cv-item code {
    display: none;
  }

  .mode-tag {
    margin-left: 0;
  }
}
</style>
