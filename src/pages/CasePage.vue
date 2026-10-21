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
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { categories } from '../examples/categories'
import { loadCaseNotes } from '../examples/notes'
import { getCase } from '../examples/registry'
import CodeWorkbench from '../components/CodeWorkbench.vue'
import NotesPanel from '../components/NotesPanel.vue'

const route = useRoute()
const router = useRouter()

// 路由参数查找案例（不存在渲染空状态）
const item = computed(() =>
  getCase(String(route.params.categoryId), String(route.params.caseId)),
)

/**
 * 路由切换时重置内容 tab
 * CasePage 在同一路由记录内复用（只换 params），组件不会重建；
 * 不重置的话，从上一个案例的源码切过来会直接停在源码面板。
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
  },
)

/** 当前分类展示名（面包屑用，找不到回退为原始 id） */
const categoryName = computed(
  () =>
    categories.find((c) => c.id === route.params.categoryId)?.name ??
    String(route.params.categoryId),
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

  for (const tab of item.value.codeTabs) {
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
// 平滑滚动（按钮/tab 这类主动操作，自己插值，保证一定平滑）
// 不依赖 behavior: 'smooth'：系统「减少动态效果」等设置可能把它降级成瞬间跳转
// ============================================================

/** 当前动画令牌：新动画或用户手动滚动时让旧动画停下 */
let scrollAnimId = 0
/** 正在进行的滚动动画的清理函数 */
let stopScrollAnim: (() => void) | null = null

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
 * 逐帧缓动滚动到目标位置
 * @param targetY 目标滚动高度（px）
 * @param duration 动画时长（毫秒）
 */
function smoothScrollTo(targetY: number, duration = 460): void {
  // 连续点击 / 切换 tab 时先停掉上一段，避免两段动画互相抢
  stopScrollAnim?.()

  const startY = window.scrollY
  const distance = targetY - startY
  if (Math.abs(distance) < 1) return

  const root = document.documentElement

  // 系统开启“减少动态效果”时直接跳转：CSS 的 reduced-motion 管不到这段 JS 动画
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // 让上一段动画的 rAF 失效，避免它下一帧把位置又拉回旧目标
    scrollAnimId++
    const prevBehavior = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    window.scrollTo(0, targetY)
    root.style.scrollBehavior = prevBehavior
    return
  }

  const id = ++scrollAnimId
  const prevBehavior = root.style.scrollBehavior

  // 临时关闭 CSS 平滑：否则每帧的 scrollTo 会被再平滑一次，动画收尾拖尾
  root.style.scrollBehavior = 'auto'

  const startTime = performance.now()
  // 缓入缓出：起步和收尾都柔和（比线性更像真实滚动）
  const ease = (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

  /** 结束动画：恢复页面原有的滚动行为并移除监听 */
  function finish(): void {
    root.style.scrollBehavior = prevBehavior
    window.removeEventListener('wheel', onUserScroll)
    window.removeEventListener('touchstart', onUserScroll)
    if (stopScrollAnim === finish) stopScrollAnim = null
  }

  /** 用户自己滚动时立即让出控制权，不跟用户抢 */
  function onUserScroll(): void {
    scrollAnimId++
    finish()
  }

  stopScrollAnim = finish
  window.addEventListener('wheel', onUserScroll, { passive: true })
  window.addEventListener('touchstart', onUserScroll, { passive: true })

  function step(now: number): void {
    // 令牌变了说明动画已被取消（用户滚动或开始了新动画）
    if (id !== scrollAnimId) return

    const progress = Math.min(1, (now - startTime) / duration)
    window.scrollTo(0, startY + distance * ease(progress))

    if (progress < 1) {
      requestAnimationFrame(step)
    } else {
      finish()
    }
  }

  requestAnimationFrame(step)
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
// 回到顶部：滚动超过一屏后出现
// ============================================================

/** 按钮是否显示 */
const showBackTop = ref(false)
/** 当前阅读进度 0..1（画在按钮外圈的进度环） */
const scrollProgress = ref(0)
/** 滚动回调的逐帧节流开关：一帧最多计算一次 */
let scrollTicking = false

/** 滚动监听：passive + 逐帧节流，避免每个滚动事件都触发响应式更新 */
function onWindowScroll(): void {
  if (scrollTicking) return
  scrollTicking = true

  requestAnimationFrame(() => {
    const y = window.scrollY
    showBackTop.value = y > 480

    // 进度 = 已滚距离 / 可滚总距离（内容不足一屏时保持 0）
    const max = document.documentElement.scrollHeight - window.innerHeight
    scrollProgress.value = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0

    scrollTicking = false
  })
}

/** 平滑回到顶部（自行插值，不依赖浏览器 behavior: 'smooth'） */
function backToTop(): void {
  smoothScrollTo(0)
}

onMounted(async () => {
  // 刷新时可能已处于滚动位置，先同步一次
  onWindowScroll()
  window.addEventListener('scroll', onWindowScroll, { passive: true })

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
  window.removeEventListener('scroll', onWindowScroll)
  // 路由离开时停掉滚动动画，避免动画持有已销毁组件的闭包
  stopScrollAnim?.()
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
      <!-- ① 演示区：直接展示可交互演示 -->
      <section aria-label="可交互演示">
        <div class="card demo-card">
          <component :is="item.demoComponent" />
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
            >
              源码
              <span
                v-if="item.codeTabs.length > 1"
                class="content-tab-count"
                :title="`共 ${item.codeTabs.length} 段核心代码`"
              >{{ item.codeTabs.length }}</span>
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
              :tabs="item.codeTabs"
              :demo-source="item.demoSource"
            />
          </div>
        </div>
      </section>

      <!-- 回到顶部：滚动超过一屏后浮现，外圈是阅读进度 -->
      <Transition name="back-top">
        <button
          v-if="showBackTop"
          class="back-top"
          type="button"
          aria-label="回到顶部"
          @click="backToTop"
        >
          <svg
            class="back-top-ring"
            viewBox="0 0 44 44"
            aria-hidden="true"
          >
            <circle
              class="back-top-track"
              cx="22"
              cy="22"
              r="20"
            />
            <circle
              class="back-top-bar"
              cx="22"
              cy="22"
              r="20"
              :style="{ strokeDashoffset: `${125.66 * (1 - scrollProgress)}` }"
            />
          </svg>
          <span
            class="back-top-arrow"
            aria-hidden="true"
          >↑</span>
        </button>
      </Transition>
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

/*
 * 指示器是短距离位置提示：系统开启「减少动态效果」时也保留滑动，
 * 否则会被全局规则压成 0.01ms，看起来就是直接瞬移；
 * 其余页面动效仍按 _base.scss 的 reduced-motion 规则关闭。
 */
@media (prefers-reduced-motion: reduce) {
  .content-tab-indicator {
    transition-duration: 0.18s, 0.2s, 0.15s !important;
  }
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

/* ---------- 回到顶部 ---------- */

.back-top {
  position: fixed;
  right: 1.75rem;
  bottom: 1.75rem;
  z-index: 30;
  width: 2.85rem;
  height: 2.85rem;
  display: grid;
  place-items: center;
  font-size: 1rem;
  color: var(--primary);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50%;
  box-shadow: var(--shadow-soft-lg);
  cursor: pointer;
  transition:
    transform var(--transition),
    border-color var(--transition),
    color var(--transition),
    box-shadow var(--transition);
}

.back-top:hover {
  transform: translateY(-3px);
  color: var(--primary-hover);
  border-color: var(--primary);
  box-shadow: 0 10px 24px rgb(0 0 0 / 0.16);
}

/* 按下回弹：给点击一个明确的触感 */
.back-top:active {
  transform: translateY(-1px) scale(0.92);
}

.back-top:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3px var(--primary-soft),
    var(--shadow-soft-lg);
}

/* 阅读进度环：贴按钮内圈，从 12 点方向顺时针补齐 */
.back-top-ring {
  position: absolute;
  inset: 2px;
  transform: rotate(-90deg);
  pointer-events: none;
}

.back-top-track,
.back-top-bar {
  fill: none;
  stroke-width: 2;
}

.back-top-track {
  stroke: var(--border);
}

.back-top-bar {
  stroke: var(--primary);
  stroke-linecap: round;
  /* 圆周长 2πr ≈ 125.66：dashoffset 由进度动态控制 */
  stroke-dasharray: 125.66;
  transition: stroke-dashoffset 0.12s linear;
}

.back-top-arrow {
  position: relative;
  line-height: 1;
  transition: transform var(--transition);
}

.back-top:hover .back-top-arrow {
  transform: translateY(-2px);
}

/* 出现：上浮 + 放大（柔和收尾）；消失：快速收紧 */
.back-top-enter-active {
  transition:
    opacity 0.3s var(--ease-out),
    transform 0.3s var(--ease-out);
}

.back-top-leave-active {
  transition:
    opacity 0.18s ease-in,
    transform 0.18s ease-in;
}

.back-top-enter-from,
.back-top-leave-to {
  opacity: 0;
  transform: translateY(18px) scale(0.7);
}

/* ---------- 移动端 ---------- */

@media (max-width: 768px) {
  .case-page {
    padding: 1.5rem 1.25rem 3rem;
    gap: 1.5rem;
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
