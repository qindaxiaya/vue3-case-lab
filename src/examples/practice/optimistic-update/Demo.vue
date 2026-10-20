// ============================================================
// 案例：乐观更新与回滚（optimistic-update）
// - 等响应：请求成功后才改点赞状态（安全但慢）
// - 乐观：先改界面，保存旧值；请求失败按旧值回滚
// - 用 pending 标记阻止同一张卡片重复提交
// ============================================================
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

type Mode = 'pessimistic' | 'optimistic'
type LogTone = 'info' | 'ok' | 'bad'

interface Post {
  id: number
  author: string
  content: string
  likes: number
  liked: boolean
}

interface LogEntry {
  id: number
  text: string
  tone: LogTone
}

const initialPosts: Post[] = [
  { id: 1, author: '林小满', content: '今天把长列表的滚动卡顿修掉了，开心。', likes: 12, liked: false },
  { id: 2, author: '周一帆', content: '周末去爬山，山顶的风比想象中大。', likes: 8, liked: true },
  { id: 3, author: '陈默', content: '新写的一个组合式函数终于稳定了。', likes: 23, liked: false },
]

const posts = ref<Post[]>(initialPosts.map((post) => ({ ...post })))
const mode = ref<Mode>('pessimistic')
const failRequest = ref(false)
const pendingIds = ref<number[]>([])
const logs = ref<LogEntry[]>([])
const notice = ref<{ text: string; tone: LogTone } | null>(null)

const stats = reactive({
  requests: 0,
  confirmed: 0,
  rolledBack: 0,
})

let logSeq = 0

const pendingCount = computed(() => pendingIds.value.length)

function addLog(text: string, tone: LogTone = 'info'): void {
  logs.value.unshift({ id: ++logSeq, text, tone })
  if (logs.value.length > 8) logs.value.pop()
}

function isPending(id: number): boolean {
  return pendingIds.value.includes(id)
}

/** 模拟点赞接口：固定 300ms 延迟，failRequest 打开时必然失败 */
function fakeLike(): Promise<void> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      if (failRequest.value) reject(new Error('服务端返回 500'))
      else resolve()
    }, 300)
  })
}

/** 改变点赞状态：liked 取反，计数随之加减 */
function applyLike(post: Post): void {
  post.liked = !post.liked
  post.likes += post.liked ? 1 : -1
}

/** 点一次赞：按当前模式决定何时改界面 */
async function toggleLike(id: number): Promise<void> {
  if (isPending(id)) return

  const post = posts.value.find((item) => item.id === id)
  if (!post) return

  // 提交前记下旧值，回滚全靠它
  const snapshot = { liked: post.liked, likes: post.likes }
  pendingIds.value = [...pendingIds.value, id]
  stats.requests++
  addLog(`「${post.author}」提交点赞请求`)

  // 乐观模式：请求还没回来，界面就先变
  if (mode.value === 'optimistic') {
    applyLike(post)
    addLog('界面已先行更新，等待服务端确认')
  }

  try {
    await fakeLike()
    if (mode.value === 'pessimistic') {
      // 等响应模式：成功这一刻才改界面
      applyLike(post)
      addLog(`「${post.author}」服务端确认，界面更新`, 'ok')
    } else {
      addLog(`「${post.author}」服务端确认，保留界面结果`, 'ok')
    }
    stats.confirmed++
    notice.value = { text: '点赞成功', tone: 'ok' }
  } catch {
    if (mode.value === 'optimistic') {
      // 失败：按提交前的旧值回滚，界面恢复原样
      const current = posts.value.find((item) => item.id === id)
      if (current) {
        current.liked = snapshot.liked
        current.likes = snapshot.likes
      }
      stats.rolledBack++
      addLog(`「${post.author}」请求失败，已回滚`, 'bad')
      notice.value = { text: '网络开小差，点赞已撤回', tone: 'bad' }
    } else {
      addLog(`「${post.author}」请求失败，界面未变化`, 'bad')
      notice.value = { text: '点赞失败，请重试', tone: 'bad' }
    }
  } finally {
    pendingIds.value = pendingIds.value.filter((item) => item !== id)
  }
}

function setMode(next: Mode): void {
  if (mode.value === next || pendingCount.value > 0) return
  mode.value = next
  logs.value = []
  stats.requests = 0
  stats.confirmed = 0
  stats.rolledBack = 0
  notice.value = null
}

/** 恢复初始数据与统计 */
function reset(): void {
  if (pendingCount.value > 0) return
  posts.value = initialPosts.map((post) => ({ ...post }))
  logs.value = []
  stats.requests = 0
  stats.confirmed = 0
  stats.rolledBack = 0
  notice.value = null
  failRequest.value = false
}
</script>

<template>
  <div class="ou-demo">
    <div class="bar">
      <div
        class="modes"
        role="group"
        aria-label="更新策略"
      >
        <button
          class="mode"
          :class="{ active: mode === 'pessimistic' }"
          :aria-pressed="mode === 'pessimistic'"
          @click="setMode('pessimistic')"
        >
          等响应再改
        </button>
        <button
          class="mode"
          :class="{ active: mode === 'optimistic' }"
          :aria-pressed="mode === 'optimistic'"
          @click="setMode('optimistic')"
        >
          乐观更新（推荐）
        </button>
      </div>
      <button
        class="btn danger"
        :class="{ active: failRequest }"
        :aria-pressed="failRequest"
        @click="failRequest = !failRequest"
      >
        {{ failRequest ? '接口失败：开' : '模拟接口失败' }}
      </button>
      <button
        class="btn ghost"
        :disabled="pendingCount > 0"
        @click="reset"
      >
        重置
      </button>
    </div>

    <div class="stats">
      <span>请求 <b>{{ stats.requests }}</b></span>
      <span>确认 <b>{{ stats.confirmed }}</b></span>
      <span>回滚 <b :class="{ bad: stats.rolledBack > 0 }">{{ stats.rolledBack }}</b></span>
      <span>进行中 <b>{{ pendingCount }}</b></span>
      <span class="mode-tag">{{ mode === 'optimistic' ? '乐观更新' : '等响应' }}</span>
    </div>

    <p
      v-if="notice"
      class="notice"
      :class="`notice--${notice.tone}`"
      role="status"
    >
      {{ notice.text }}
    </p>

    <div class="panels">
      <ul class="posts">
        <li
          v-for="post in posts"
          :key="post.id"
          class="post"
        >
          <span
            class="avatar"
            aria-hidden="true"
          >{{ post.author.slice(0, 1) }}</span>
          <div class="body">
            <div class="meta">
              <b>{{ post.author }}</b>
              <span
                v-if="isPending(post.id)"
                class="pending"
              >提交中…</span>
            </div>
            <p class="content">
              {{ post.content }}
            </p>
          </div>
          <button
            class="like"
            :class="{ liked: post.liked, pending: isPending(post.id) }"
            :disabled="isPending(post.id)"
            :aria-pressed="post.liked"
            :aria-label="`${post.liked ? '取消点赞' : '点赞'}，当前 ${post.likes} 个赞`"
            @click="toggleLike(post.id)"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              aria-hidden="true"
            >
              <path
                d="M12 20.3 4.7 13a4.6 4.6 0 0 1 6.5-6.5l.8.8.8-.8A4.6 4.6 0 1 1 19.3 13Z"
                :fill="post.liked ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linejoin="round"
              />
            </svg>
            <span class="count">{{ post.likes }}</span>
          </button>
        </li>
      </ul>

      <section
        class="panel"
        aria-label="操作日志"
      >
        <header class="panel-head">
          <span>操作日志</span>
          <b>{{ logs.length }} 条</b>
        </header>
        <ul
          v-if="logs.length"
          class="logs"
        >
          <li
            v-for="log in logs"
            :key="log.id"
            class="log"
            :class="`log--${log.tone}`"
          >
            {{ log.text }}
          </li>
        </ul>
        <p
          v-else
          class="empty"
        >
          点任意一条动态的爱心，观察提交、确认与回滚的顺序。
        </p>
      </section>
    </div>

    <p class="hint">
      点亮「模拟接口失败」再点赞：乐观更新会先变色，300ms 后失败并退回原值；
      等响应模式则从头到尾不变。注意提交期间按钮被禁用，防止连点造成重复写入。
    </p>
  </div>
</template>

<style scoped>
.ou-demo {
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
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg-subtle);
}

.mode {
  padding: 0.4rem 0.65rem;
  border: none;
  border-radius: calc(var(--demo-radius) - 2px);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-sm);
  cursor: pointer;
  transition: background-color 0.2s var(--ease-out), color 0.2s var(--ease-out);

  &.active {
    background-color: var(--surface);
    color: var(--primary);
    box-shadow: var(--shadow-soft);
  }
}

.btn {
  padding: var(--demo-control-py) var(--demo-control-px);
  border: 1px solid var(--primary);
  border-radius: var(--demo-radius);
  background-color: transparent;
  color: var(--primary);
  font-size: var(--demo-text-md);
  cursor: pointer;

  &:hover:not(:disabled) {
    background-color: var(--primary);
    color: #fff;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn.ghost {
  border-color: var(--border);
  color: var(--text-secondary);

  &:hover:not(:disabled) {
    background-color: var(--code-bg);
    color: var(--text);
  }
}

.btn.danger {
  border-color: var(--danger);
  color: var(--danger);

  &.active {
    background-color: var(--danger);
    color: #fff;
  }
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

  .bad {
    color: var(--danger);
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

.notice {
  margin: 0;
  padding: 0.45rem 0.7rem;
  border-radius: var(--demo-radius);
  font-size: var(--demo-text-sm);

  &--ok {
    background-color: var(--success-soft);
    color: var(--success);
  }

  &--bad {
    background-color: var(--danger-soft);
    color: var(--danger);
  }
}

.panels {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 0.7rem;
}

.posts {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.post {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--surface);
}

.avatar {
  display: grid;
  place-items: center;
  width: 2.1rem;
  height: 2.1rem;
  flex-shrink: 0;
  border-radius: 50%;
  background-color: var(--primary-soft);
  color: var(--primary);
  font-size: var(--demo-text-md);
}

.body {
  flex: 1;
  min-width: 0;
}

.meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--demo-text-sm);
  color: var(--text);
}

.pending {
  font-size: var(--demo-text-xs);
  color: var(--warning);
}

.content {
  margin: 0.25rem 0 0;
  font-size: var(--demo-text-sm);
  line-height: 1.6;
  color: var(--text-secondary);
}

.like {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background-color: var(--bg);
  color: var(--text-secondary);
  font-size: var(--demo-text-sm);
  cursor: pointer;
  transition: color 0.2s var(--ease-out), border-color 0.2s var(--ease-out),
    background-color 0.2s var(--ease-out), transform 0.15s var(--ease-out);

  &:hover:not(:disabled) {
    border-color: var(--danger);
    color: var(--danger);
  }

  &:active:not(:disabled) {
    transform: scale(0.94);
  }

  &.liked {
    border-color: var(--danger);
    background-color: var(--danger-soft);
    color: var(--danger);
  }

  &.liked svg path {
    fill: currentColor;
  }

  &.pending {
    opacity: 0.65;
    cursor: progress;
  }
}

.count {
  font-family: var(--font-mono);
  min-width: 1.4rem;
  text-align: center;
}

.panel {
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.7rem;
  border-bottom: 1px solid var(--border);
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.logs {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0;
  padding: 0.45rem 0.55rem;
  list-style: none;
}

.log {
  padding: 0.32rem 0.45rem;
  border-radius: var(--radius-sm);
  background-color: var(--code-bg);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
  line-height: 1.5;

  &--ok {
    background-color: var(--success-soft);
    color: var(--success);
  }

  &--bad {
    background-color: var(--danger-soft);
    color: var(--danger);
  }
}

.empty {
  margin: 0;
  padding: 1.2rem 0.8rem;
  text-align: center;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 760px) {
  .panels {
    grid-template-columns: 1fr;
  }

  .mode-tag {
    margin-left: 0;
  }
}
</style>
