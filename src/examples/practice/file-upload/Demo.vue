// ============================================================
// 案例：文件上传（file-upload）
// 拖拽/选择 → 类型与大小校验 → 队列（并发 2）→ 模拟进度
// 支持单个取消、失败重试、全部清空；进度条与状态逐项可见。
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

type Status = 'pending' | 'uploading' | 'success' | 'error' | 'canceled'

interface Job {
  id: number
  file: File
  status: Status
  progress: number
  error: string
  /** 取消当前上传（不进入响应式） */
  cancel: (() => void) | null
}

const MAX_SIZE = 2 * 1024 * 1024
const CONCURRENCY = 2

let jobId = 0
const jobs = ref<Job[]>([])
const dragging = ref(false)
const notice = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms))

// ============================================================
// 校验
// ============================================================

function validate(file: File): string | null {
  const ok = file.type.startsWith('image/') || file.type === 'application/pdf'
  if (!ok) return `${file.name}：只支持图片或 PDF`
  if (file.size > MAX_SIZE) return `${file.name}：超过 2MB`
  return null
}

function addFiles(files: FileList | File[]): void {
  const list = Array.from(files)
  const errors: string[] = []

  for (const file of list) {
    const err = validate(file)
    if (err) {
      errors.push(err)
      continue
    }
    jobs.value.push({
      id: ++jobId,
      file,
      status: 'pending',
      progress: 0,
      error: '',
      cancel: null,
    })
  }

  notice.value = errors.length ? errors.join('；') : ''
  void pump()
}

function onPick(e: Event): void {
  const input = e.target as HTMLInputElement
  if (input.files?.length) addFiles(input.files)
  input.value = ''
}

function onDrop(e: DragEvent): void {
  dragging.value = false
  if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files)
}

// ============================================================
// 模拟上传：真实项目用 XHR 的 upload.onprogress
// ============================================================

function simulate(job: Job): Promise<void> {
  return new Promise((resolve, reject) => {
    let progress = 0
    let timer = 0

    const stop = (): void => window.clearInterval(timer)

    //! 取消 = 清定时器 + reject（真实项目是 xhr.abort()）
    job.cancel = () => {
      stop()
      reject(new Error('canceled'))
    }

    timer = window.setInterval(() => {
      //! 随机速度 + 小概率失败：模拟真实网络
      progress = Math.min(100, progress + 5 + Math.random() * 12)
      job.progress = Math.round(progress)

      if (progress < 40 && Math.random() < 0.012) {
        stop()
        reject(new Error('网络中断'))
        return
      }
      if (progress >= 100) {
        stop()
        resolve()
      }
    }, 180)
  })
}

/** 调度：最多 2 个同时上传 */
async function pump(): Promise<void> {
  const uploading = jobs.value.filter((j) => j.status === 'uploading').length
  if (uploading >= CONCURRENCY) return

  const next = jobs.value.find((j) => j.status === 'pending')
  if (!next) return

  next.status = 'uploading'
  next.progress = 0
  next.error = ''

  try {
    await simulate(next)
    next.status = 'success'
    next.progress = 100
  } catch (err) {
    //! 用户取消不要当成错误（状态已由 cancelJob 设为 canceled）
    if (err instanceof Error && err.message === 'canceled') {
      next.progress = 0
    } else {
      next.status = 'error'
      next.error = err instanceof Error ? err.message : '上传失败'
    }
  } finally {
    next.cancel = null
    void pump()
  }
}

// ============================================================
// 操作
// ============================================================

function cancelJob(job: Job): void {
  if (job.status !== 'uploading') return
  job.status = 'canceled'
  job.cancel?.()
}

function retry(job: Job): void {
  if (job.status !== 'error' && job.status !== 'canceled') return
  job.status = 'pending'
  job.progress = 0
  job.error = ''
  void pump()
}

function retryFailed(): void {
  jobs.value
    .filter((j) => j.status === 'error' || j.status === 'canceled')
    .forEach((j) => {
      j.status = 'pending'
      j.progress = 0
      j.error = ''
    })
  void pump()
}

function clearAll(): void {
  jobs.value.forEach((j) => {
    if (j.status === 'uploading') {
      j.status = 'canceled'
      j.cancel?.()
    }
  })
  jobs.value = []
  notice.value = ''
  void sleep(0)
}

// ============================================================
// 统计
// ============================================================

const stats = computed(() => {
  const total = jobs.value.length
  const done = jobs.value.filter((j) => j.status === 'success').length
  const failed = jobs.value.filter((j) => j.status === 'error' || j.status === 'canceled').length
  const overall = total
    ? Math.round(jobs.value.reduce((sum, j) => sum + j.progress, 0) / total)
    : 0
  return { total, done, failed, overall }
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const statusText: Record<Status, string> = {
  pending: '等待中',
  uploading: '上传中',
  success: '成功',
  error: '失败',
  canceled: '已取消',
}
</script>

<template>
  <div class="fu-demo">
    <!-- 拖拽区 -->
    <div
      class="fu-drop"
      :class="{ dragging }"
      role="button"
      tabindex="0"
      @click="fileInput?.click()"
      @keydown.enter="fileInput?.click()"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <span class="fu-drop-icon">⇧</span>
      <span class="fu-drop-text">拖拽文件到此处，或点击选择（图片 / PDF，≤ 2MB）</span>
      <input
        ref="fileInput"
        type="file"
        multiple
        accept="image/*,application/pdf"
        class="fu-input"
        @change="onPick"
      >
    </div>

    <p
      v-if="notice"
      class="fu-notice"
    >
      {{ notice }}
    </p>

    <!-- 总览 -->
    <div
      v-if="jobs.length"
      class="fu-summary"
    >
      <span>共 <b>{{ stats.total }}</b> 个</span>
      <span>成功 <b class="ok">{{ stats.done }}</b></span>
      <span>失败/取消 <b class="bad">{{ stats.failed }}</b></span>
      <span>总进度 <b>{{ stats.overall }}%</b></span>
      <div class="fu-actions">
        <n-button
          size="small"
          :disabled="!stats.failed"
          @click="retryFailed"
        >
          重试失败
        </n-button>
        <n-button
          size="small"
          @click="clearAll"
        >
          清空
        </n-button>
      </div>
    </div>

    <!-- 队列 -->
    <div
      v-if="jobs.length"
      class="fu-list"
    >
      <div
        v-for="job in jobs"
        :key="job.id"
        class="fu-item"
        :class="job.status"
      >
        <div class="fu-item-top">
          <span class="fu-name">{{ job.file.name }}</span>
          <span class="fu-size">{{ formatSize(job.file.size) }}</span>
          <span
            class="fu-status"
            :class="job.status"
          >{{ statusText[job.status] }}</span>
        </div>

        <div class="fu-progress">
          <span :style="{ width: `${job.progress}%` }" />
        </div>

        <div class="fu-item-bottom">
          <span class="fu-pct">{{ job.progress }}%</span>
          <span
            v-if="job.error"
            class="fu-error"
          >{{ job.error }}</span>
          <n-button
            v-if="job.status === 'uploading'"
            class="fu-act"
            size="small"
            @click="cancelJob(job)"
          >
            取消
          </n-button>
          <n-button
            v-else-if="job.status === 'error' || job.status === 'canceled'"
            class="fu-act"
            size="small"
            @click="retry(job)"
          >
            重试
          </n-button>
        </div>
      </div>
    </div>

    <p
      v-else
      class="fu-empty"
    >
      队列为空。选择几张图片试试（也可以把小 PDF 拖进来）。
    </p>

    <p class="fu-hint">
      并发上限 {{ CONCURRENCY }}：同时最多传 2 个，其余排队。真实项目用
      <code>XMLHttpRequest.upload.onprogress</code> 拿真实进度（<code>fetch</code> 不支持上传进度）。
      失败项只重试自己，不会影响已成功的文件。
    </p>
  </div>
</template>

<style scoped>
.fu-demo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ---------- 拖拽区 ---------- */

.fu-drop {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.1rem 0.8rem;
  border: 1.5px dashed var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  cursor: pointer;
  transition: border-color 0.16s, background-color 0.16s;

  &.dragging,
  &:hover {
    border-color: var(--primary);
    background-color: var(--primary-soft);
  }
}

.fu-drop-icon {
  color: var(--primary);
  font-size: 1.05rem;
}

.fu-drop-text {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.fu-input {
  display: none;
}

.fu-notice {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--danger);
  line-height: 1.6;
}

/* ---------- 总览 ---------- */

.fu-summary {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
  font-size: 0.8125rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);

    &.ok {
      color: var(--success);
    }

    &.bad {
      color: var(--danger);
    }
  }
}

.fu-actions {
  margin-left: auto;
  display: flex;
  gap: 0.3rem;
}

/* ---------- 队列 ---------- */

.fu-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 19rem;
  overflow-y: auto;
}

.fu-item {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  &.success {
    border-color: color-mix(in srgb, var(--success) 45%, transparent);
  }

  &.error {
    border-color: color-mix(in srgb, var(--danger) 45%, transparent);
  }
}

.fu-item-top {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.fu-name {
  font-size: 0.8125rem;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.fu-size {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.fu-status {
  font-size: 0.8125rem;
  padding: 0.02rem 0.35rem;
  border-radius: 999px;
  background-color: var(--code-bg);
  color: var(--text-secondary);

  &.uploading {
    color: var(--primary);
  }

  &.success {
    color: var(--success);
  }

  &.error,
  &.canceled {
    color: var(--danger);
  }
}

.fu-progress {
  height: 4px;
  border-radius: 999px;
  background-color: var(--code-bg);
  overflow: hidden;

  span {
    display: block;
    height: 100%;
    background-color: var(--primary);
    transition: width 0.18s linear;
  }
}

.fu-item.success .fu-progress span {
  background-color: var(--success);
}

.fu-item.error .fu-progress span,
.fu-item.canceled .fu-progress span {
  background-color: var(--danger);
}

.fu-item-bottom {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 1.1rem;
}

.fu-pct {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.fu-error {
  font-size: 0.8125rem;
  color: var(--danger);
  flex: 1;
}

.fu-item-bottom .fu-act {
  margin-left: auto;
}

.fu-empty {
  margin: 0;
  padding: 1.1rem;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  border: 1px dashed var(--border);
  border-radius: var(--radius-btn);
}

.fu-hint {
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
