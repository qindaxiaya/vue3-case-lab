// ============================================================
// notes 正文索引（全局搜索用）
// - notes.md 本来就是懒加载的（详情页「深入」tab 才读），搜索索引也按需构建：
//   第一次打开搜索弹窗后的空闲时段才开始读，不拖慢首屏
// - 62 篇约 190 KB，并发 6 篇分批读入；每读完一篇就刷新结果，
//   用户边输入边能看到更多正文命中，不用等全部读完
// - 模块级单例：弹窗反复开关、路由切换都复用同一份索引，每篇只读一次
// - 正文匹配逻辑在 src/utils/search-index.ts，这里只负责「取数据 + 调度」
// ============================================================
import { readonly, ref, type Ref } from 'vue'
import { allCases } from '../examples/registry'
import { loadCaseNotes, stripNotesTitle } from '../examples/notes'
import {
  buildNotesDoc,
  searchNotes,
  type NotesDoc,
  type NotesHit,
} from '../utils/search-index'

/** 索引构建状态：idle 未开始 / loading 读取中 / ready 可用 / failed 全失败 */
type IndexStatus = 'idle' | 'loading' | 'ready' | 'failed'

/** 并发读取的篇数：太高会瞬间打出几十个请求，太低则索引来得慢 */
const CONCURRENCY = 6

/** 已建好的文档（响应式：新增一篇会让搜索弹窗的结果自动刷新） */
const docs = ref<NotesDoc[]>([])
/** 构建状态 */
const status = ref<IndexStatus>('idle')
/** 正在进行的构建任务（幂等：重复调用复用同一个 Promise） */
let building: Promise<void> | null = null

/**
 * 在浏览器空闲时启动任务
 * - 有 requestIdleCallback 就等空闲（timeout 1.2s 兜底，避免一直不空闲）
 * - 没有就退化成 200ms 延迟，至少不和首屏抢主线程
 */
function runWhenIdle(task: () => void): void {
  if (typeof window === 'undefined') return

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => task(), { timeout: 1200 })
  } else {
    window.setTimeout(task, 200)
  }
}

/** 分批读取全部 notes.md，边读边建文档 */
async function buildIndex(): Promise<void> {
  // 复制一份队列给多个 worker 抢任务，避免并发时重复读取同一篇
  const queue = allCases.slice()
  const collected: NotesDoc[] = []

  /** 单个 worker：不断从队列取案例，读到没有为止 */
  const worker = async (): Promise<void> => {
    for (;;) {
      const item = queue.shift()
      if (!item) return

      try {
        const markdown = await loadCaseNotes(item.categoryId, item.meta.id)
        // 没有 notes.md 的目录当空处理，不进索引
        if (!markdown) continue

        collected.push(
          buildNotesDoc(
            item.categoryId,
            item.meta.id,
            // 首个 H1 就是案例标题，已在结果卡片里展示，正文索引不需要
            stripNotesTitle(markdown),
          ),
        )
        // 拷贝后赋值：触发依赖更新，同时避免外部直接改内部数组
        docs.value = collected.slice()
      } catch {
        // 单篇失败不影响整体：其余篇照常可用，一篇都没有才标记整体失败
      }
    }
  }

  const workerCount = Math.min(CONCURRENCY, queue.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  // 只要有一篇成功就算可用；一篇都没有才算整体失败
  status.value = collected.length > 0 ? 'ready' : 'failed'
}

/**
 * 正文索引 composable
 * @returns ensure：触发构建（幂等）；search：同步查已建好的部分
 */
export function useNotesIndex(): {
  status: Readonly<Ref<IndexStatus>>
  ensure: () => Promise<void>
  search: (query: string, limit?: number) => NotesHit[]
} {
  /** 触发构建：已就绪不重复构建，构建中返回同一个 Promise */
  function ensure(): Promise<void> {
    if (status.value === 'ready' || status.value === 'failed') {
      return Promise.resolve()
    }
    if (building) return building

    building = new Promise<void>((resolve) => {
      runWhenIdle(() => {
        status.value = 'loading'
        // finally 保证调用方 await 一定结束（失败也不挂住搜索弹窗）
        void buildIndex().finally(resolve)
      })
    })
    return building
  }

  return {
    status: readonly(status),
    ensure,
    search: (query: string, limit?: number) => searchNotes(docs.value, query, limit),
  }
}
