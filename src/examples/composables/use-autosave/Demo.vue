// ============================================================
// 案例：useAutosave 自动保存
// 左边每次输入直接写；右边防抖后保存，离开页面时补一次
// ============================================================
<script setup lang="ts">
import { nextTick, onScopeDispose, ref, watch, type Ref } from 'vue'

// ============================================================
// 类型
// ============================================================

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

interface AutosaveOptions {
  /** 停止输入后多久保存（默认 600ms） */
  delay?: number
  /** 真正落盘的函数，可以是 localStorage，也可以是接口 */
  save: (value: string) => Promise<void>
}

// ============================================================
// 封装版：useAutosave
// ============================================================

function useAutosave(source: Ref<string>, options: AutosaveOptions) {
  const delay = options.delay ?? 600
  const status = ref<SaveStatus>('idle')
  const saves = ref(0)
  const lastSavedAt = ref<Date | null>(null)

  let timer: number | null = null
  let pending: string | null = null
  let saving = false
  let generation = 0
  let first = true

  function clearTimer(): void {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  function schedule(): void {
    clearTimer()
    timer = window.setTimeout(() => {
      void flush()
    }, delay)
  }

  /** 把待保存的值真正写下去 */
  async function flush(): Promise<void> {
    clearTimer()
    if (pending === null || saving) return

    const value = pending
    pending = null
    saving = true
    const id = ++generation
    status.value = 'saving'

    try {
      await options.save(value)
      //! 保存期间又输入了，旧结果不能把新状态改成「已保存」
      if (id !== generation) return
      saves.value++
      lastSavedAt.value = new Date()
      status.value = pending === null ? 'saved' : 'dirty'
    } catch {
      if (id !== generation) return
      //! 失败时把值放回去，重试还能保存同一份内容
      if (pending === null) pending = value
      status.value = 'error'
    } finally {
      saving = false
      if (pending !== null && status.value !== 'error') schedule()
    }
  }

  /** 立即保存：失焦、点按钮、离开页面前调用 */
  function flushNow(): Promise<void> {
    return flush()
  }

  /** 清空计时器与状态（演示重置用） */
  function reset(): void {
    clearTimer()
    generation++
    pending = null
    saving = false
    status.value = 'idle'
    saves.value = 0
    lastSavedAt.value = null
  }

  //! 第一次 watch 是初始值 / 恢复出来的草稿，不该再存一遍
  watch(source, (value) => {
    if (first) {
      first = false
      return
    }
    pending = value
    status.value = 'dirty'
    schedule()
  })

  //! 离开页面时把还没落盘的内容补一次；SPA 卸载也要清掉
  function handlePageHide(): void {
    void flush()
  }

  window.addEventListener('pagehide', handlePageHide)

  onScopeDispose(() => {
    window.removeEventListener('pagehide', handlePageHide)
    clearTimer()
    if (pending !== null) void flush()
  })

  return { status, saves, lastSavedAt, flushNow, reset }
}

// ============================================================
// 演示：同一个编辑器，两套保存方式
// ============================================================

const LEFT_KEY = 'autosave-demo-naive'
const RIGHT_KEY = 'autosave-demo-auto'

function readStored(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

const restored = ref(Boolean(readStored(RIGHT_KEY) || readStored(LEFT_KEY)))
const text = ref(readStored(RIGHT_KEY) || readStored(LEFT_KEY) || '')

// ---------- 左边：每次输入直接写 ----------

const leftWrites = ref(0)
const leftSavedAt = ref<Date | null>(null)

function handleInput(value: string): void {
  text.value = value
  //! 手写版：每次输入都同步写，输入 8 个字符就写 8 次
  try {
    localStorage.setItem(LEFT_KEY, value)
    leftWrites.value++
    leftSavedAt.value = new Date()
  } catch {
    // 演示里忽略存储异常
  }
}

// ---------- 右边：防抖 + 离开页面补保存 ----------

const failSave = ref(false)

async function persist(value: string): Promise<void> {
  // 模拟真实接口的耗时，让「保存中」状态看得见
  await new Promise((resolve) => window.setTimeout(resolve, 250))
  if (failSave.value) throw new Error('模拟保存失败')
  localStorage.setItem(RIGHT_KEY, value)
}

const autosave = useAutosave(text, { delay: 600, save: persist })

// ---------- 展示 ----------

const statusText: Record<SaveStatus, string> = {
  idle: '等待输入',
  dirty: '有未保存修改',
  saving: '保存中…',
  saved: '已保存',
  error: '保存失败',
}

function formatTime(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

async function resetDemo(): Promise<void> {
  text.value = ''
  failSave.value = false
  restored.value = false
  leftWrites.value = 0
  leftSavedAt.value = null

  // 等 watch 先跑完，再清掉它排的定时器
  await nextTick()
  autosave.reset()

  try {
    localStorage.removeItem(LEFT_KEY)
    localStorage.removeItem(RIGHT_KEY)
  } catch {
    // 演示里忽略存储异常
  }
}

async function retrySave(): Promise<void> {
  await autosave.flushNow()
}
</script>

<template>
  <div class="as-demo">
    <p class="hint">
      在同一个输入框里连续打字：左边每输入一个字符就写一次；右边等你停下
      600ms 才保存，离开页面时还会补一次。两种方式写的是不同的存储键，互不覆盖。
    </p>

    <div class="editor">
      <div class="editor-head">
        <span class="editor-label">草稿内容</span>
        <span class="editor-meta">
          {{ text.length }} 字
          <span
            v-if="restored"
            class="badge"
            data-stat="restored"
          >已恢复上次草稿</span>
        </span>
      </div>
      <n-input
        :value="text"
        type="textarea"
        :rows="4"
        placeholder="在这里输入内容，观察左右两边的保存次数"
        @update:value="handleInput"
      />
    </div>

    <div class="toolbar">
      <label class="toggle">
        <n-switch
          v-model:value="failSave"
          size="small"
        />
        模拟保存失败
      </label>
      <n-button
        size="small"
        @click="retrySave"
      >
        立即保存
      </n-button>
      <n-button
        size="small"
        @click="resetDemo"
      >
        重置
      </n-button>
    </div>

    <div class="cols">
      <section class="col col--manual">
        <header class="col-head">
          <h3 class="col-title">
            手写版
          </h3>
          <span class="badge">每次输入都写</span>
        </header>

        <dl class="metrics">
          <div class="metric">
            <dt>写入次数</dt>
            <dd data-stat="left-writes">
              {{ leftWrites }}
            </dd>
          </div>
          <div class="metric">
            <dt>最近写入</dt>
            <dd data-stat="left-time">
              {{ formatTime(leftSavedAt) }}
            </dd>
          </div>
          <div class="metric">
            <dt>存储内容</dt>
            <dd
              class="ellipsis"
              data-stat="left-value"
            >
              {{ text || '（空）' }}
            </dd>
          </div>
        </dl>

        <p class="note">
          没有防抖：输入 8 个字符就是 8 次写入；接口慢时会排队，页面卡顿也照写。
        </p>
      </section>

      <section class="col col--ok">
        <header class="col-head">
          <h3 class="col-title">
            useAutosave
          </h3>
          <span
            class="badge"
            :class="{
              'badge--ok': autosave.status.value === 'saved',
              'badge--warn': autosave.status.value === 'dirty' || autosave.status.value === 'saving',
              'badge--error': autosave.status.value === 'error',
            }"
            data-stat="auto-status"
          >
            {{ statusText[autosave.status.value] }}
          </span>
        </header>

        <dl class="metrics">
          <div class="metric">
            <dt>保存次数</dt>
            <dd data-stat="auto-saves">
              {{ autosave.saves.value }}
            </dd>
          </div>
          <div class="metric">
            <dt>最近保存</dt>
            <dd data-stat="auto-time">
              {{ formatTime(autosave.lastSavedAt.value) }}
            </dd>
          </div>
          <div class="metric">
            <dt>存储内容</dt>
            <dd
              class="ellipsis"
              data-stat="auto-value"
            >
              {{ text || '（空）' }}
            </dd>
          </div>
        </dl>

        <p class="note">
          停止输入 600ms 后合并成一次保存；保存中又输入会再排一轮，旧结果不会覆盖新状态。
        </p>
      </section>
    </div>

    <p class="footnote">
      封装默认在 <code>pagehide</code> 时补一次保存；真实项目还可以在失焦、点「发布」时手动
      <code>flushNow()</code>，并把 <code>save</code> 换成接口请求。
    </p>
  </div>
</template>

<style scoped>
.as-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

.editor {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.editor-label {
  font-size: var(--demo-text-sm);
  font-weight: 600;
  color: var(--text);
}

.editor-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
  cursor: pointer;
}

/* ---------- 两栏对照 ---------- */

.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.col--ok {
  border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
  background-color: color-mix(in srgb, var(--primary-soft) 55%, var(--bg));
}

.col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.col-title {
  margin: 0;
  font-size: var(--demo-text-md);
  font-weight: 600;
  color: var(--text);
}

.badge {
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-tag);
  background-color: var(--bg-subtle);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
  white-space: nowrap;
}

.badge--ok {
  background-color: var(--success-soft);
  color: var(--success);
}

.badge--warn {
  background-color: var(--warning-soft);
  color: var(--warning);
}

.badge--error {
  background-color: var(--danger-soft);
  color: var(--danger);
}

/* ---------- 指标 ---------- */

.metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem 0.8rem;
  margin: 0;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;

  dt {
    font-size: var(--demo-text-xs);
    color: var(--text-secondary);
  }

  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.25;
    color: var(--text);
  }
}

.metric dd.ellipsis {
  overflow: hidden;
  font-size: var(--demo-text-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col--manual .metric dd {
  color: var(--warning);
}

.col--ok .metric dd {
  color: var(--success);
}

.note {
  margin: 0;
  font-size: var(--demo-text-xs);
  line-height: 1.7;
  color: var(--text-secondary);
}

.footnote {
  margin: 0;
  font-size: var(--demo-text-xs);
  line-height: 1.7;
  color: var(--text-secondary);

  code {
    font-family: var(--font-mono);
    color: var(--text);
  }
}

@media (max-width: 768px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
</style>
