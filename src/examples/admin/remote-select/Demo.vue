// ============================================================
// 案例：remote-select 远程搜索选择
// 防抖、加载态、空结果、旧请求丢弃
// ============================================================
<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

// ============================================================
// 数据与状态
// ============================================================

interface Person {
  id: number
  name: string
  dept: string
}

/** 演示数据：真实项目里由接口按关键词返回 */
const people: Person[] = [
  { id: 1, name: '张伟', dept: '增长组' },
  { id: 2, name: '张敏', dept: '财务组' },
  { id: 3, name: '李娜', dept: '设计组' },
  { id: 4, name: '李强', dept: '研发组' },
  { id: 5, name: '王芳', dept: '运营组' },
  { id: 6, name: '赵磊', dept: '研发组' },
  { id: 7, name: '孙悦', dept: '财务组' },
]

const keyword = ref('')
const results = ref<Person[]>([])
const selected = ref<Person | null>(null)
const loading = ref(false)
const open = ref(false)
const queryCount = ref(0)
const staleDropped = ref(0)

let debounceTimer: number | null = null
let requestToken = 0
const requestTimers = new Set<number>()

const resultNames = computed(() => results.value.map((person) => person.name).join('、'))
const selectedText = computed(() => (selected.value ? `${selected.value.name} · ${selected.value.dept}` : '未选择'))

// ============================================================
// 搜索与请求
// ============================================================

/** 输入后等 250ms 再请求，避免每敲一个字都打接口 */
function onInput(value: string): void {
  keyword.value = value
  selected.value = null
  open.value = true
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (!value.trim()) {
    results.value = []
    loading.value = false
    return
  }
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null
    void fetchResults(value.trim())
  }, 250)
}

/**
 * 模拟远程请求：每次请求都有自己的 token。
 * 旧请求晚回来时 token 已经变了，只计数、不写结果。
 */
function fetchResults(query: string): void {
  queryCount.value++
  const token = ++requestToken
  loading.value = true

  const timer = window.setTimeout(() => {
    requestTimers.delete(timer)
    if (token !== requestToken) {
      staleDropped.value++
      return
    }
    results.value = people.filter(
      (person) => person.name.includes(query) || person.dept.includes(query),
    )
    loading.value = false
    open.value = true
  }, 350)
  requestTimers.add(timer)
}

function select(person: Person): void {
  selected.value = person
  keyword.value = person.name
  results.value = []
  open.value = false
}

function clear(): void {
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer)
    debounceTimer = null
  }
  requestToken++
  for (const timer of requestTimers) window.clearTimeout(timer)
  requestTimers.clear()
  keyword.value = ''
  results.value = []
  selected.value = null
  loading.value = false
  open.value = false
}

onUnmounted(() => {
  if (debounceTimer !== null) window.clearTimeout(debounceTimer)
  for (const timer of requestTimers) window.clearTimeout(timer)
  requestTimers.clear()
})
</script>

<template>
  <div class="rs-demo">
    <p class="hint">
      远程搜索别每敲一个字就请求：输入先防抖 250ms，请求期间显示加载态；
      旧请求晚回来时用 token 丢掉，避免「搜李娜却出现张伟」。
    </p>

    <section class="picker">
      <label class="field">
        <span>负责人</span>
        <n-input
          class="rs-input"
          :value="keyword"
          clearable
          placeholder="输入姓名或部门"
          @update:value="onInput"
        />
      </label>

      <div class="status-row">
        <span
          class="status"
          data-stat="loading"
        >{{ loading ? '加载中…' : '就绪' }}</span>
        <span
          class="selected"
          data-stat="selected"
        >{{ selectedText }}</span>
        <n-button
          size="small"
          quaternary
          @click="clear"
        >
          清空
        </n-button>
      </div>

      <div
        v-if="open && (loading || results.length)"
        class="results"
        data-stat="open"
      >
        <p
          v-if="loading"
          class="empty"
        >
          正在搜索「{{ keyword }}」…
        </p>
        <template v-else>
          <n-button
            v-for="person in results"
            :key="person.id"
            quaternary
            block
            class="person"
            :data-person="person.id"
            @click="select(person)"
          >
            <span class="person-name">{{ person.name }}</span>
            <span class="person-dept">{{ person.dept }}</span>
          </n-button>
        </template>
      </div>

      <p
        v-else-if="open && !loading && keyword"
        class="empty"
        data-stat="empty"
      >
        没有匹配的负责人
      </p>
    </section>

    <dl class="metrics">
      <div class="metric">
        <dt>实际请求</dt>
        <dd data-stat="query-count">
          {{ queryCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>丢弃旧响应</dt>
        <dd data-stat="stale-dropped">
          {{ staleDropped }}
        </dd>
      </div>
      <div class="metric">
        <dt>结果数</dt>
        <dd data-stat="result-count">
          {{ results.length }}
        </dd>
      </div>
      <div class="metric">
        <dt>结果姓名</dt>
        <dd data-stat="result-names">
          {{ resultNames || '—' }}
        </dd>
      </div>
    </dl>

    <p class="footnote">
      真实项目里把 <code>fetchResults</code> 换成接口请求，并在新请求发出时
      <code>AbortController.abort()</code> 取消旧请求；token 方案适合无法取消的请求。
    </p>
  </div>
</template>

<style scoped>
.rs-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hint,
.footnote {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

.footnote {
  font-size: var(--demo-text-xs);
}

.picker {
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.status-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.45rem;
}

.status {
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
  color: var(--primary);
}

.selected {
  flex: 1;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.results {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 0.5rem;
  padding-top: 0.45rem;
  border-top: 1px dashed var(--border);
}

.person {
  display: flex;
  justify-content: space-between;
}

.person-name {
  font-size: var(--demo-text-sm);
  color: var(--text);
}

.person-dept {
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.empty {
  margin: 0.5rem 0 0;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
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
    font-size: var(--demo-text-sm);
    font-weight: 600;
    color: var(--text);
  }
}

@media (max-width: 768px) {
  .metrics {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
