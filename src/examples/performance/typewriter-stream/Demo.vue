// ============================================================
// 案例：流式打字机（typewriter-stream）
// 数据按 token 到达（每个 token 1~4 字），直接拼接到界面会一顿一顿；
// 用「接收缓冲 + rAF 匀速消费」把抖动的到达节奏抹平成平滑输出。
// 指标：已接收 / 已显示 / 积压字符 / 单帧最大跳变。
// ============================================================
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

const SOURCE =
  '流式输出的本质是「生产者-消费者」模型：网络层按自己的节奏吐 token，' +
  '渲染层按帧的节奏消费。直接把 token 拼进文本，遇到网络抖动就会一会儿卡住、' +
  '一会儿蹦出好几个字；加一层缓冲区后，输入再抖，屏幕上的推进速度也是均匀的。' +
  '真实项目里还要处理标点停顿、Markdown 未闭合、代码块高亮延迟等问题。'

type Mode = 'jump' | 'smooth'

const mode = ref<Mode>('smooth')
/** 已接收的完整文本（生产者） */
const received = ref('')
/** 屏幕上显示的长度（消费者） */
const shownLen = ref(0)
/** 待消费字符数 */
const backlog = ref(0)
/** 单帧最大跳变（一次多蹦了几个字） */
const maxJump = ref(0)
/** 状态 */
const running = ref(false)
const finished = ref(false)

const shown = computed(() => received.value.slice(0, shownLen.value))
const progress = computed(() => Math.round((received.value.length / SOURCE.length) * 100))

let timer = 0
let rafId = 0
let receivedLen = 0

// ============================================================
// 生产者：模拟 token 到达（节奏不均）
// ============================================================

function startProducing(): void {
  timer = window.setInterval(() => {
    if (receivedLen >= SOURCE.length) {
      window.clearInterval(timer)
      if (received.value.length === shownLen.value) finished.value = true
      return
    }

    //! 真实 SSE 每个 token 长度不一，这里 1~4 字随机
    const size = 1 + Math.floor(Math.random() * 4)
    receivedLen = Math.min(SOURCE.length, receivedLen + size)
    received.value = SOURCE.slice(0, receivedLen)

    if (mode.value === 'jump') {
      //! 直接同步：屏幕跟着网络节奏跳
      const jump = receivedLen - shownLen.value
      maxJump.value = Math.max(maxJump.value, jump)
      shownLen.value = receivedLen
    } else {
      // 平滑模式：只入队，由 rAF 消费
      backlog.value = receivedLen - shownLen.value
    }

    if (receivedLen >= SOURCE.length && mode.value === 'smooth') {
      window.clearInterval(timer)
    }
  }, 85)
  running.value = true
}

// ============================================================
// 消费者：每帧输出固定预算
// ============================================================

function tick(): void {
  if (mode.value === 'smooth') {
    const pending = receivedLen - shownLen.value
    if (pending > 0) {
      //! 每帧最多 3 字：到达再快，屏幕也匀速走
      const take = Math.min(3, pending)
      shownLen.value += take
      backlog.value = receivedLen - shownLen.value
    }
    if (receivedLen >= SOURCE.length && shownLen.value >= SOURCE.length) {
      finished.value = true
    }
  }
  rafId = requestAnimationFrame(tick)
}

// ============================================================
// 控制
// ============================================================

function resetAll(): void {
  window.clearInterval(timer)
  receivedLen = 0
  received.value = ''
  shownLen.value = 0
  backlog.value = 0
  maxJump.value = 0
  running.value = false
  finished.value = false
}

function restart(): void {
  resetAll()
  startProducing()
}

function switchMode(next: Mode): void {
  if (next === mode.value) return
  // 切换模式时补齐，避免两套状态互相打架
  if (next === 'jump') shownLen.value = receivedLen
  else backlog.value = receivedLen - shownLen.value
  mode.value = next
  maxJump.value = 0
}

/** 立刻输出完剩余内容 */
function flush(): void {
  shownLen.value = receivedLen
  backlog.value = 0
}

rafId = requestAnimationFrame(tick)
onBeforeUnmount(() => {
  window.clearInterval(timer)
  cancelAnimationFrame(rafId)
})
</script>

<template>
  <div class="tw-demo">
    <!-- 控制 -->
    <div class="tw-bar">
      <div class="seg">
        <button
          class="seg-btn"
          :class="{ active: mode === 'jump' }"
          @click="switchMode('jump')"
        >
          直接拼接
        </button>
        <button
          class="seg-btn"
          :class="{ active: mode === 'smooth' }"
          @click="switchMode('smooth')"
        >
          rAF 平滑
        </button>
      </div>
      <button
        class="btn-act"
        :disabled="running"
        @click="restart"
      >
        {{ running ? '输出中…' : '重新开始' }}
      </button>
      <button
        class="btn-ghost"
        :disabled="!received || shownLen >= received.length"
        @click="flush"
      >
        瞬间补完
      </button>
      <button
        class="btn-ghost"
        @click="resetAll"
      >
        清空
      </button>
    </div>

    <!-- 指标 -->
    <div class="tw-metrics">
      <span>接收 <b>{{ received.length }}</b> 字</span>
      <span>显示 <b>{{ shownLen }}</b> 字</span>
      <span>积压 <b :class="{ warn: backlog > 8 }">{{ backlog }}</b></span>
      <span>单帧最大跳变 <b>{{ maxJump }}</b> 字</span>
      <span :class="{ done: finished }">{{ finished ? '✓ 完成' : running ? '● 生成中' : '待开始' }}</span>
    </div>

    <!-- 输出区 -->
    <div class="tw-panel">
      <span class="tw-text">{{ shown }}</span><span
        v-if="running && !finished"
        class="tw-caret"
      />
      <span
        v-if="!received"
        class="tw-placeholder"
      >点「重新开始」查看流式输出</span>
    </div>
    <div class="tw-progress">
      <span :style="{ width: `${progress}%` }" />
    </div>

    <p class="tw-hint">
      「直接拼接」模式：网络 token 一到就整段跳到屏幕，单帧跳变经常 2~4 字；
      「rAF 平滑」模式：每帧最多输出 3 字，缓冲积压会随到达速度自动追赶。
      注意观察「积压」的数字——它才是真正的待显示队列长度。
    </p>
  </div>
</template>

<style scoped>
.tw-demo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ---------- 控制 ---------- */

.tw-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.seg {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.seg-btn {
  padding: 0.22rem 0.55rem;
  border: none;
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;

  &.active {
    background-color: var(--primary);
    color: #fff;
  }
}

.btn-act,
.btn-ghost {
  padding: var(--demo-control-py) var(--demo-control-px);
  border-radius: var(--demo-radius);
  font-size: 0.875rem;
  cursor: pointer;
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);

  &:hover:not(:disabled) {
    background-color: var(--primary);
    color: #fff;
  }

  &:disabled {
    opacity: 0.45;
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

/* ---------- 指标 ---------- */

.tw-metrics {
  display: flex;
  gap: 0.7rem;
  flex-wrap: wrap;
  font-size: 0.875rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);

    &.warn {
      color: var(--warning);
    }
  }

  .done {
    color: var(--success);
  }
}

/* ---------- 输出 ---------- */

.tw-panel {
  position: relative;
  min-height: 7rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  font-size: 0.875rem;
  line-height: 1.75;
  color: var(--text);
}

.tw-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.tw-caret {
  display: inline-block;
  width: 2px;
  height: 0.95em;
  background-color: var(--primary);
  vertical-align: text-bottom;
  margin-left: 1px;
  animation: tw-blink 0.9s steps(1) infinite;
}

@keyframes tw-blink {
  50% {
    opacity: 0;
  }
}

.tw-placeholder {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.tw-progress {
  height: 3px;
  border-radius: 999px;
  background-color: var(--code-bg);
  overflow: hidden;

  span {
    display: block;
    height: 100%;
    background-color: var(--primary);
    transition: width 0.12s linear;
  }
}

.tw-hint {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.6;
}
</style>
