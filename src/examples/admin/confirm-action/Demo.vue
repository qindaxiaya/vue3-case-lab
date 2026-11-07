// ============================================================
// 案例：confirm-action Promise 式确认框
// 确认、异步 loading、失败不关闭、重试
// ============================================================
<script setup lang="ts">
import { nextTick, onUnmounted, ref } from 'vue'

/** 确认框配置：task 是点确认后真正执行的动作 */
interface ConfirmOptions {
  title: string
  content: string
  okText: string
  danger?: boolean
  task: () => Promise<void>
}

const open = ref(false)
const options = ref<ConfirmOptions | null>(null)
const loading = ref(false)
const error = ref('')
const okButton = ref<{ $el?: HTMLElement } | null>(null)

const confirmCount = ref(0)
const cancelCount = ref(0)
const successCount = ref(0)
const failCount = ref(0)
const ignoredCount = ref(0)
const lastResult = ref('—')
const failNext = ref(false)

let resolver: ((ok: boolean) => void) | null = null
let alive = true

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** 打开确认框：返回 Promise，调用方 await 后拿结果 */
function confirm(next: ConfirmOptions): Promise<boolean> {
  if (open.value) {
    ignoredCount.value++
    return Promise.resolve(false)
  }

  confirmCount.value++
  options.value = next
  error.value = ''
  loading.value = false
  open.value = true

  void nextTick(() => okButton.value?.$el?.focus())

  return new Promise<boolean>((resolve) => {
    resolver = resolve
  })
}

/** 关闭并结算 Promise；只结算一次 */
function close(result: boolean): void {
  open.value = false
  loading.value = false
  error.value = ''
  options.value = null

  const resolve = resolver
  resolver = null
  resolve?.(result)
}

function handleCancel(): void {
  if (loading.value) return
  cancelCount.value++
  lastResult.value = '取消'
  close(false)
}

/** 确认：先 loading，成功才关；失败留在框里显示原因 */
async function handleOk(): Promise<void> {
  if (!options.value || loading.value) return
  loading.value = true
  error.value = ''

  try {
    await options.value.task()
    if (!alive) return
    successCount.value++
    lastResult.value = '成功'
    close(true)
  } catch (err) {
    if (!alive) return
    failCount.value++
    lastResult.value = '失败'
    error.value = err instanceof Error ? err.message : '操作失败'
    loading.value = false
  }
}

async function askDelete(): Promise<void> {
  await confirm({
    title: '删除草稿',
    content: '删除后不可恢复，确定继续吗？',
    okText: '删除',
    danger: true,
    task: async () => {
      await wait(500)
      if (failNext.value) throw new Error('删除失败：网络超时')
    },
  })
}

async function askPublish(): Promise<void> {
  await confirm({
    title: '发布文章',
    content: '发布后所有访客都能看到，确定现在发布吗？',
    okText: '发布',
    task: async () => {
      await wait(600)
      if (failNext.value) throw new Error('发布失败：网络超时')
    },
  })
}

function onFailChange(value: boolean): void {
  failNext.value = value
}

onUnmounted(() => {
  alive = false
  if (open.value) close(false)
})
</script>

<template>
  <div class="ca-demo">
    <p class="hint">
      确认框不只是「弹一下」：点确认后要等接口，成功后关闭，失败时留在框里显示原因，
      用户可以直接重试。开关模拟接口失败。
    </p>

    <section class="panel">
      <div class="actions">
        <n-button
          type="error"
          ghost
          @click="askDelete"
        >
          删除草稿
        </n-button>
        <n-button
          type="primary"
          @click="askPublish"
        >
          发布文章
        </n-button>
      </div>

      <label class="toggle ca-fail">
        <span>模拟提交失败</span>
        <n-switch
          size="small"
          :value="failNext"
          @update:value="onFailChange"
        />
      </label>

      <dl class="metrics">
        <div class="metric">
          <dt>打开次数</dt>
          <dd data-stat="confirm-count">
            {{ confirmCount }}
          </dd>
        </div>
        <div class="metric">
          <dt>取消</dt>
          <dd data-stat="cancel-count">
            {{ cancelCount }}
          </dd>
        </div>
        <div class="metric">
          <dt>成功</dt>
          <dd data-stat="success-count">
            {{ successCount }}
          </dd>
        </div>
        <div class="metric">
          <dt>失败</dt>
          <dd data-stat="fail-count">
            {{ failCount }}
          </dd>
        </div>
        <div class="metric">
          <dt>重复调用</dt>
          <dd data-stat="ignored-count">
            {{ ignoredCount }}
          </dd>
        </div>
        <div class="metric metric--wide">
          <dt>最近结果</dt>
          <dd data-stat="last-result">
            {{ lastResult }}
          </dd>
        </div>
      </dl>
    </section>

    <p class="footnote">
      原生 confirm 会阻塞页面，也没法显示 loading / 错误；后台操作改成 Promise 式确认框，
      调用方可以直接 <code>await confirm(...)</code>。
    </p>

    <Teleport to="body">
      <div
        v-if="open && options"
        class="ca-mask"
        @click.self="handleCancel"
      >
        <div
          class="ca-dialog"
          role="dialog"
          aria-modal="true"
          :aria-label="options.title"
          @keydown.esc="handleCancel"
        >
          <h3 class="ca-title">
            {{ options.title }}
          </h3>
          <p class="ca-content">
            {{ options.content }}
          </p>

          <p
            v-if="error"
            class="ca-error"
            role="alert"
            data-stat="dialog-error"
          >
            {{ error }}
          </p>

          <div class="ca-actions">
            <n-button
              :disabled="loading"
              @click="handleCancel"
            >
              取消
            </n-button>
            <n-button
              ref="okButton"
              :type="options.danger ? 'error' : 'primary'"
              :loading="loading"
              :disabled="loading"
              @click="handleOk"
            >
              {{ loading ? '提交中…' : options.okText }}
            </n-button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.ca-demo {
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

.panel {
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.6rem;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem 0.8rem;
  margin: 0.65rem 0 0;
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
    color: var(--text);
  }
}

.metric--wide dd {
  font-size: var(--demo-text-sm);
  font-weight: 500;
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

.ca-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background-color: rgb(0 0 0 / 45%);
}

.ca-dialog {
  width: min(26rem, 100%);
  padding: 1.1rem 1.2rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--surface);
  box-shadow: var(--shadow-soft-lg);
}

.ca-title {
  margin: 0 0 0.45rem;
  font-size: 1rem;
  color: var(--text);
}

.ca-content {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

.ca-error {
  margin: 0.6rem 0 0;
  padding: 0.45rem 0.55rem;
  border-radius: var(--radius-tag);
  background-color: var(--danger-soft);
  font-size: var(--demo-text-xs);
  line-height: 1.6;
  color: var(--danger);
}

.ca-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.45rem;
  margin-top: 0.9rem;
}

@media (max-width: 768px) {
  .metrics {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
