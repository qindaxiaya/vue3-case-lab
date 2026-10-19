// ============================================================
// 案例自动注册表
// 通过 import.meta.glob 扫描 src/examples/ 下约定目录结构，
// 自动收录全部案例——新增案例 = 新建目录，零注册成本。
//
// 目录约定：
//   src/examples/<category>/<case-id>/
//   ├── Demo.vue        可交互演示组件
//   ├── meta.ts         default export 满足 CaseMeta
//   └── code/*.txt      带注释的教学代码片段（?raw 导入）
// ============================================================
import type { Component } from 'vue'
import type { CaseMeta } from '../types/case'

/** 代码片段 tab（CodeWorkbench 展示单元） */
export interface CodeTab {
  /** 展示文件名，如 usage.vue.txt */
  name: string
  /** 高亮语言 id，如 vue / typescript */
  lang: string
  /** 原始代码文本 */
  content: string
}

/** 注册表条目：元数据 + 演示组件 + 完整源码 + 代码片段 */
export interface RegisteredCase {
  meta: CaseMeta
  /** 所属分类 id（来自目录路径） */
  categoryId: string
  /** 演示组件（供 <component :is> 渲染） */
  demoComponent: Component
  /** Demo.vue 完整源码文本（「完整源码」tab 展示） */
  demoSource: string
  /** 核心代码片段 tabs（按文件名排序） */
  codeTabs: CodeTab[]
}

// ---------- 四类 glob 扫描（eager：构建期全部内联） ----------

// 演示组件本体
const demoModules = import.meta.glob('../examples/*/*/Demo.vue', {
  eager: true,
}) as Record<string, { default: Component }>

// Demo.vue 的完整源码文本（?raw 导入，与组件解耦）
const demoSources = import.meta.glob('../examples/*/*/Demo.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// 教学代码片段（code/*.txt）
const codeFiles = import.meta.glob('../examples/*/*/code/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// 案例元数据（取 default export）
const metaModules = import.meta.glob('../examples/*/*/meta.ts', {
  eager: true,
}) as Record<string, { default: CaseMeta }>

// ---------- 工具函数 ----------

/**
 * 从代码片段文件名推断 highlight.js 语言
 * 规则：取「倒数第二段」扩展名映射；如 usage.vue.txt → vue
 * @param fileName 文件名，如 composable.ts.txt
 * @returns highlight.js 语言 id，未知回退 plaintext
 */
export function resolveCodeLang(fileName: string): string {
  // 去掉 .txt 后缀后按 . 分段，取最后一个扩展名（倒数第二段）
  const parts = fileName.replace(/\.txt$/, '').split('.')
  const ext = parts.length >= 2 ? parts[parts.length - 1] : ''

  // 扩展名 → highlight.js 语言 id 映射表
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
 * key 形如 '../examples/performance/perf-observer/Demo.vue'
 * @returns [categoryId, caseId]，解析失败返回 null
 */
function parseIdsFromPath(key: string): [string, string] | null {
  // 按 / 切分，examples 之后的前两段即 category 与 case-id
  const segments = key.split('/')
  const examplesIdx = segments.indexOf('examples')
  if (examplesIdx === -1 || segments.length < examplesIdx + 3) return null
  return [segments[examplesIdx + 1], segments[examplesIdx + 2]]
}

/** 已注册的全部案例（按分类顺序 + 目录名字典序排列） */
export const allCases: RegisteredCase[] = (() => {
  const result: RegisteredCase[] = []

  // 以 Demo.vue 组件为基准遍历（有组件才算完整案例）
  for (const [demoPath, demoModule] of Object.entries(demoModules)) {
    const ids = parseIdsFromPath(demoPath)
    if (!ids) continue
    const [categoryId, caseId] = ids

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

    // 收集该案例目录下的全部 code/*.txt 片段
    const codeTabs: CodeTab[] = []
    const codePrefix = demoPath.replace(/Demo\.vue$/, 'code/')
    for (const [codePath, content] of Object.entries(codeFiles)) {
      if (codePath.startsWith(codePrefix)) {
        // 文件名取路径最后一段，如 usage.vue.txt
        const name = codePath.split('/').pop() ?? codePath
        codeTabs.push({ name, lang: resolveCodeLang(name), content })
      }
    }
    // tabs 按文件名排序，保证展示顺序稳定
    codeTabs.sort((a, b) => a.name.localeCompare(b.name))

    result.push({
      meta: metaModule.default,
      categoryId,
      demoComponent: demoModule.default,
      demoSource: demoSources[demoPath] ?? '',
      codeTabs,
    })
  }

  // 排序：按 categories 声明顺序分组，组内按案例 id 字典序
  const categoryOrder = ['performance', 'observer', 'virtual', 'vue3']
  result.sort((a, b) => {
    const ca = categoryOrder.indexOf(a.categoryId)
    const cb = categoryOrder.indexOf(b.categoryId)
    if (ca !== cb) return ca - cb
    return a.meta.id.localeCompare(b.meta.id)
  })

  return result
})()

/**
 * 按分类 id + 案例 id 查找单个案例（路由匹配用）
 * @returns 命中的案例，不存在返回 undefined
 */
export function getCase(
  categoryId: string,
  caseId: string,
): RegisteredCase | undefined {
  return allCases.find(
    (c) => c.categoryId === categoryId && c.meta.id === caseId,
  )
}
