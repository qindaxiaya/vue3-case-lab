// ============================================================
// 案例详情页（/cases/:categoryId/:caseId）
// 结构：面包屑 → 页头（标题+难度+标签）→ 演示区 → 说明/源码 tab
// 说明与源码共用一个 tab 组：默认说明，源码按需切换查看
// ============================================================
<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type Component,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { categories } from '../examples/categories'
import { loadCaseNotes } from '../examples/notes'
import {
  allCases,
  getCase,
  loadCaseSource,
  loadDemoComponent,
  type CodeTab,
  type RegisteredCase,
} from '../examples/registry'
import BackToTop from '../components/BackToTop.vue'
import CodeWorkbench from '../components/CodeWorkbench.vue'
import DemoNaive from '../components/demo/DemoNaive.vue'
import NotesPanel from '../components/NotesPanel.vue'
import { caseKey, useCaseHistory } from '../composables/useCaseHistory'
import { smoothScrollTo, stopSmoothScroll } from '../utils/scroll'

const route = useRoute()
const router = useRouter()

// 路由参数查找案例（meta 同步可得；演示与源码按需加载）
const item = computed(() =>
  getCase(String(route.params.categoryId), String(route.params.caseId)),
)

// ============================================================
// 按需加载：演示组件 + 源码文本
// - 每个案例的 Demo.vue / code/*.txt 都是独立 chunk，
//   只有进入该案例才下载，首屏不再背 60 多个案例的源码
// - 序号（seq）保证快速切案例时只接受最后一次请求的结果
// ============================================================

/** 异步资源的加载状态 */
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

/** 当前案例的演示组件（加载完成后才渲染） */
const demoComponent = shallowRef<Component | null>(null)
const demoStatus = ref<LoadStatus>('idle')
/** 演示加载序号：路由快速切换时丢弃过期结果 */
let demoSeq = 0

/** 加载当前案例的演示组件 */
async function loadDemo(): Promise<void> {
  const current = item.value
  const seq = ++demoSeq
  demoComponent.value = null

  if (!current) {
    demoStatus.value = 'idle'
    return
  }

  demoStatus.value = 'loading'
  try {
    const component = await loadDemoComponent(current.categoryId, current.meta.id)
    if (seq !== demoSeq) return
    demoComponent.value = component
    demoStatus.value = 'ready'
  } catch (error) {
    if (seq !== demoSeq) return
    console.error('[case-page] 演示组件加载失败', error)
    demoStatus.value = 'error'
  }
}

/** 核心代码片段（源码 tab 打开后才填充） */
const codeTabs = ref<CodeTab[]>([])
/** Demo.vue 完整源码文本（同上） */
const demoSource = ref('')
const sourceStatus = ref<LoadStatus>('idle')
/** 源码加载序号：切案例后旧请求不回填 */
let sourceSeq = 0

/** 加载当前案例的源码包（Demo 全文 + 全部代码片段，并行请求） */
async function loadSource(): Promise<void> {
  const current = item.value
  if (!current) return
  // 已就绪 / 正在加载：不重复发起（registry 内部还有 Promise 缓存兜底）
  if (sourceStatus.value === 'ready' || sourceStatus.value === 'loading') return

  const seq = ++sourceSeq
  sourceStatus.value = 'loading'
  try {
    const bundle = await loadCaseSource(current.categoryId, current.meta.id)
    if (seq !== sourceSeq) return
    codeTabs.value = bundle.codeTabs
    demoSource.value = bundle.demoSource
    sourceStatus.value = 'ready'
  } catch (error) {
    if (seq !== sourceSeq) return
    console.error('[case-page] 源码加载失败', error)
    sourceStatus.value = 'error'
  }
}

/** 源码加载失败后手动重试 */
function retrySource(): void {
  if (sourceStatus.value === 'loading') return
  sourceStatus.value = 'idle'
  void loadSource()
}

/** 悬停 / 聚焦「源码」tab 时预取源码包，点击时通常已经就绪 */
function prefetchSource(): void {
  if (sourceStatus.value === 'idle') void loadSource()
}

/**
 * 路由切换时重置内容 tab 与异步资源
 * CasePage 在同一路由记录内复用（只换 params），组件不会重建；
 * 不重置的话，从上一个案例的源码切过来会直接停在源码面板。
 * 首次进入（watch 不会触发）由下方的 loadDemo() 负责。
 */
watch(
  () => route.fullPath,
  () => {
    activeTab.value = 'explain'
    // 新案例的 notes 还没加载，清掉上一个案例的等待状态
    tabSwitchSeq++
    notesRendered.value = false
    panelMinHeight.value = 0
    notesRenderedResolve?.()
    notesRenderedResolve = null

    // 丢弃上一个案例的源码，避免看到别人的代码
    sourceSeq++
    codeTabs.value = []
    demoSource.value = ''
    sourceStatus.value = 'idle'

    void loadDemo()
    // 没有 SBAC 说明的案例要靠代码要点兜底，此时提前加载源码
    if (item.value && !item.value.meta.explain) void loadSource()
  },
)

// 首次进入：立刻开始加载演示组件（后续切换由上面的路由 watch 负责）
void loadDemo()

/** 当前分类展示名（面包屑用，找不到回退为原始 id） */
const categoryName = computed(
  () =>
    categories.find((c) => c.id === route.params.categoryId)?.name ??
    String(route.params.categoryId),
)

/** 分类 id → 展示名（相关案例卡片用） */
function categoryLabel(categoryId: string): string {
  return categories.find((c) => c.id === categoryId)?.name ?? categoryId
}

// ============================================================
// 收藏 + 最近浏览
// ============================================================

/** 当前案例的持久化键（分类/案例） */
const currentKey = computed(() =>
  item.value ? caseKey(item.value.categoryId, item.value.meta.id) : '',
)

const { isFavorite, toggleFavorite, recordVisit } = useCaseHistory()

/** 当前案例是否已收藏 */
const favorite = computed(() =>
  currentKey.value ? isFavorite(currentKey.value) : false,
)

// 进入/切换案例即记录浏览（immediate 覆盖首屏直接打开）
watch(
  currentKey,
  (key) => {
    if (key) recordVisit(key)
  },
  { immediate: true },
)

// ============================================================
// 相关案例 + 上一篇 / 下一篇
// - 相关：共享标签数最多的 3 个（跨分类，能串起同类能力）
// - 上下篇：按 registry 的分类 + 字典序，保证顺序稳定可预期
// ============================================================

/** 共享标签数最多的相关案例（至少共享 1 个标签；不够 3 个用同分类补齐） */
const relatedCases = computed<RegisteredCase[]>(() => {
  const current = item.value
  if (!current) return []

  const others = allCases.filter(
    (c) => !(c.categoryId === current.categoryId && c.meta.id === current.meta.id),
  )

  const currentTags = new Set(current.meta.tags)
  const scored = others
    .map((c) => ({
      item: c,
      score: c.meta.tags.filter((tag) => currentTags.has(tag)).length,
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.item.meta.title.localeCompare(b.item.meta.title),
    )
    .map((entry) => entry.item)

  if (scored.length >= 3) return scored.slice(0, 3)

  // 标签不重合时（新分类里的独立技巧很常见）退化成同分类的其他案例，
  // 保证「相关案例」区始终有内容，而不是空一块
  const picked = new Set(scored.map((c) => `${c.categoryId}/${c.meta.id}`))
  const sameCategory = others.filter(
    (c) =>
      c.categoryId === current.categoryId
      && !picked.has(`${c.categoryId}/${c.meta.id}`),
  )

  return [...scored, ...sameCategory].slice(0, 3)
})

/** 当前案例在注册表中的下标（-1 表示未收录） */
const currentIndex = computed(() =>
  item.value
    ? allCases.findIndex(
        (c) => c.categoryId === item.value?.categoryId && c.meta.id === item.value?.meta.id,
      )
    : -1,
)

/** 上一篇（同一顺序上的前一个案例） */
const prevCase = computed<RegisteredCase | null>(() =>
  currentIndex.value > 0 ? allCases[currentIndex.value - 1] : null,
)

/** 下一篇 */
const nextCase = computed<RegisteredCase | null>(() =>
  currentIndex.value >= 0 && currentIndex.value < allCases.length - 1
    ? allCases[currentIndex.value + 1]
    : null,
)

/** 难度 → tag 语义色类 */
const difficultyClass = computed(() => {
  const map = {
    beginner: 'tag--success',
    intermediate: 'tag--warning',
    advanced: 'tag--danger',
  } as const
  return map[item.value?.meta.difficulty ?? 'beginner']
})

/** 难度 → 中文文案 */
const difficultyLabel = computed(() => {
  const map = {
    beginner: '入门',
    intermediate: '进阶',
    advanced: '高级',
  } as const
  return map[item.value?.meta.difficulty ?? 'beginner']
})

// ============================================================
// 返回列表：优先走浏览器历史，才能恢复原来的滚动位置
// ============================================================

/**
 * 返回案例列表
 * - 上一条历史正是列表页 → router.back()（触发 scrollBehavior 的 savedPosition）
 * - 否则（直接打开详情/从首页进入）→ push 到列表
 */
function backToList(): void {
  // Vue Router 4 会把上一条路径写进 history.state.back
  const back = window.history.state?.back as string | undefined
  if (back && (back === '/cases' || back.startsWith('/cases?'))) {
    router.back()
  } else {
    void router.push('/cases')
  }
}

// ============================================================
// 案例说明：自动从教学代码的 //! 重点行提取要点
// ============================================================

const keyPoints = computed<string[]>(() => {
  if (!item.value) return []

  const points: string[] = []
  const seen = new Set<string>()

  // 源码按需加载：未加载时为空（仅作为没有 SBAC 说明时的兜底展示）
  for (const tab of codeTabs.value) {
    for (const line of tab.content.split('\n')) {
      // 与代码区同一套约定：行首 //! 是重点行
      const match = line.match(/^\s*\/\/!\s?(.+)$/)
      if (!match) continue

      const text = match[1].trim()
      // 过滤过短/过长的行，避免把零散标记当要点
      if (text.length < 8 || text.length > 120) continue
      if (seen.has(text)) continue

      seen.add(text)
      points.push(text)
    }
  }

  return points.slice(0, 8)
})

// ============================================================
// 说明 / 深入 / 源码 tab
// ============================================================

/** 内容 tab：说明（SBAC）→ 深入（notes.md）→ 源码 */
type ContentTab = 'explain' | 'notes' | 'code'

/** 键盘左右键的循环顺序 */
const TAB_ORDER: ContentTab[] = ['explain', 'notes', 'code']

/** 默认展示说明：先看演示与讲解，源码不占首屏 */
const activeTab = ref<ContentTab>('explain')
/** tab 栏（吸顶容器）：切换后需要据此判断是否把页面拉回视野 */
const tabsWrapEl = ref<HTMLElement | null>(null)
/** 吸顶栏前的零高度锚点：offsetTop 不随 sticky 变化，用来算稳定的文档位置 */
const tabsAnchorEl = ref<HTMLElement | null>(null)
/** 三个 tab 按钮：键盘左右切换后把焦点交给新选中的按钮 */
const explainTabEl = ref<HTMLButtonElement | null>(null)
const notesTabEl = ref<HTMLButtonElement | null>(null)
const codeTabEl = ref<HTMLButtonElement | null>(null)
/** tab key → 按钮引用（键盘循环用） */
const tabElMap: Record<ContentTab, typeof explainTabEl> = {
  explain: explainTabEl,
  notes: notesTabEl,
  code: codeTabEl,
}

/** tab 容器：测量按钮位置，驱动滑块 */
const tabsEl = ref<HTMLElement | null>(null)
/** 滑块位置与宽度（用 transform 做位移动画，避免触发布局） */
const tabIndicatorStyle = ref({ transform: 'translateX(0px)', width: '0px' })
/** 首次测量完成后再显示滑块，避免从左侧 0 位置滑入 */
const tabIndicatorReady = ref(false)
/** 监听 tab 栏/按钮尺寸变化（字体加载、移动端铺满、源码数量徽章） */
let tabIndicatorObserver: ResizeObserver | null = null
/** 初始显示滑块前的逐帧任务，卸载时需要取消 */
let tabIndicatorRaf = 0

/** 切到 notes 首次加载时临时保留旧面板高度，避免页面骤矮把滚动位置夹走 */
const panelMinHeight = ref(0)
/** 当前案例的 notes 是否已完成一次渲染 */
const notesRendered = ref(false)
/** 等待 notes 渲染的 resolve（切换 tab 时对齐滚动用） */
let notesRenderedResolve: (() => void) | null = null
/** tab 切换序号：快速连点时只让最后一次切换执行滚动 */
let tabSwitchSeq = 0

/** 把当前选中按钮的位置同步给滑块 */
function syncTabIndicator(): void {
  const container = tabsEl.value
  const button = tabElMap[activeTab.value].value
  if (!container || !button) return

  // offsetLeft / offsetWidth 都是相对 tab 容器的布局值，不受 transform 影响
  tabIndicatorStyle.value = {
    transform: `translateX(${button.offsetLeft}px)`,
    width: `${button.offsetWidth}px`,
  }
}

// tab 切换后按钮的字体粗细会变化，等 DOM 更新完再测量
watch(activeTab, async () => {
  await nextTick()
  syncTabIndicator()
})

/** 读取某个面板当前高度（隐藏面板为 0） */
function getPanelHeight(tab: ContentTab): number {
  return document.getElementById(`panel-${tab}`)?.offsetHeight ?? 0
}

/** NotesPanel 完成一次渲染：解除等待，后续切换不再等 */
function onNotesRendered(): void {
  notesRendered.value = true
  notesRenderedResolve?.()
  notesRenderedResolve = null
}

/**
 * 等待 notes 首次渲染
 * 1.5s 兜底：网络异常时也允许继续执行滚动，避免 tab 切换卡住
 */
function waitForNotesRendered(): Promise<void> {
  if (notesRendered.value) return Promise.resolve()

  return new Promise((resolve) => {
    let settled = false
    let timer = 0

    /** 只结束当前这一次等待，快速连点时不误清后来的 resolver */
    const finish = (): void => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      if (notesRenderedResolve === finish) notesRenderedResolve = null
      resolve()
    }

    timer = window.setTimeout(finish, 1500)
    notesRenderedResolve = finish
  })
}

/**
 * 悬停 / 聚焦「深入」时预取当前案例的 notes.md
 * 只提前加载当前这一篇，点击时通常已有缓存，减少首次切换的骨架屏停留
 */
function prefetchNotes(): void {
  const current = item.value
  if (!current) return

  void loadCaseNotes(current.categoryId, current.meta.id).catch(() => {
    // 预取失败不提示；真正点击时 NotesPanel 仍会重新加载并展示重试入口
  })
}

// ============================================================
// 滚动位置计算（tab 切换时对齐用）
// 逐帧缓动滚动本身在 utils/scroll.ts，回到顶部按钮与列表页共用同一份
// ============================================================

/**
 * 读取元素在文档中的绝对顶部位置
 * 不能用 getBoundingClientRect + scrollY：tab 栏吸顶后 rect.top 固定为 64，
 * 算出来的“文档顶部”会跟着滚动位置变化，无法回到刚吸顶的位置。
 */
function getDocumentTop(el: HTMLElement): number {
  let top = 0
  let node: HTMLElement | null = el
  while (node) {
    top += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return top
}

/**
 * 切换说明 / 深入 / 源码
 * tab 已经吸顶时，切过去会从内容中段开始看；
 * 因此平滑滚到“tab 刚吸顶”的位置，让下面内容从 tab 栏下方开始，而不是回到页面顶部。
 */
async function switchTab(next: ContentTab): Promise<void> {
  if (activeTab.value === next) return

  const seq = ++tabSwitchSeq
  const prevPanelHeight = getPanelHeight(activeTab.value)
  panelMinHeight.value = 0

  // 首次看 notes 时骨架屏比原面板矮很多，先保留原面板高度，防止滚动被页面夹取
  if (next === 'notes' && !notesRendered.value) {
    panelMinHeight.value = prevPanelHeight
  }

  activeTab.value = next

  // 源码按需加载：切到源码 tab 时才开始下载文本（提前发起，减少等待）
  if (next === 'code') void loadSource()

  await nextTick()

  // 等 notes 正文渲染完，拿到最终高度后再对齐滚动
  if (next === 'notes' && !notesRendered.value) {
    await waitForNotesRendered()
    if (seq !== tabSwitchSeq) return
  }

  panelMinHeight.value = 0
  await nextTick()

  const wrap = tabsWrapEl.value
  const anchor = tabsAnchorEl.value
  if (!wrap || !anchor) return

  // 只有 tab 已经吸顶时才回位；页面还没滚到这里时保持不动
  if (wrap.getBoundingClientRect().top > 64.5) return

  // 吸顶元素的 offsetTop 会跟着 sticky 变化，改用前面的零高度锚点；
  // 再加上 tab 栏的负 margin，得到它“未吸顶时”的文档顶部。
  const marginTop = Number.parseFloat(getComputedStyle(wrap).marginTop) || 0
  const target = getDocumentTop(anchor) + marginTop - 64
  const maxScroll = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  )
  // 切到较短的面板时页面可能不够高，目标要收敛到最大可滚位置
  const nextY = Math.min(Math.max(0, target), maxScroll)
  if (Math.abs(window.scrollY - nextY) > 1) {
    smoothScrollTo(nextY)
  }
}

/** tablist 键盘操作：左右键在三个 tab 间循环并移动焦点 */
function onTabKeydown(e: KeyboardEvent, current: ContentTab): void {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()

  const step = e.key === 'ArrowRight' ? 1 : -1
  const index = TAB_ORDER.indexOf(current)
  const next = TAB_ORDER[(index + step + TAB_ORDER.length) % TAB_ORDER.length]

  void switchTab(next)
  void nextTick(() => {
    tabElMap[next].value?.focus()
  })
}

// ============================================================
// 生命周期：列表页/详情页共用的回到顶部按钮由 BackToTop 自己管滚动监听
// ============================================================

onMounted(async () => {
  // 先测量再显示滑块，避免首次从左侧 0 位置滑入
  await nextTick()
  syncTabIndicator()
  tabIndicatorRaf = requestAnimationFrame(() => {
    tabIndicatorReady.value = true
  })

  // 字体加载、移动端布局、源码数量徽章都会改变按钮宽度
  tabIndicatorObserver = new ResizeObserver(syncTabIndicator)
  if (tabsEl.value) tabIndicatorObserver.observe(tabsEl.value)
  for (const tabEl of Object.values(tabElMap)) {
    if (tabEl.value) tabIndicatorObserver.observe(tabEl.value)
  }
  void document.fonts.ready.then(() => syncTabIndicator())
})

onBeforeUnmount(() => {
  // 路由离开时停掉滚动动画，避免动画持有已销毁组件的闭包
  stopSmoothScroll()
  cancelAnimationFrame(tabIndicatorRaf)
  tabIndicatorObserver?.disconnect()

  // 解除可能仍在等待 notes 的切换，避免 Promise 悬挂
  tabSwitchSeq++
  notesRenderedResolve?.()
  notesRenderedResolve = null
})

// ============================================================
// SBAC 说明：场景 / 背景 / 做法 / 结论
// ============================================================

/** 已补齐说明的案例按四段渲染；未补齐时回退到「卖点 + 代码要点」 */
const explain = computed(() => item.value?.meta.explain ?? null)

const explainBlocks = computed(() => {
  const e = explain.value
  if (!e) return []
  return [
    { key: 'S', label: '场景', text: e.situation },
    { key: 'B', label: '背景', text: e.background },
    { key: 'A', label: '做法', text: e.action },
    { key: 'C', label: '结论', text: e.conclusion },
  ]
})
</script>

<template>
  <div class="case-page">
    <!-- 空状态：案例不存在 -->
    <div
      v-if="!item"
      class="case-empty"
    >
      <h1>案例不存在</h1>
      <p>请从左侧导航选择一个案例，或返回案例列表。</p>
      <RouterLink
        class="btn-primary"
        to="/cases"
      >
        返回案例库
      </RouterLink>
    </div>

    <template v-else>
      <!-- 返回条：返回按钮 + 面包屑（返回优先走历史，恢复列表滚动位置） -->
      <div class="case-toolbar">
        <button
          class="back-btn"
          type="button"
          @click="backToList"
        >
          <span aria-hidden="true">←</span>
          返回列表
        </button>

        <nav
          class="crumbs"
          aria-label="面包屑"
        >
          <button
            class="crumb-link"
            type="button"
            @click="backToList"
          >
            案例库
          </button>
          <span
            class="crumb-sep"
            aria-hidden="true"
          >/</span>
          <span>{{ categoryName }}</span>
          <span
            class="crumb-sep"
            aria-hidden="true"
          >/</span>
          <span
            class="crumb-current"
            aria-current="page"
          >{{ item.meta.title }}</span>
        </nav>

        <!-- 收藏：本地保存，列表页可只看收藏 -->
        <button
          class="fav-btn"
          :class="{ 'fav-btn--on': favorite }"
          type="button"
          :aria-pressed="favorite"
          @click="toggleFavorite(currentKey)"
        >
          <span aria-hidden="true">{{ favorite ? '★' : '☆' }}</span>
          {{ favorite ? '已收藏' : '收藏' }}
        </button>
      </div>

      <!-- 页头：标题 + 难度/标签一行 + 摘要（文档站紧凑规格） -->
      <header class="case-header">
        <h1 class="case-title">
          {{ item.meta.title }}
        </h1>
        <div class="case-meta">
          <span
            class="tag"
            :class="difficultyClass"
          >{{ difficultyLabel }}</span>
          <span
            v-for="tag in item.meta.tags"
            :key="tag"
            class="tag tag--primary"
          >
            {{ tag }}
          </span>
        </div>
        <p class="case-summary">
          {{ item.meta.summary }}
        </p>
      </header>
      <!-- ① 演示区：演示组件按需加载，加载期间显示占位 -->
      <section aria-label="可交互演示">
        <div class="card demo-card">
          <!-- 演示区统一包一层 Naive 主题 + message provider：
               案例里的 n-button / n-radio-group / useMessage() 都从这里拿上下文 -->
          <DemoNaive v-if="demoComponent">
            <component :is="demoComponent" />
          </DemoNaive>
          <div
            v-else-if="demoStatus === 'error'"
            class="async-placeholder"
            role="alert"
          >
            <p>演示加载失败，请检查网络后重试。</p>
            <button
              class="btn-ghost"
              type="button"
              @click="loadDemo"
            >
              重新加载
            </button>
          </div>
          <div
            v-else
            class="async-placeholder"
            role="status"
          >
            演示加载中…
          </div>
        </div>
      </section>

      <!-- ② 说明 / 深入 / 源码：共用一个 tab 组，默认说明，其余按需切换 -->
      <section aria-label="案例说明、深入资料与源码">
        <div
          ref="tabsAnchorEl"
          class="content-tabs-anchor"
          aria-hidden="true"
        />
        <div
          ref="tabsWrapEl"
          class="content-tabs-wrap"
        >
          <div
            ref="tabsEl"
            class="content-tabs"
            role="tablist"
            aria-label="说明、深入与源码切换"
          >
            <span
              class="content-tab-indicator"
              :class="{ 'content-tab-indicator--ready': tabIndicatorReady }"
              :style="tabIndicatorStyle"
              aria-hidden="true"
            />
            <button
              id="tab-explain"
              ref="explainTabEl"
              class="content-tab"
              :class="{ 'content-tab--active': activeTab === 'explain' }"
              type="button"
              role="tab"
              :aria-selected="activeTab === 'explain'"
              aria-controls="panel-explain"
              @click="switchTab('explain')"
              @keydown="onTabKeydown($event, 'explain')"
            >
              说明
            </button>
            <button
              id="tab-notes"
              ref="notesTabEl"
              class="content-tab"
              :class="{ 'content-tab--active': activeTab === 'notes' }"
              type="button"
              role="tab"
              :aria-selected="activeTab === 'notes'"
              aria-controls="panel-notes"
              @click="switchTab('notes')"
              @keydown="onTabKeydown($event, 'notes')"
              @pointerenter="prefetchNotes"
              @pointerdown="prefetchNotes"
              @focus="prefetchNotes"
            >
              深入
            </button>
            <button
              id="tab-code"
              ref="codeTabEl"
              class="content-tab"
              :class="{ 'content-tab--active': activeTab === 'code' }"
              type="button"
              role="tab"
              :aria-selected="activeTab === 'code'"
              aria-controls="panel-code"
              @click="switchTab('code')"
              @keydown="onTabKeydown($event, 'code')"
              @pointerenter="prefetchSource"
              @pointerdown="prefetchSource"
              @focus="prefetchSource"
            >
              源码
              <span
                v-if="item.codeFileCount > 1"
                class="content-tab-count"
                :title="`共 ${item.codeFileCount} 段核心代码`"
              >{{ item.codeFileCount }}</span>
            </button>
          </div>
        </div>

        <div
          class="content-panels"
          :style="panelMinHeight ? { minHeight: panelMinHeight + 'px' } : undefined"
        >
          <!-- 面板一：案例说明（SBAC 四段；未补齐时回退到卖点 + 代码要点） -->
          <div
            v-show="activeTab === 'explain'"
            id="panel-explain"
            class="content-panel"
            role="tabpanel"
            aria-labelledby="tab-explain"
          >
            <div class="card note-card">
              <template v-if="explain">
                <p class="note-lead">
                  {{ item.meta.sell }}
                </p>

                <ol class="sbac-list">
                  <li
                    v-for="block in explainBlocks"
                    :key="block.key"
                    class="sbac-row"
                  >
                    <span
                      class="sbac-badge"
                      :class="`sbac-${block.key.toLowerCase()}`"
                      aria-hidden="true"
                    >{{ block.key }}</span>
                    <div class="sbac-body">
                      <h3 class="sbac-label">
                        {{ block.label }}
                      </h3>
                      <p class="sbac-text">
                        {{ block.text }}
                      </p>
                    </div>
                  </li>
                </ol>
              </template>

              <template v-else>
                <div class="note-sell">
                  <span class="note-sell-label">为什么看</span>
                  <p class="note-sell-text">
                    {{ item.meta.sell }}
                  </p>
                </div>

                <ul
                  v-if="keyPoints.length"
                  class="note-points"
                >
                  <li
                    v-for="point in keyPoints"
                    :key="point"
                  >
                    {{ point }}
                  </li>
                </ul>
              </template>
            </div>
          </div>

          <!-- 面板二：深入资料（notes.md 五段，懒加载） -->
          <div
            v-show="activeTab === 'notes'"
            id="panel-notes"
            class="content-panel"
            role="tabpanel"
            aria-labelledby="tab-notes"
          >
            <NotesPanel
              :category-id="item.categoryId"
              :case-id="item.meta.id"
              :active="activeTab === 'notes'"
              @rendered="onNotesRendered"
            />
          </div>

          <!-- 面板三：源码工作台（核心代码 / demo源码 两个子 tab） -->
          <div
            v-show="activeTab === 'code'"
            id="panel-code"
            class="content-panel"
            role="tabpanel"
            aria-labelledby="tab-code"
          >
            <CodeWorkbench
              v-if="sourceStatus === 'ready'"
              :tabs="codeTabs"
              :demo-source="demoSource"
            />
            <div
              v-else-if="sourceStatus === 'error'"
              class="card async-placeholder async-placeholder--card"
              role="alert"
            >
              <p>源码加载失败，请检查网络后重试。</p>
              <button
                class="btn-ghost"
                type="button"
                @click="retrySource"
              >
                重新加载
              </button>
            </div>
            <div
              v-else
              class="card async-placeholder async-placeholder--card"
              role="status"
            >
              源码加载中…
            </div>
          </div>
        </div>
      </section>

      <!-- ③ 相关案例 + 上一篇 / 下一篇：串起同一类能力，方便连续查阅 -->
      <section
        v-if="relatedCases.length || prevCase || nextCase"
        class="related"
        aria-labelledby="related-title"
      >
        <h2
          id="related-title"
          class="related-title"
        >
          相关案例
        </h2>

        <div
          v-if="relatedCases.length"
          class="related-grid"
        >
          <RouterLink
            v-for="rel in relatedCases"
            :key="`related-${rel.categoryId}/${rel.meta.id}`"
            :to="`/cases/${rel.categoryId}/${rel.meta.id}`"
            class="related-card card card--interactive"
          >
            <span class="related-cat">{{ categoryLabel(rel.categoryId) }}</span>
            <span class="related-name">{{ rel.meta.title }}</span>
            <span class="related-summary">{{ rel.meta.summary }}</span>
          </RouterLink>
        </div>

        <nav
          class="case-nav"
          aria-label="上一篇与下一篇"
        >
          <RouterLink
            v-if="prevCase"
            :to="`/cases/${prevCase.categoryId}/${prevCase.meta.id}`"
            class="case-nav-link"
          >
            <span aria-hidden="true">←</span>
            <span class="case-nav-label">上一篇</span>
            <span class="case-nav-title">{{ prevCase.meta.title }}</span>
          </RouterLink>
          <span
            v-else
            class="case-nav-spacer"
            aria-hidden="true"
          />

          <RouterLink
            v-if="nextCase"
            :to="`/cases/${nextCase.categoryId}/${nextCase.meta.id}`"
            class="case-nav-link case-nav-link--next"
          >
            <span class="case-nav-label">下一篇</span>
            <span class="case-nav-title">{{ nextCase.meta.title }}</span>
            <span aria-hidden="true">→</span>
          </RouterLink>
          <span
            v-else
            class="case-nav-spacer"
            aria-hidden="true"
          />
        </nav>
      </section>

      <!-- 回到顶部：滚动超过一屏后浮现，外圈是阅读进度 -->
      <BackToTop />
    </template>
  </div>
</template>

<style scoped>
.case-page {
  /* width:100% 必须显式声明：父级是 flex column，仅靠 max-width + margin:auto
     会禁用 stretch 而退化为 fit-content——页面宽度将随代码行内容实时变化
     （切「demo源码」tab 时长行会把整页撑宽的根因） */
  width: 100%;
  max-width: 84rem;
  margin: 0 auto;
  padding: 2rem 2.5rem 5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* ---------- 返回条 ---------- */

.case-toolbar {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.34rem 0.8rem;
  font-size: 0.82rem;
  font-family: inherit;
  color: var(--text-secondary);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  transition:
    color var(--transition),
    border-color var(--transition),
    background-color var(--transition),
    transform var(--transition);

  &:hover {
    color: var(--primary);
    border-color: var(--primary);
    background-color: var(--primary-soft);
  }

  &:active {
    transform: scale(0.97);
  }
}

/* ---------- 面包屑 ---------- */

.crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.83rem;
  color: var(--text-secondary);
}

.crumb-link {
  padding: 0;
  font-size: inherit;
  font-family: inherit;
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;

  &:hover {
    color: var(--primary);
  }
}

.crumb-sep {
  opacity: 0.5;
}

.crumb-current {
  color: var(--text);
  font-weight: 500;
}

/* 空状态 */
.case-empty {
  text-align: center;
  padding: 4rem 0;

  p {
    color: var(--text-secondary);
    margin-bottom: 1.25rem;
  }
}

/* 页头：文档页 h1 规格 */
.case-title {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 0.6rem;
}

.case-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.65rem;
}

.case-summary {
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.7;
  margin: 0;
}

/* ---------- 说明 / 源码 tab 组 ---------- */

/* 零高度锚点：tab 吸顶后 offsetTop 会变，用它的位置算稳定的滚动目标 */
.content-tabs-anchor {
  height: 0;
  pointer-events: none;
}

/* 吸顶容器：滚动查看长代码时 tab 保持可见，随时切回说明 */
.content-tabs-wrap {
  position: sticky;
  top: 64px; /* 顶栏高度 */
  z-index: 10;
  margin: -0.4rem 0 0.9rem;
  padding: 0.45rem 0;
  /* 半透明 + 模糊：内容从下方滚过时不与 tab 文字互相干扰 */
  background-color: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
}

.content-tabs {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  gap: 0.2rem;
  padding: 0.25rem;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  box-shadow: var(--shadow-soft);
}

/* 选中滑块：主色胶囊 + 柔和阴影，用 transform 快速滑到目标 tab */
.content-tab-indicator {
  position: absolute;
  top: 0.25rem;
  bottom: 0.25rem;
  left: 0;
  z-index: 0;
  width: 0;
  border-radius: 999px;
  background-color: var(--primary);
  box-shadow:
    0 2px 8px color-mix(in srgb, var(--primary) 35%, transparent),
    var(--shadow-soft);
  opacity: 0;
  pointer-events: none;
  will-change: transform, width;
  transition:
    transform 0.18s var(--ease-out),
    width 0.2s var(--ease-out),
    opacity 0.15s var(--ease-out);
}

.content-tab-indicator--ready {
  opacity: 1;
}

.content-tab {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2rem;
  padding: 0.34rem 1.15rem;
  font-size: 0.86rem;
  font-family: inherit;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  transition:
    color var(--transition),
    background-color var(--transition),
    box-shadow var(--transition);
}

.content-tab:hover {
  color: var(--text);
  background-color: var(--bg);
}

.content-tab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.content-tab--active,
.content-tab--active:hover {
  color: #fff;
  font-weight: 500;
  /* 背景由滑块承担，按钮本身透明，避免切换时两层主色叠在一起 */
  background-color: transparent;
  box-shadow: none;
}

/* 「源码」后的代码段数：小号胶囊，提示有多少段可看 */
.content-tab-count {
  min-width: 1.15rem;
  padding: 0 0.3rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  line-height: 1.15rem;
  text-align: center;
  border-radius: 999px;
  color: var(--text-secondary);
  background-color: var(--bg);
}

.content-tab--active .content-tab-count {
  color: #fff;
  background-color: rgb(255 255 255 / 0.22);
}

/* 演示卡：宽屏下给足留白，避免显得局促 */
.demo-card {
  padding: 2.25rem 2.5rem;
  /* 演示区正文统一到 15px，内部细节再用 --demo-text-* 收敛 */
  font-size: var(--demo-text-lg);
  line-height: 1.65;
}

/* 异步资源占位：演示 / 源码加载中或失败时显示，固定最小高度避免布局跳动 */
.async-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 12rem;
  padding: 1.5rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
  text-align: center;
}

.async-placeholder p {
  margin: 0;
}

/* 源码面板里的占位本身就是一张卡，高度可以小一些 */
.async-placeholder--card {
  min-height: 10rem;
}

/* ---------- 说明卡 ---------- */

.note-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.35rem 1.6rem;
}

/* 顶部导语：一句话卖点 */
.note-lead {
  margin: 0;
  padding: 0.7rem 0.9rem;
  border-left: 3px solid var(--primary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background-color: var(--primary-soft);
  color: var(--primary);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.7;
}

/* ---------- SBAC 四段 ---------- */

.sbac-list {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sbac-row {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
}

/* 竖线把四段串成一条阅读路径 */
.sbac-row:not(:last-child)::before {
  content: '';
  position: absolute;
  top: 2.05rem;
  bottom: -1.2rem;
  left: 0.85rem;
  width: 1px;
  background-color: var(--border);
}

.sbac-badge {
  flex-shrink: 0;
  width: 1.7rem;
  height: 1.7rem;
  margin-top: 0.1rem;
  display: grid;
  place-items: center;
  border-radius: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 700;
}

/* 四种语义色：场景/背景/做法/结论一眼区分 */
.sbac-s {
  color: var(--primary);
  background-color: var(--primary-soft);
}

.sbac-b {
  color: var(--warning);
  background-color: color-mix(in srgb, var(--warning) 16%, transparent);
}

.sbac-a {
  color: var(--success);
  background-color: color-mix(in srgb, var(--success) 16%, transparent);
}

.sbac-c {
  color: var(--danger);
  background-color: color-mix(in srgb, var(--danger) 13%, transparent);
}

.sbac-body {
  min-width: 0;
}

.sbac-label {
  margin: 0 0 0.3rem;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}

.sbac-text {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.9;
  color: var(--text);
  /* 做法段用换行列步骤时保留换行 */
  white-space: pre-line;
}

@media (max-width: 560px) {
  .note-card {
    padding: 1.1rem;
    gap: 1rem;
  }

  .sbac-text {
    font-size: 0.88rem;
    line-height: 1.85;
  }
}

.note-sell {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.note-sell-label {
  flex-shrink: 0;
  padding: 0.12rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--primary-soft-text);
  background-color: var(--primary-soft);
  border-radius: 999px;
}

.note-sell-text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--text);
}

.note-points {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 1.5rem;

  li {
    position: relative;
    padding-left: 1rem;
    font-size: 0.86rem;
    line-height: 1.65;
    color: var(--text-secondary);
    word-break: break-word;

    /* 主色圆点，弱化视觉重量 */
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0.55em;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background-color: var(--primary);
      opacity: 0.6;
    }
  }
}

/* ---------- 收藏按钮 ---------- */

.fav-btn {
  /* 推到工具条最右侧：返回按钮与面包屑保持左对齐 */
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.34rem 0.8rem;
  font-size: 0.82rem;
  font-family: inherit;
  color: var(--text-secondary);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  transition:
    color var(--transition),
    border-color var(--transition),
    background-color var(--transition),
    transform var(--transition);
}

.fav-btn:hover {
  color: var(--warning);
  border-color: var(--warning);
}

.fav-btn:active {
  transform: scale(0.97);
}

/* 已收藏：星标实心 + 暖色底，和小小的「收藏」按钮区分开 */
.fav-btn--on {
  color: var(--warning);
  border-color: color-mix(in srgb, var(--warning) 60%, var(--border));
  background-color: color-mix(in srgb, var(--warning) 12%, transparent);
}

/* ---------- 相关案例 ---------- */

.related {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.related-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}

.related-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.related-card {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
  padding: 0.9rem 1rem;
  color: var(--text);
  text-decoration: none;
}

.related-card:hover {
  text-decoration: none;
}

.related-cat {
  font-size: 0.7rem;
  color: var(--primary);
}

.related-name {
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.5;
}

.related-summary {
  font-size: 0.78rem;
  line-height: 1.6;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

/* 上一篇 / 下一篇：贴底的两张窄条，长标题省略不换行 */
.case-nav {
  display: flex;
  align-items: stretch;
  gap: 0.75rem;
}

.case-nav-link {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 0.8rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  text-decoration: none;
  transition:
    color var(--transition),
    border-color var(--transition);
}

.case-nav-link:hover {
  color: var(--primary);
  border-color: var(--primary);
  text-decoration: none;
}

.case-nav-link--next {
  justify-content: flex-end;
  text-align: right;
}

.case-nav-label {
  flex-shrink: 0;
  opacity: 0.75;
}

.case-nav-title {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text);
  font-weight: 500;
}

.case-nav-spacer {
  flex: 1;
}

/* ---------- 移动端 ---------- */

@media (max-width: 768px) {
  .case-page {
    padding: 1.5rem 1.25rem 3rem;
    gap: 1.5rem;
  }

  /* 移动端收藏按钮单独换行，不与返回/面包屑抢一行 */
  .fav-btn {
    margin-left: 0;
  }

  .related-grid {
    grid-template-columns: 1fr;
  }

  /* 上下篇改为纵向堆叠，标题才有空间显示 */
  .case-nav {
    flex-direction: column;
  }

  .case-nav-spacer {
    display: none;
  }

  /* 移动端 tab 组铺满一行，方便点按 */
  .content-tabs {
    display: flex;
    width: 100%;
  }

  .content-tab {
    flex: 1;
    justify-content: center;
    padding: 0.45rem 1rem;
  }

  .back-top {
    right: 1rem;
    bottom: 1rem;
    width: 2.5rem;
    height: 2.5rem;
  }

  .demo-card {
    padding: 1.25rem;
  }

  .note-card {
    padding: 1.1rem;
  }

  .note-points {
    grid-template-columns: 1fr;
  }
}
</style>
