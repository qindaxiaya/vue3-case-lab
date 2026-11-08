// ============================================================
// 案例：import-progress 导入进度
// 分批处理、真实进度、暂停继续、取消汇总
// ============================================================
<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

// ============================================================
// 类型与常量
// ============================================================

type Mode = 'fake' | 'batch'
type Status = 'idle' | 'running' | 'paused' | 'cancelled' | 'done'

const TOTAL = 120
const BATCH_SIZE = 10
const BATCH_MS = 120

const mode = ref<Mode>('batch')
const status = ref<Status>('idle')
const processed = ref(0)
const failed = ref(0)
const fakeProgress = ref(0)

let batchTimer: number | null = null
let fakeTimer: number | null = null

const progress = computed(() =>
  mode.value === 'fake' ? fakeProgress.value : Math.round((processed.value / TOTAL) * 100),
)
const batchIndex = computed(() => Math.ceil(processed.value / BATCH_SIZE))
const statusText = computed(() => {
  if (status.value === 'idle') return '待开始'
  if (status.value === 'running') return '处理中'
  if (status.value === 'paused') return '已暂停'
  if (status.value === 'cancelled') return '已取消'
  return mode.value === 'fake' ? '已完成（假进度）' : '已完成'
})

// ============================================================
// 定时器
// ============================================================

function clearTimers(): void {
  if (batchTimer !== null) {
    window.clearTimeout(batchTimer)
    batchTimer = null
  }
  if (fakeTimer !== null) {
    window.clearInterval(fakeTimer)
    fakeTimer = null
  }
}

/** 真实模式：每批处理 BATCH_SIZE 行，处理完再排下一批 */
function scheduleBatch(): void {
  batchTimer = window.setTimeout(() => {
    batchTimer = null
    if (status.value !== 'running') return

    processed.value = Math.min(TOTAL, processed.value + BATCH_SIZE)
    if (processed.value >= TOTAL) {
      status.value = 'done'
      return
    }
    scheduleBatch()
  }, BATCH_MS)
}

/** 假进度：百分比自己涨到 100，但 processed 一直是 0 */
function startFake(): void {
  fakeProgress.value = 0
  status.value = 'running'
  fakeTimer = window.setInterval(() => {
    fakeProgress.value = Math.min(100, fakeProgress.value + 10)
    if (fakeProgress.value >= 100) {
      status.value = 'done'
      clearTimers()
    }
  }, 60)
}

// ============================================================
// 交互
// ============================================================

function start(): void {
  if (status.value === 'running' || status.value === 'paused') return
  clearTimers()
  processed.value = 0
  failed.value = 0
  fakeProgress.value = 0

  if (mode.value === 'fake') {
    startFake()
    return
  }

  status.value = 'running'
  scheduleBatch()
}

function pause(): void {
  if (mode.value !== 'batch' || status.value !== 'running') return
  //! 暂停只停下一批，已经处理完的进度保留
  if (batchTimer !== null) {
    window.clearTimeout(batchTimer)
    batchTimer = null
  }
  status.value = 'paused'
}

function resume(): void {
  if (mode.value !== 'batch' || status.value !== 'paused') return
  status.value = 'running'
  scheduleBatch()
}

function cancel(): void {
  if (status.value !== 'running' && status.value !== 'paused') return
  //! 取消要作废在途定时器，否则取消后还会继续加进度
  clearTimers()
  status.value = 'cancelled'
}

function reset(): void {
  clearTimers()
  processed.value = 0
  failed.value = 0
  fakeProgress.value = 0
  status.value = 'idle'
}

function onModeChange(value: string | number | boolean | undefined): void {
  if (value !== 'fake' && value !== 'batch') return
  clearTimers()
  mode.value = value
  processed.value = 0
  failed.value = 0
  fakeProgress.value = 0
  status.value = 'idle'
}

onUnmounted(clearTimers)
</script>

<template>
  <div class="ip-demo">
    <p class="hint">
      导入 120 行数据：真实模式每批处理 10 行，进度来自已处理条数；假进度只让百分比自己涨，
      暂停或取消时就能看出区别。
    </p>

    <div class="toolbar">
      <n-radio-group
        :value="mode"
        size="small"
        @update:value="onModeChange"
      >
        <n-radio-button value="batch">
          分批处理
        </n-radio-button>
        <n-radio-button value="fake">
          假进度
        </n-radio-button>
      </n-radio-group>
      <n-button
        size="small"
        type="primary"
        :disabled="status === 'running' || status === 'paused'"
        @click="start"
      >
        开始
      </n-button>
      <n-button
        size="small"
        :disabled="mode !== 'batch' || status !== 'running'"
        @click="pause"
      >
        暂停
      </n-button>
      <n-button
        size="small"
        :disabled="mode !== 'batch' || status !== 'paused'"
        @click="resume"
      >
        继续
      </n-button>
      <n-button
        size="small"
        type="warning"
        ghost
        :disabled="status !== 'running' && status !== 'paused'"
        @click="cancel"
      >
        取消
      </n-button>
      <n-button
        size="small"
        quaternary
        @click="reset"
      >
        重置
      </n-button>
    </div>

    <section class="panel">
      <div class="progress-head">
        <span>导入进度</span>
        <strong>{{ progress }}%</strong>
      </div>
      <div class="progress-track">
        <div
          class="progress-bar"
          :style="{ width: `${progress}%` }"
        />
      </div>
      <p class="status">
        状态：<span data-stat="status-text">{{ statusText }}</span>
      </p>
    </section>

    <dl class="metrics">
      <div class="metric">
        <dt>已处理</dt>
        <dd data-stat="processed-count">
          {{ processed }}
        </dd>
      </div>
      <div class="metric">
        <dt>失败</dt>
        <dd data-stat="failed-count">
          {{ failed }}
        </dd>
      </div>
      <div class="metric">
        <dt>当前批次</dt>
        <dd data-stat="batch-index">
          {{ batchIndex }}
        </dd>
      </div>
      <div class="metric">
        <dt>进度</dt>
        <dd data-stat="progress">
          {{ progress }}
        </dd>
      </div>
    </dl>
  </div>
</template>

<style scoped lang="scss">
.ip-demo {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.panel {
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
}

.progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
  font-size: var(--demo-text-sm);

  strong {
    font-variant-numeric: tabular-nums;
  }
}

.progress-track {
  height: 0.55rem;
  overflow: hidden;
  border-radius: var(--radius-tag);
  background: var(--bg);
}

.progress-bar {
  height: 100%;
  border-radius: inherit;
  background: var(--primary);
  transition: width 0.12s linear;
}

.status {
  margin: 0.5rem 0 0;
  color: var(--text-muted);
  font-size: var(--demo-text-xs);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
}

.metric {
  padding: 0.5rem 0.6rem;
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
  text-align: center;

  dt {
    color: var(--text-muted);
    font-size: var(--demo-text-xs);
  }

  dd {
    margin: 0.15rem 0 0;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}

@media (max-width: 640px) {
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
