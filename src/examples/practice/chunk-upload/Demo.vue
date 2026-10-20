// ============================================================
// 案例：大文件分片上传（chunk-upload）
// SHA-256 取前 16 位当文件指纹 → 查「服务端」是否已有（秒传）
// 没有就按 1MB 切片、并发 3 上传；中途暂停后「续传」只补未完成分片。
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

type ChunkState = 'pending' | 'uploading' | 'done' | 'failed'

interface Chunk {
  index: number
  state: ChunkState
}

const CHUNK_SIZE = 1024 * 1024
const CONCURRENCY = 3

/** 模拟服务端：hash → 已收到的分片下标 */
const serverChunks = new Map<string, Set<number>>()
/** 模拟服务端：已有完整文件的 hash（用于秒传） */
const knownHashes = new Set<string>()

const file = ref<File | null>(null)
const hash = ref('')
const hashMs = ref<number | null>(null)
const computing = ref(false)
const chunks = ref<Chunk[]>([])
const running = ref(false)
const paused = ref(false)
const logs = ref<string[]>([])

function log(text: string): void {
  logs.value.unshift(text)
  if (logs.value.length > 30) logs.value.pop()
}

// ============================================================
// 文件指纹
// ============================================================

async function sha256(f: File): Promise<string> {
  const buffer = await f.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

async function pickFile(f: File): Promise<void> {
  reset()
  file.value = f
  computing.value = true

  const t0 = performance.now()
  hash.value = await sha256(f)
  hashMs.value = performance.now() - t0
  computing.value = false

  const total = Math.ceil(f.size / CHUNK_SIZE)
  chunks.value = Array.from({ length: total }, (_, i) => ({ index: i, state: 'pending' }))

  log(`选择文件：${f.name}（${formatSize(f.size)}，${total} 片）`)
  log(`指纹：${hash.value}（${Math.round(hashMs.value)} ms）`)

  if (knownHashes.has(hash.value)) {
    log('⚡ 服务端已存在相同文件，支持秒传')
  }
}

function onPick(e: Event): void {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (f) void pickFile(f)
  input.value = ''
}

/** 生成 5MB 测试文件 */
function makeTestFile(): void {
  const size = 5 * 1024 * 1024
  const bytes = new Uint8Array(size)
  // 用可重复的伪随机内容，保证同一时间生成的文件指纹稳定
  for (let i = 0; i < size; i += 4096) bytes[i] = i % 251
  void pickFile(new File([bytes], 'demo-5mb.bin', { type: 'application/octet-stream' }))
}

// ============================================================
// 分片上传
// ============================================================

function uploadChunk(index: number): Promise<void> {
  return new Promise((resolve, reject) => {
    window.setTimeout(
      () => {
        if (paused.value) {
          reject(new Error('paused'))
          return
        }
        //! 12% 概率失败：真实网络也会偶发，靠续传补齐
        if (Math.random() < 0.12) {
          reject(new Error('chunk failed'))
          return
        }
        resolve()
      },
      220 + Math.random() * 380,
    )
    void index
  })
}

async function start(): Promise<void> {
  if (!file.value || running.value || computing.value) return

  // 秒传：hash 命中直接完成
  if (knownHashes.has(hash.value)) {
    chunks.value.forEach((c) => (c.state = 'done'))
    log('⚡ 秒传完成：未上传任何分片')
    return
  }

  running.value = true
  paused.value = false

  const server = serverChunks.get(hash.value) ?? new Set<number>()
  serverChunks.set(hash.value, server)

  // 服务端已有的分片直接跳过（真正的断点续传）
  chunks.value.forEach((c) => {
    if (server.has(c.index)) c.state = 'done'
  })

  const pending = chunks.value.filter((c) => c.state !== 'done')
  const total = chunks.value.length
  let cursor = 0

  log(`开始上传：待传 ${pending.length} / ${total} 片，并发 ${CONCURRENCY}`)

  const worker = async (): Promise<void> => {
    while (!paused.value && cursor < pending.length) {
      const chunk = pending[cursor++]
      chunk.state = 'uploading'

      try {
        await uploadChunk(chunk.index)
        chunk.state = 'done'
        server.add(chunk.index)
        if (server.size === total) {
          knownHashes.add(hash.value)
          log(`✓ 全部分片完成，服务端合并（共 ${total} 片）`)
        }
      } catch (err) {
        if (paused.value) {
          chunk.state = 'pending'
          break
        }
        chunk.state = 'failed'
        log(`✕ 分片 ${chunk.index + 1} 失败${err instanceof Error ? '' : ''}`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  running.value = false
  if (paused.value) {
    log('⏸ 已暂停：点「续传」只补未完成分片')
  } else {
    const left = chunks.value.filter((c) => c.state !== 'done').length
    log(left ? `结束：仍有 ${left} 片失败，可点「续传」重试` : '结束：全部成功')
  }
}

function pause(): void {
  if (!running.value) return
  paused.value = true
  log('⏸ 请求暂停…（已发出的分片会自然结束）')
}

function resume(): void {
  if (running.value) return
  paused.value = false
  void start()
}

function reset(): void {
  file.value = null
  hash.value = ''
  hashMs.value = null
  computing.value = false
  chunks.value = []
  running.value = false
  paused.value = false
  logs.value = []
}

// ============================================================
// 统计
// ============================================================

const doneCount = computed(() => chunks.value.filter((c) => c.state === 'done').length)
const failedCount = computed(() => chunks.value.filter((c) => c.state === 'failed').length)
const progress = computed(() =>
  chunks.value.length ? Math.round((doneCount.value / chunks.value.length) * 100) : 0,
)
const instantReady = computed(() => !!hash.value && knownHashes.has(hash.value))

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
</script>

<template>
  <div class="cu-demo">
    <!-- 选择 -->
    <div class="cu-bar">
      <label class="cu-file">
        <input
          type="file"
          class="cu-input"
          @change="onPick"
        >
        选择文件
      </label>
      <button
        class="btn-ghost"
        @click="makeTestFile"
      >
        生成 5MB 测试文件
      </button>
      <button
        class="btn-ghost"
        :disabled="!file || running"
        @click="reset"
      >
        重置
      </button>
    </div>

    <!-- 文件信息 -->
    <div
      v-if="file"
      class="cu-meta"
    >
      <span class="cu-name">{{ file.name }}</span>
      <span class="cu-kv">大小 <b>{{ formatSize(file.size) }}</b></span>
      <span class="cu-kv">
        指纹
        <b v-if="computing">计算中…</b>
        <b v-else>{{ hash || '—' }}</b>
      </span>
      <span
        v-if="hashMs !== null"
        class="cu-kv"
      >哈希耗时 <b>{{ Math.round(hashMs) }} ms</b></span>
      <span
        v-if="instantReady"
        class="cu-instant"
      >⚡ 可秒传</span>
    </div>

    <!-- 分片网格 -->
    <div
      v-if="chunks.length"
      class="cu-chunks"
      :title="`共 ${chunks.length} 片，每片 1MB`"
    >
      <span
        v-for="c in chunks"
        :key="c.index"
        class="cu-chunk"
        :class="c.state"
        :title="`分片 ${c.index + 1}`"
      />
    </div>

    <!-- 进度与控制 -->
    <div
      v-if="chunks.length"
      class="cu-progress-row"
    >
      <div class="cu-progress">
        <span :style="{ width: `${progress}%` }" />
      </div>
      <span class="cu-pct">{{ progress }}%</span>
    </div>

    <div
      v-if="chunks.length"
      class="cu-bar"
    >
      <button
        class="btn-act"
        :disabled="running || computing || doneCount === chunks.length"
        @click="start"
      >
        {{ doneCount === chunks.length ? '已完成' : '开始上传' }}
      </button>
      <button
        class="btn-ghost"
        :disabled="!running"
        @click="pause"
      >
        暂停（模拟断网）
      </button>
      <button
        class="btn-ghost"
        :disabled="running || doneCount === chunks.length"
        @click="resume"
      >
        续传
      </button>
      <span class="cu-kv">
        完成 <b>{{ doneCount }}</b> / {{ chunks.length }}
        <template v-if="failedCount"> · 失败 <b class="bad">{{ failedCount }}</b></template>
      </span>
    </div>

    <!-- 日志 -->
    <div
      v-if="logs.length"
      class="cu-logs"
    >
      <div
        v-for="(line, i) in logs"
        :key="`${i}-${line}`"
        class="cu-log"
        :class="{ err: line.includes('✕') }"
      >
        {{ line }}
      </div>
    </div>

    <p
      v-else
      class="cu-empty"
    >
      选一个文件或生成 5MB 测试文件，查看指纹计算、分片网格与并发上传。
    </p>

    <p class="cu-hint">
      指纹在本地用 <code>crypto.subtle.digest</code> 计算（5MB 约几十毫秒）；
      真实大文件要放进 Web Worker，否则会卡主线程。点「暂停」再「续传」——
      只补没完成的分片；对同一文件再点「开始上传」会走秒传。
    </p>
  </div>
</template>

<style scoped>
.cu-demo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ---------- 控制 ---------- */

.cu-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.cu-file {
  padding: 0.22rem 0.55rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--primary);
  color: var(--primary);
  font-size: 0.72rem;
  cursor: pointer;

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

.cu-input {
  display: none;
}

.btn-act,
.btn-ghost {
  padding: 0.22rem 0.55rem;
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
  cursor: pointer;
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);

  &:hover:not(:disabled) {
    background-color: var(--primary);
    color: #fff;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.btn-ghost {
  border-color: var(--border);
  color: var(--text-secondary);

  &:hover:not(:disabled) {
    background-color: var(--code-bg);
    color: var(--text);
  }
}

/* ---------- 元信息 ---------- */

.cu-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--code-bg);
}

.cu-name {
  font-size: 0.74rem;
  color: var(--text);
  word-break: break-all;
}

.cu-kv {
  font-size: 0.7rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);

    &.bad {
      color: var(--danger);
    }
  }
}

.cu-instant {
  margin-left: auto;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  font-size: 0.66rem;
  background-color: var(--success);
  color: #fff;
}

/* ---------- 分片网格 ---------- */

.cu-chunks {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 0.45rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
}

.cu-chunk {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background-color: var(--code-bg);
  transition: background-color 0.15s;

  &.uploading {
    background-color: var(--primary);
    animation: cu-pulse 0.9s ease-in-out infinite;
  }

  &.done {
    background-color: var(--success);
  }

  &.failed {
    background-color: var(--danger);
  }
}

@keyframes cu-pulse {
  50% {
    opacity: 0.35;
  }
}

/* ---------- 进度 ---------- */

.cu-progress-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.cu-progress {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background-color: var(--code-bg);
  overflow: hidden;

  span {
    display: block;
    height: 100%;
    background-color: var(--primary);
    transition: width 0.2s linear;
  }
}

.cu-pct {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--primary);
  min-width: 2.4rem;
  text-align: right;
}

/* ---------- 日志 ---------- */

.cu-logs {
  max-height: 8.5rem;
  overflow-y: auto;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
}

.cu-log {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  line-height: 1.7;
  color: var(--text-secondary);

  &.err {
    color: var(--danger);
  }
}

.cu-empty {
  margin: 0;
  padding: 1.1rem;
  text-align: center;
  font-size: 0.74rem;
  color: var(--text-secondary);
  border: 1px dashed var(--border);
  border-radius: var(--radius-btn);
}

.cu-hint {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-secondary);
  line-height: 1.6;

  code {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 0.02rem 0.24rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}
</style>
