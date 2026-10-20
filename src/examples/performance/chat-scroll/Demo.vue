// ============================================================
// 案例：聊天流吸底（chat-scroll）
// 四条规则：
// 1. 在底部时来新消息 → 自动吸底
// 2. 用户上翻查看历史 → 不打扰，只提示「N 条新消息 ↓」
// 3. 自己发送消息 → 无条件回到底部（必须看到刚发的内容）
// 4. 滚到顶部 → 加载更早历史，并保持当前视觉位置
// ============================================================
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'

interface Msg {
  id: number
  from: 'me' | 'other'
  text: string
  /** 高消息（模拟图片/长文），用于验证吸底在高度变化时也生效 */
  tall?: boolean
}

let nextId = 1

function makeMsg(from: 'me' | 'other', text: string, tall = false): Msg {
  return { id: nextId++, from, text, tall }
}

const messages = ref<Msg[]>(
  Array.from({ length: 12 }, (_, i) =>
    makeMsg(i % 3 === 0 ? 'me' : 'other', `历史消息 ${i + 1}：这是一条用于演示滚动位置的聊天记录。`),
  ),
)

const scroller = ref<HTMLElement | null>(null)
const input = ref('')

/** 是否吸底（用户当前在底部附近） */
const stickToBottom = ref(true)
/** 未读新消息数（上翻时累积） */
const unread = ref(0)
/** 正在加载历史 */
const loadingHistory = ref(false)
/** 已加载历史批次数 */
const historyBatches = ref(0)
/** 自动消息开关 */
const autoReply = ref(true)

/** 距离底部阈值 */
const NEAR_BOTTOM = 80

// ============================================================
// 滚动判断
// ============================================================

function isNearBottom(): boolean {
  const el = scroller.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM
}

function onScroll(): void {
  if (!scroller.value) return
  const near = isNearBottom()
  stickToBottom.value = near
  if (near) unread.value = 0

  // 滚到顶部 → 加载历史
  if (scroller.value.scrollTop <= 0 && !loadingHistory.value) {
    void loadHistory()
  }
}

function scrollToBottom(): void {
  const el = scroller.value
  if (!el) return
  el.scrollTop = el.scrollHeight
  unread.value = 0
}

// ============================================================
// 追加消息
// ============================================================

async function append(msg: Msg, force = false): Promise<void> {
  messages.value.push(msg)
  await nextTick()

  if (force || stickToBottom.value) {
    //! force：自己发消息即使正在上翻，也必须回到底部
    stickToBottom.value = true
    scrollToBottom()
  } else {
    //! 上翻中：不改变滚动位置，只累计未读
    unread.value++
  }
}

function send(): void {
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  //! 发送自己的消息：强制吸底，用户要立刻看到刚发出的内容
  void append(makeMsg('me', text), true)
}

/** 模拟对方来消息（含高消息，验证高度变化） */
function incoming(): void {
  const tall = Math.random() < 0.25
  void append(
    makeMsg(
      'other',
      tall
        ? '这是一条很长的消息（模拟图片/多行内容），高度明显高于普通气泡，用来验证吸底在内容高度变化时依然生效。'.repeat(2)
        : `对方消息 ${nextId}：在底部就自动跟，上翻就不打扰。`,
      tall,
    ),
  )
}

// 每 4 秒自动来一条（可关）
const timer = window.setInterval(() => {
  if (autoReply.value) incoming()
}, 4000)

onBeforeUnmount(() => {
  window.clearInterval(timer)
})

// ============================================================
// 加载更早历史：保持视觉位置
// ============================================================

async function loadHistory(): Promise<void> {
  const el = scroller.value
  if (!el || loadingHistory.value) return

  loadingHistory.value = true
  // 模拟网络
  await new Promise((r) => window.setTimeout(r, 600))

  const prevHeight = el.scrollHeight
  const batch = historyBatches.value + 1
  const older = Array.from({ length: 5 }, (_, i) =>
    makeMsg('other', `更早的历史 #${batch}-${i + 1}（上翻加载）`),
  )
  messages.value.unshift(...older)

  await nextTick()
  //! 前插内容后：补上新增高度，视觉位置保持不变（否则会跳到顶部）
  el.scrollTop += el.scrollHeight - prevHeight

  historyBatches.value = batch
  loadingHistory.value = false
}

// ============================================================
// 重置
// ============================================================

function resetAll(): void {
  nextId = 1
  messages.value = Array.from({ length: 12 }, (_, i) =>
    makeMsg(i % 3 === 0 ? 'me' : 'other', `历史消息 ${i + 1}：这是一条用于演示滚动位置的聊天记录。`),
  )
  unread.value = 0
  historyBatches.value = 0
  stickToBottom.value = true
  void nextTick(scrollToBottom)
}
</script>

<template>
  <div class="chat-demo">
    <!-- 控制 -->
    <div class="chat-bar">
      <span
        class="chat-flag"
        :class="{ stuck: stickToBottom }"
      >
        {{ stickToBottom ? '● 吸底中' : '○ 已上翻（不打扰）' }}
      </span>
      <span class="chat-stat">
        消息 <b>{{ messages.length }}</b> · 历史批次 <b>{{ historyBatches }}</b>
      </span>
      <label class="chat-auto">
        <input
          v-model="autoReply"
          type="checkbox"
        >
        自动来消息
      </label>
      <button
        class="btn-reset"
        @click="resetAll"
      >
        重置
      </button>
    </div>

    <!-- 聊天窗 -->
    <div class="chat-wrap">
      <div
        ref="scroller"
        class="chat-scroller"
        @scroll="onScroll"
      >
        <div class="chat-loading">
          {{ loadingHistory ? '加载更早消息…' : '↑ 滚到顶部加载历史' }}
        </div>

        <div
          v-for="m in messages"
          :key="m.id"
          class="chat-row"
          :class="m.from"
        >
          <div
            class="chat-bubble"
            :class="{ tall: m.tall }"
          >
            {{ m.text }}
          </div>
        </div>
      </div>

      <!-- 未读提示 -->
      <button
        v-if="unread > 0"
        class="chat-new"
        @click="scrollToBottom"
      >
        {{ unread }} 条新消息 ↓
      </button>
    </div>

    <!-- 输入 -->
    <div class="chat-input-row">
      <input
        v-model="input"
        class="chat-input"
        placeholder="输入消息，Enter 发送"
        @keydown.enter="send"
      >
      <button
        class="btn-act"
        @click="send"
      >
        发送
      </button>
      <button
        class="btn-act"
        @click="incoming"
      >
        模拟对方来消息
      </button>
    </div>

    <p class="chat-hint">
      往上翻看历史时，对方来消息不会把页面拽回底部，只显示「N 条新消息」；
      但自己发送消息会立即回到底部。滚回底部后恢复吸底，滚到最顶部会加载更早记录且保持当前视线位置。
    </p>
  </div>
</template>

<style scoped>
.chat-demo {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ---------- 控制 ---------- */

.chat-bar {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.chat-flag {
  font-size: 0.875rem;
  color: var(--warning);

  &.stuck {
    color: var(--success);
  }
}

.chat-stat {
  font-size: 0.875rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.chat-auto {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.btn-reset {
  margin-left: auto;
  padding: var(--demo-control-py) var(--demo-control-px);
  border-radius: var(--demo-radius);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
}

/* ---------- 聊天窗 ---------- */

.chat-wrap {
  position: relative;
}

.chat-scroller {
  height: 320px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
  padding: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.chat-loading {
  text-align: center;
  font-size: 0.875rem;
  color: var(--text-secondary);
  padding: 0.2rem 0;
  flex-shrink: 0;
}

.chat-row {
  display: flex;
  flex-shrink: 0;

  &.me {
    justify-content: flex-end;
  }
}

.chat-bubble {
  max-width: 78%;
  padding: 0.55rem 0.75rem;
  border-radius: var(--demo-radius);
  font-size: 0.875rem;
  line-height: 1.6;
  background-color: var(--code-bg);
  color: var(--text);
  word-break: break-word;

  .me & {
    background-color: var(--primary);
    color: #fff;
  }

  &.tall {
    /* 模拟图片/多行：高度明显变化 */
    min-height: 96px;
  }
}

.chat-new {
  position: absolute;
  right: 0.6rem;
  bottom: 0.6rem;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  border: 1px solid var(--primary);
  background-color: var(--bg);
  color: var(--primary);
  font-size: 0.875rem;
  cursor: pointer;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.12);
}

/* ---------- 输入 ---------- */

.chat-input-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.chat-input {
  flex: 1;
  min-width: 10rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
  color: var(--text);
  font-size: 0.875rem;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.btn-act {
  padding: var(--demo-control-py) var(--demo-control-px);
  border-radius: var(--demo-radius);
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.875rem;
  cursor: pointer;

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

.chat-hint {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.7;
}
</style>
