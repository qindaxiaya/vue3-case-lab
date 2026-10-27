// ============================================================
// 案例自动注册表（懒加载版）
// 通过 import.meta.glob 扫描 src/examples/ 下约定目录结构，
// 自动收录全部案例——新增案例 = 新建目录，零注册成本。
//
// 目录约定：
//   src/examples/<category>/<case-id>/
//   ├── Demo.vue        可交互演示组件
//   ├── meta.ts         default export 满足 CaseMeta
//   └── code/*.txt      带注释的教学代码片段（?raw 导入）
//
// 打包策略（2026-10-21 企业级打包优化）：
// - meta.ts 保持 eager：列表页与全局搜索要同步拿到全部标题/摘要/标签，
//   全部 meta 只有几十 KB，换来列表与搜索零等待。
// - Demo.vue / Demo.vue?raw / code/*.txt 改为动态 import：
//   只有打开某个案例时才下载它自己的演示与源码。
//   改造前这四类 glob 全是 eager，导致全部案例的源码（约 1 MB 纯文本）
//   被逐字内联进首屏包。
// - 加载结果按「分类/案例」缓存：说明/源码 tab 来回切换不会重复请求。
// ============================================================
import type { Component } from 'vue'
import type { CaseMeta } from '../types/case'
import { categories } from './categories'

/** 代码片段 tab（CodeWorkbench 展示单元） */
export interface CodeTab {
  /** 展示文件名，如 usage.vue.txt */
  name: string
  /** 高亮语言 id，如 vue / typescript */
  lang: string
  /** 原始代码文本 */
  content: string
}

/**
 * 注册表条目：只放「列表/搜索/路由」必需的同步数据
 * 演示组件与源码文本体积大，改为按需加载（见下方 loader）
 */
export interface RegisteredCase {
  meta: CaseMeta
  /** 所属分类 id（来自目录路径） */
  categoryId: string
  /** code/*.txt 片段数量（构建期由 glob key 统计，不含正文） */
  codeFileCount: number
}

/** 单个案例的源码包（演示源码 + 全部教学代码片段） */
export interface CaseSource {
  /** Demo.vue 完整源码文本（「demo源码」tab 展示，复制即用） */
  demoSource: string
  /** 核心代码片段 tabs（//! 标记重点行，按文件名排序） */
  codeTabs: CodeTab[]
}

/** 动态 import 的加载函数类型（Vite glob 默认返回值） */
type DemoLoader = () => Promise<Component>
type TextLoader = () => Promise<string>

// ---------- glob 扫描：meta 同步，其余懒加载 ----------

// 案例元数据（取 default export）——唯一保持 eager 的一类
const metaModules = import.meta.glob('../examples/*/*/meta.ts', {
  eager: true,
}) as Record<string, { default: CaseMeta }>

// 演示组件本体：只有进入该案例详情页才 import
const demoLoaders = import.meta.glob<Component>(
  '../examples/*/*/Demo.vue',
  { import: 'default' },
) as Record<string, DemoLoader>

// Demo.vue 的完整源码文本：只有点开「源码」tab 才 import
const demoSourceLoaders = import.meta.glob<string>(
  '../examples/*/*/Demo.vue',
  { query: '?raw', import: 'default' },
) as Record<string, TextLoader>

// 教学代码片段（code/*.txt）：同样只在「源码」tab 加载
const codeLoaders = import.meta.glob<string>(
  '../examples/*/*/code/*.txt',
  { query: '?raw', import: 'default' },
) as Record<string, TextLoader>

// ---------- 工具函数 ----------

/**
 * 从代码片段文件名推断 highlight.js 语言
 * 规则：取「倒数第二段」扩展名映射；如 usage.vue.txt → vue
 * @param fileName 文件名，如 composable.ts.txt
 * @returns highlight.js 语言 id，未知回退 plaintext
 */
export function resolveCodeLang(fileName: string): string {
  // 去掉 .txt 后缀后按 . 分段，取最后一个扩展名（倒数第二段）
  const withoutTxt = fileName.replace(/\.txt$/, '')
  const ext = withoutTxt.split('.').pop()?.toLowerCase() ?? ''

  // 扩展名 → highlight.js 语言 id
  const langMap: Record<string, string> = {
    vue: 'vue',
    ts: 'typescript',
    js: 'javascript',
    json: 'json',
    css: 'css',
    html: 'html',
  }

  return langMap[ext] ?? 'plaintext'
}

/**
 * 搜索过滤：大小写不敏感子串匹配 title / tags / summary
 * @param cases 全部已注册案例
 * @param query 用户输入的查询串（纯空白视为空 → 返回全部）
 * @returns 命中的案例数组
 */
export function filterCases(
  cases: RegisteredCase[],
  query: string,
): RegisteredCase[] {
  const q = query.trim().toLowerCase()

  // 空查询返回全部（不做任何过滤）
  if (!q) return cases

  return cases.filter((c) => {
    // 三个字段任一命中即保留
    const titleHit = c.meta.title.toLowerCase().includes(q)
    const summaryHit = c.meta.summary.toLowerCase().includes(q)
    // tags 数组逐个比较（toLowerCase 统一小写后匹配）
    const tagsHit = c.meta.tags.some((t) => t.toLowerCase().includes(q))
    return titleHit || summaryHit || tagsHit
  })
}

// ---------- 路径解析与注册表构建 ----------

/**
 * 从 glob key 解析分类 id 与案例 id
 * 注意：import.meta.glob 返回的 key 是相对当前模块目录的规范化路径，
 * 形如 './performance/perf-observer/Demo.vue'（以 ./ 开头，不含 examples 段）
 * @returns [categoryId, caseId]，解析失败返回 null
 */
function parseIdsFromPath(key: string): [string, string] | null {
  // 按 / 切分：['.', '<category>', '<case-id>', 'Demo.vue']
  const segments = key.split('/')
  // 至少要有 . / category / case-id 三段
  if (segments.length < 3 || !segments[0].startsWith('.')) return null
  return [segments[1], segments[2]]
}

/** 案例缓存键：分类 + 案例，避免不同分类下的同名案例互相覆盖 */
function makeCaseKey(categoryId: string, caseId: string): string {
  return `${categoryId}/${caseId}`
}

/** 内部条目：同步 meta + 全部懒加载函数（不导出，防止外部绕过缓存） */
interface CaseEntry {
  summary: RegisteredCase
  demoLoader: DemoLoader
  demoSourceLoader: TextLoader
  /** 该案例目录下的代码片段，按文件名排序，仅含文件名与加载函数 */
  codeFiles: Array<{ name: string; load: TextLoader }>
}

/** 按案例路径分类汇总 code/*.txt 的加载函数 */
const codeFilesByCase = new Map<
  string,
  Array<{ name: string; load: TextLoader }>
>()

for (const [codePath, load] of Object.entries(codeLoaders)) {
  const ids = parseIdsFromPath(codePath)
  if (!ids) continue
  const key = makeCaseKey(ids[0], ids[1])
  const name = codePath.split('/').pop() ?? codePath
  const list = codeFilesByCase.get(key) ?? []
  list.push({ name, load })
  codeFilesByCase.set(key, list)
}

/** 内部条目表：key = 分类/案例 */
const entries = new Map<string, CaseEntry>()

for (const [demoPath, demoLoader] of Object.entries(demoLoaders)) {
  const ids = parseIdsFromPath(demoPath)
  if (!ids) continue
  const [categoryId, caseId] = ids
  const key = makeCaseKey(categoryId, caseId)

  // 对应的 meta.ts 模块 key（同目录替换文件名）
  const metaPath = demoPath.replace(/Demo\.vue$/, 'meta.ts')
  const metaModule = metaModules[metaPath]

  // 校验：meta 缺失 —— dev 控制台报错并跳过，避免全站崩溃
  if (!metaModule) {
    console.error(`[registry] 案例 ${categoryId}/${caseId} 缺少 meta.ts，已跳过`)
    continue
  }

  // 校验：meta.id 必须与目录名一致（防止复制粘贴忘改 id 导致路由错乱）
  if (metaModule.default.id !== caseId) {
    console.error(
      `[registry] 案例 ${categoryId}/${caseId} 的 meta.id 为 "${metaModule.default.id}"，与目录名不一致，已跳过`,
    )
    continue
  }

  // 同一份 Demo.vue 的 ?raw 版本必须存在，否则源码 tab 会是空的
  const demoSourceLoader = demoSourceLoaders[demoPath]
  if (!demoSourceLoader) {
    console.error(
      `[registry] 案例 ${categoryId}/${caseId} 缺少 Demo.vue 源码加载器，已跳过`,
    )
    continue
  }

  // 代码片段按文件名排序，保证展示顺序稳定（与改造前行为一致）
  const codeFiles = (codeFilesByCase.get(key) ?? []).sort((a, b) =>
    a.name.localeCompare(b.name),
  )

  entries.set(key, {
    summary: {
      meta: metaModule.default,
      categoryId,
      codeFileCount: codeFiles.length,
    },
    demoLoader,
    demoSourceLoader,
    codeFiles,
  })
}

/** 已注册的全部案例（按分类顺序 + 目录名字典序排列） */
export const allCases: RegisteredCase[] = (() => {
  const result = [...entries.values()].map((entry) => entry.summary)

  // 排序：按 categories 声明顺序分组（复用分类定义，新增分类只改 categories.ts 一处），组内按案例 id 字典序
  const categoryOrder = categories.map((c) => c.id)
  result.sort((a, b) => {
    const ca = categoryOrder.indexOf(a.categoryId)
    const cb = categoryOrder.indexOf(b.categoryId)
    if (ca !== cb) return ca - cb
    return a.meta.id.localeCompare(b.meta.id)
  })

  return result
})()

/**
 * 按分类 id + 案例 id 查找单个案例（路由匹配用，同步）
 * @returns 命中的案例元数据，不存在返回 undefined
 */
export function getCase(
  categoryId: string,
  caseId: string,
): RegisteredCase | undefined {
  return entries.get(makeCaseKey(categoryId, caseId))?.summary
}

/**
 * 取内部条目；不存在时抛出明确错误，便于组件展示失败态
 */
function requireEntry(categoryId: string, caseId: string): CaseEntry {
  const entry = entries.get(makeCaseKey(categoryId, caseId))
  if (!entry) {
    throw new Error(`[registry] 案例 ${categoryId}/${caseId} 不存在`)
  }
  return entry
}

/** 演示组件缓存：Promise 缓存保证并发调用只 import 一次 */
const demoCache = new Map<string, Promise<Component>>()

/**
 * 按需加载演示组件（详情页渲染 Demo 时调用）
 * - 同一个案例多次调用复用同一个 Promise
 * - 加载失败会清掉缓存，允许用户重试
 */
export async function loadDemoComponent(
  categoryId: string,
  caseId: string,
): Promise<Component> {
  const key = makeCaseKey(categoryId, caseId)
  const cached = demoCache.get(key)
  if (cached) return cached

  const entry = requireEntry(categoryId, caseId)
  const task = entry.demoLoader().catch((error: unknown) => {
    // 失败不缓存：下次进入仍可重新尝试（例如临时网络错误）
    demoCache.delete(key)
    throw error
  })

  demoCache.set(key, task)
  return task
}

/** 源码包缓存：源码文本一次性加载后常驻，tab 切换零等待 */
const sourceCache = new Map<string, Promise<CaseSource>>()

/**
 * 按需加载某个案例的全部源码（Demo.vue 全文 + code/*.txt）
 * 并行请求该案例的所有片段；结果按文件名排序后缓存
 */
export async function loadCaseSource(
  categoryId: string,
  caseId: string,
): Promise<CaseSource> {
  const key = makeCaseKey(categoryId, caseId)
  const cached = sourceCache.get(key)
  if (cached) return cached

  const entry = requireEntry(categoryId, caseId)

  const task = Promise.all([
    entry.demoSourceLoader(),
    Promise.all(
      entry.codeFiles.map(async (file) => ({
        name: file.name,
        lang: resolveCodeLang(file.name),
        content: await file.load(),
      })),
    ),
  ])
    .then(([demoSource, codeTabs]) => ({
      demoSource,
      codeTabs,
    }))
    .catch((error: unknown) => {
      // 失败不缓存，允许用户重试
      sourceCache.delete(key)
      throw error
    })

  sourceCache.set(key, task)
  return task
}
