// ============================================================
// 案例：URLSearchParams 筛选状态进地址栏（url-search-params）
// - 勾选分类 / 输关键词 / 翻页 → URLSearchParams 生成查询串
// - URL 模式下 history.replaceState 实时同步地址栏（不产生历史记录）
// - 「假装分享链接」复制当前地址；pushState 模拟新开、back 触发 popstate 还原
// - 「模拟刷新」对比：内存模式状态丢弃 vs URL 模式从地址栏还原
// - 出错点数从 Demo 内静态清单统计，编码结果实时可见
// ============================================================
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

// ---------- 筛选状态 ----------

/** 分类选项（勾选后作为重复键 cat 写进查询串） */
const CAT_OPTIONS = ['组件', '表单', '工具', '教程'] as const

const selectedCats = ref<string[]>(['组件'])
const keyword = ref('前端 案例库')
const page = ref(1)
const MAX_PAGE = 3

// ---------- 对照模式 ----------

/** memory：状态只在内存（刷新即丢） / url：状态写进地址栏 */
const mode = ref<'memory' | 'url'>('url')

// ---------- 操作反馈 ----------

const toast = ref('勾选/输入任意筛选，观察地址栏查询串实时变化')

/** 叠加一条提示（简单起见只保留最新一条） */
function say(text: string): void {
  toast.value = text
}

// ---------- 地址栏还原 popstate（真实历史栈） ----------

/** 模拟「新开一个分享链接」后进入的分支：只有这时才有可后退的历史 */
const openedLink = ref(false)
/** popstate 还原次数（真实统计，不是演示文案） */
const restoreCount = ref(0)

function onPopState(): void {
  // 从当前地址栏解析状态：浏览器后退是还原数据最自然的通道
  parseFromUrl(location.search)
  openedLink.value = false
  restoreCount.value++
  say('popstate：浏览器后退，状态从地址栏原样还原')
}

onMounted(() => {
  window.addEventListener('popstate', onPopState)
})

onUnmounted(() => {
  window.removeEventListener('popstate', onPopState)
})

// ---------- 生成查询串 ----------

/** 用 URLSearchParams 把状态编码成查询串（自动转义空格/中文/保留字） */
function buildQuery(): string {
  const params = new URLSearchParams()
  for (const cat of selectedCats.value) {
    // 多选分类用重复键：cat=组件&cat=工具（append 而不是 set）
    params.append('cat', cat)
  }
  if (keyword.value.trim()) {
    params.append('kw', keyword.value.trim())
  }
  if (page.value > 1) {
    params.append('page', String(page.value))
  }
  return params.toString()
}

/** 查询串（给地址栏与统计用；URL 模式由 watch 同步写入，见底部 watch） */
const queryText = computed(() => buildQuery())

/** 展示用的完整地址（只读输入框，文本可选中复制） */
const shareUrl = computed(() => `${location.origin}${location.pathname}?${buildQuery()}`)

// ---------- 编码效果实测：关键词怎么被转义 ----------

/** 关键词的编码前后对照（URLSearchParams 自动完成，不手写转义表） */
const kwEncoded = computed(() => new URLSearchParams([['kw', keyword.value]]).get('kw') ?? '')
const kwDecoded = computed(() => new URLSearchParams(`kw=${kwEncoded.value}`).get('kw') ?? '')

// ---------- 手写拼接出错点（Demo 内静态清单，读数从这里来） ----------

const PITFALLS: Array<{ point: string; autoHandled: boolean }> = [
  { point: '漏写 ? 或 &，键值连在一起', autoHandled: true },
  { point: '空格没转义，后半段被截断', autoHandled: true },
  { point: '中文没有编码，链接发出去变乱码', autoHandled: true },
  { point: '值里有等号/和号，参数被拆开', autoHandled: true },
  { point: '加号歧义：被读成空格', autoHandled: true },
  { point: '数组忘记 String()，页码变 12undefined3', autoHandled: true },
  { point: '多选值重复键没处理，只留最后一个', autoHandled: true },
]

/** 手写拼接的风险点总数（静态清单长度） */
const manualRiskCount = PITFALLS.length
/** 其中 URLSearchParams 自动兜住的条数（全部） */
const autoHandledCount = PITFALLS.filter((p) => p.autoHandled).length

// ---------- 状态 ↔ URL 互转 ----------

/** 从查询串还原状态（分享链接 / 后退 / 刷新都走这里） */
function parseFromUrl(search: string): void {
  const params = new URLSearchParams(search)
  const cats = params.getAll('cat')
  selectedCats.value = cats.filter((c) => (CAT_OPTIONS as readonly string[]).includes(c))
  // 没有有效分类时至少保留一个，避免空筛选
  if (selectedCats.value.length === 0) selectedCats.value = ['组件']
  keyword.value = params.get('kw') ?? ''
  const p = Number(params.get('page') ?? '1')
  page.value = Number.isFinite(p) && p >= 1 ? Math.min(p, MAX_PAGE) : 1
}

/** URL 模式下状态实时写入地址栏（replaceState 不增加历史记录，后退不会被灌满） */
function syncUrl(): void {
  if (mode.value !== 'url') return
  history.replaceState(null, '', `${location.pathname}?${buildQuery()}`)
}

/**
 * 模拟「点开一条分享链接」：把当前地址压进真实历史栈再解析
 * 为什么要 pushState：replaceState 不产生新记录，没有可后退的空间
 */
function openSharedLink(): void {
  history.pushState(null, '', `${location.pathname}?${buildQuery()}`)
  openedLink.value = true
  say('已用当前筛选压入历史栈（等同新标签打开了一条分享链接），可点「后退」还原')
}

/** 模拟浏览器后退：历史栈出栈，popstate 里从地址栏还原状态 */
function goBack(): void {
  history.back()
}

/**
 * 模拟刷新：
 * - 内存模式 → 状态真的丢了（回到默认筛选，这正是要踩的坑）
 * - URL 模式 → 从当前的地址栏查询串重新解析，状态原样回来
 */
function simulateRefresh(): void {
  if (mode.value === 'memory') {
    selectedCats.value = ['组件']
    keyword.value = ''
    page.value = 1
    say('内存模式：刷新后什么都不会剩，状态回到默认筛选（这就是坑）')
  }
  else {
    parseFromUrl(location.search)
    say('URL 模式：刷新后从地址栏查询串重新初始化，状态没丢')
  }
}

/** 切模式：进内存模式先清地址残留，进 URL 模式立即同步一次（保持两条路径一致） */
/** 切换保存方式（n-radio-group 发出的是原始值，收窄后再用） */
function onModeChange(next: string | number | boolean | undefined): void {
  if (next === 'memory' || next === 'url') switchMode(next)
}

function switchMode(next: 'memory' | 'url'): void {
  if (mode.value === next) return
  mode.value = next
  if (next === 'memory') {
    history.replaceState(null, '', location.pathname)
    say('内存模式：状态只存在组件里，不再写地址栏')
  }
  else {
    syncUrl()
    say('URL 模式：筛选变化会实时写进地址栏')
  }
}

/** 重置：回到默认状态并清掉地址查询串 */
function resetAll(): void {
  selectedCats.value = ['组件']
  keyword.value = '前端 案例库'
  page.value = 1
  syncUrl()
  say('已重置为默认筛选')
}

/** 翻页（越界钳制，页码不会跑飞） */
function turnPage(delta: number): void {
  page.value = Math.min(MAX_PAGE, Math.max(1, page.value + delta))
  syncUrl()
}

// ---------- 监听：URL 模式下任何筛选变化都同步地址栏 ----------

watch(selectedCats, syncUrl, { deep: true })
watch(keyword, syncUrl)
watch(page, syncUrl)
</script>

<template>
  <div class="us-demo">
    <div class="bar">
      <!-- 互斥模式组：Naive 单选按钮组自带选中态与键盘操作 -->
      <n-radio-group
        class="modes"
        :value="mode"
        aria-label="状态保存方式"
        @update:value="onModeChange"
      >
        <n-radio-button value="memory">
          状态只在内存（刷新即丢）
        </n-radio-button>
        <n-radio-button value="url">
          URL 同步（刷新/后退/分享都还原）
        </n-radio-button>
      </n-radio-group>
      <n-button
        type="primary"
        ghost
        @click="simulateRefresh"
      >
        模拟刷新
      </n-button>
      <n-button @click="resetAll">
        重置
      </n-button>
    </div>

    <div class="filters">
      <div
        class="chips"
        role="group"
        aria-label="分类多选"
      >
        <n-button
          v-for="cat in CAT_OPTIONS"
          :key="cat"
          size="small"
          :type="selectedCats.includes(cat) ? 'primary' : 'default'"
          :aria-pressed="selectedCats.includes(cat)"
          @click="selectedCats.includes(cat)
            ? selectedCats = selectedCats.filter((c) => c !== cat)
            : selectedCats.push(cat)"
        >
          {{ cat }}
        </n-button>
      </div>
      <input
        v-model="keyword"
        class="kw"
        type="text"
        placeholder="输入关键词（试试中文和空格）"
        aria-label="关键词"
      >
      <div class="pager">
        <n-button
          size="small"
          :disabled="page <= 1"
          aria-label="上一页"
          @click="turnPage(-1)"
        >
          上一页
        </n-button>
        <span>第 {{ page }} / {{ MAX_PAGE }} 页</span>
        <n-button
          size="small"
          :disabled="page >= MAX_PAGE"
          aria-label="下一页"
          @click="turnPage(1)"
        >
          下一页
        </n-button>
      </div>
    </div>

    <div class="stats">
      <span>手写拼接风险点 <b>{{ manualRiskCount }}</b> 处（静态清单）</span>
      <span>SearchParams 自动兜住 <b>{{ autoHandledCount }}</b> 处</span>
      <span>查询串长度 <b>{{ queryText.length }}</b> 字符</span>
      <span>popstate 已还原 <b>{{ restoreCount }}</b> 次</span>
    </div>

    <!-- 地址栏镜像：只读，可选中复制 -->
    <label class="url-row">
      <span class="url-label">地址栏</span>
      <input
        class="url-box"
        type="text"
        readonly
        :value="shareUrl"
        aria-label="当前地址"
      >
      <n-button
        type="primary"
        ghost
        @click="openSharedLink"
      >
        假装分享链接（压入历史栈，可后退）
      </n-button>
      <n-button
        v-if="openedLink"
        type="primary"
        @click="goBack"
      >
        浏览器后退（触发 popstate）
      </n-button>
    </label>

    <!-- 编码对照：同一个关键词进查询串前后的样子 -->
    <div class="enc">
      <p class="enc-title">
        关键词编码实时对照（URLSearchParams 自动完成）
      </p>
      <p class="enc-line">
        原文 <code>{{ keyword || '（空）' }}</code>
      </p>
      <p class="enc-line">
        编码后 <code>{{ kwEncoded || '（空）' }}</code>
      </p>
      <p class="enc-line">
        读回原文 <code>{{ kwDecoded || '（空）' }}</code>
      </p>
    </div>

    <!-- 手写拼接触雷清单 -->
    <div class="pitfalls">
      <p class="pit-title">
        手写字符串拼接的 {{ manualRiskCount }} 个出错点（URLSearchParams 全部自动处理）
      </p>
      <ul class="pit-list">
        <li
          v-for="p in PITFALLS"
          :key="p.point"
          class="pit-item"
        >
          <span
            class="pit-badge"
            :class="{ auto: p.autoHandled }"
          >{{ p.autoHandled ? '自动兜住' : '需注意' }}</span>
          {{ p.point }}
        </li>
      </ul>
    </div>

    <p class="toast">
      {{ toast }}
    </p>
  </div>
</template>

<style scoped>
.us-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  min-width: 0;
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.modes {
  display: inline-flex;
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
}

.stats b {
  font-family: var(--font-mono);
  color: var(--primary);
}

.filters {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.chips {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.kw {
  flex: 1 1 200px;
  min-width: 0;
  padding: var(--demo-control-py) var(--demo-control-px);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--surface);
  color: var(--text);
  font-size: var(--demo-text-md);
}

.pager {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.url-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.url-label {
  flex-shrink: 0;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.url-box {
  flex: 1 1 240px;
  min-width: 0;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
  user-select: text;
}

.enc {
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
  padding: 0.6rem 0.8rem;
}

.enc-title {
  margin: 0 0 0.35rem;
  font-size: var(--demo-text-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.enc-line {
  margin: 0.2rem 0;
  font-size: var(--demo-text-sm);
  color: var(--text);
  word-break: break-all;
}

.enc-line code {
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
  color: var(--primary);
  user-select: text;
}

.pitfalls {
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  padding: 0.6rem 0.8rem;
}

.pit-title {
  margin: 0 0 0.35rem;
  font-size: var(--demo-text-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.pit-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.pit-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--demo-text-sm);
  color: var(--text);
}

.pit-badge {
  flex-shrink: 0;
  padding: 0.05rem 0.4rem;
  border-radius: var(--radius-tag);
  background-color: var(--success-soft);
  color: var(--success);
  font-size: var(--demo-text-xs);
}

.toast {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}
</style>
