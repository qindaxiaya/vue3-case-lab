// ============================================================
// 案例：SSE 流式聊天 + 断线重连（sse-chat）
// 用本地模拟的 token 流演示状态机：
// streaming →（断线）reconnecting →（3s 后）streaming → done
// 断线时记录 Last-Event-ID，重连从断点续传，不重复、不丢字。
// ============================================================
<script setup lang="ts">
import { ref } from 'vue'

type Status = 'idle' | 'streaming' | 'reconnecting' | 'done' | 'aborted'

const status = ref<Status>('idle')
const answer = ref('')
const events = ref<string[]>([])

/** 用户主动中止 */
let aborted = false
/** 下一次取 token 时模拟断线 */
let breakNext = false
/** 已确认收到的事件 ID（断点） */
let lastId = 0

const TOKENS = [
  '流式响应的', '核心', '是「逐步产出」：', '服务端', '每生成', '一小段',
  '就立刻', '推给客户端', '，', '而不是', '等全部', '算完。',
  'SSE ', '基于 ', 'HTTP ', '长连接', '，', '自带', '重连', '语义', '；',
  '关键', '在于', '每次', '事件', '带 ', 'id', '，', '断线后', '用 ',
  'Last-Event-ID', ' 告诉', '服务端', '从哪里', '继续', '。',
]

const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms))

function stamp(): string {
  const d = new Date()
  return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function log(msg: string): void {
  events.value.unshift(`${stamp()}  ${msg}`)
  if (events.value.length > 40) events.value.pop()
}

// ============================================================
// 主流程：可重入的连接循环
// ============================================================

async function startStream(): Promise<void> {
  if (status.value === 'streaming' || status.value === 'reconnecting') return

  aborted = false
  breakNext = false
  answer.value = ''
  lastId = 0
  events.value = []
  status.value = 'streaming'
  log('▶ 建立连接')
  log('  GET /api/chat/stream  Accept: text/event-stream')

  let i = 0

  while (i < TOKENS.length) {
    try {
      for (; i < TOKENS.length; i++) {
        await sleep(150 + Math.random() * 240)
        if (aborted) {
          status.value = 'aborted'
          log('■ 用户中止（abort）')
          return
        }
        //! 模拟网络抖动：抛出错误，走重连分支
        if (breakNext) {
          breakNext = false
          throw new Error('socket hang up')
        }

        answer.value += TOKENS[i]
        lastId = i + 1
        log(`event: token  id=${lastId}  data:"${TOKENS[i]}"`)
      }
      status.value = 'done'
      log('✓ 流结束（done）')
    } catch {
      //! 断线：进入重连状态，等待后从 lastId 续传
      status.value = 'reconnecting'
      log(`✕ 连接中断，Last-Event-ID: ${lastId}`)
      log('  … 3s 后重连')
      await sleep(3000)

      if (aborted) {
        status.value = 'aborted'
        log('■ 用户中止（abort）')
        return
      }

      i = lastId
      status.value = 'streaming'
      log(`↻ 重连成功，从 id=${lastId} 续传`)
      log(`  GET /api/chat/stream  Last-Event-ID: ${lastId}`)
    }
  }
}

/** 下一步取 token 时制造一次断线 */
function simulateBreak(): void {
  if (status.value !== 'streaming') return
  breakNext = true
  log('⚡ 模拟网络中断')
}

function stop(): void {
  if (status.value !== 'streaming' && status.value !== 'reconnecting') return
  aborted = true
  // 真实项目：控制器的 abort 会立刻打断 fetch / EventSource.close()
  log('■ 请求停止…')
}

function resetAll(): void {
  aborted = true
  breakNext = false
  answer.value = ''
  events.value = []
  lastId = 0
  status.value = 'idle'
}

const statusText: Record<Status, string> = {
  idle: '待开始',
  streaming: '生成中',
  reconnecting: '重连中',
  done: '已完成',
  aborted: '已中止',
}
</script>

<template>
  <div class="sse-demo">
    <!-- 状态与控制 -->
    <div class="sse-bar">
      <span
        class="sse-badge"
        :class="status"
      >
        <i class="dot" />
        {{ statusText[status] }}
      </span>
      <span class="sse-stat">id <b>{{ lastId }}</b> / {{ TOKENS.length }}</span>
      <button
        class="btn-act"
        :disabled="status === 'streaming' || status === 'reconnecting'"
        @click="startStream"
      >
        开始生成
      </button>
      <button
        class="btn-ghost"
        :disabled="status !== 'streaming'"
        @click="simulateBreak"
      >
        模拟断线
      </button>
      <button
        class="btn-ghost"
        :disabled="status !== 'streaming' && status !== 'reconnecting'"
        @click="stop"
      >
        停止
      </button>
      <button
        class="btn-ghost"
        @click="resetAll"
      >
        清空
      </button>
    </div>

    <div class="sse-body">
      <!-- 对话区 -->
      <div class="sse-chat">
        <div class="sse-bubble user">
          解释一下 SSE 流式响应和断线重连
        </div>
        <div class="sse-bubble bot">
          <span>{{ answer }}</span>
          <span
            v-if="status === 'streaming'"
            class="sse-caret"
          />
          <span
            v-if="!answer"
            class="sse-empty"
          >等待回答…</span>
        </div>
      </div>

      <!-- 事件日志 -->
      <div class="sse-events">
        <div class="sse-events-title">
          事件日志
        </div>
        <div class="sse-events-body">
          <div
            v-for="(ev, idx) in events"
            :key="`${idx}-${ev}`"
            class="sse-event"
            :class="{ err: ev.includes('中断') || ev.includes('✕') }"
          >
            {{ ev }}
          </div>
        </div>
      </div>
    </div>

    <p class="sse-hint">
      点「模拟断线」→ 状态变「重连中」，3 秒后从 <code>Last-Event-ID</code> 续传，
      回答里不会出现重复片段。真实实现用 <code>fetch + ReadableStream</code>（见代码区）
      或 <code>EventSource</code>（自带重连，但不支持 POST/自定义头）。
    </p>
  </div>
</template>

<style scoped>
.sse-demo {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

/* ---------- 控制栏 ---------- */

.sse-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.sse-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.16rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  background-color: var(--code-bg);
  color: var(--text-secondary);

  .dot {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background-color: var(--text-secondary);
  }

  &.streaming {
    color: var(--primary);
    .dot { background-color: var(--primary); }
  }

  &.reconnecting {
    color: var(--warning);
    .dot { background-color: var(--warning); animation: blink 0.9s infinite; }
  }

  &.done {
    color: var(--success);
    .dot { background-color: var(--success); }
  }

  &.aborted {
    color: var(--danger);
    .dot { background-color: var(--danger); }
  }
}

@keyframes blink {
  50% { opacity: 0.2; }
}

.sse-stat {
  font-size: 0.72rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
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

/* ---------- 主体 ---------- */

.sse-body {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 0.5rem;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
}

.sse-chat {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-height: 12rem;
}

.sse-bubble {
  padding: 0.5rem 0.65rem;
  border-radius: var(--radius-btn);
  font-size: 0.78rem;
  line-height: 1.7;

  &.user {
    align-self: flex-end;
    max-width: 85%;
    background-color: var(--primary);
    color: #fff;
  }

  &.bot {
    background-color: var(--code-bg);
    color: var(--text);
    min-height: 8rem;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.sse-caret {
  display: inline-block;
  width: 2px;
  height: 0.95em;
  background-color: var(--primary);
  vertical-align: text-bottom;
  margin-left: 1px;
  animation: blink 0.8s steps(1) infinite;
}

.sse-empty {
  color: var(--text-secondary);
  font-size: 0.74rem;
}

/* ---------- 日志 ---------- */

.sse-events {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.sse-events-title {
  padding: 0.3rem 0.55rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
  background-color: var(--code-bg);
  border-bottom: 1px solid var(--border);
}

.sse-events-body {
  height: 11.5rem;
  overflow-y: auto;
  padding: 0.35rem 0.5rem;
  background-color: var(--bg);
}

.sse-event {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  line-height: 1.7;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;

  &.err {
    color: var(--danger);
  }
}

.sse-hint {
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
