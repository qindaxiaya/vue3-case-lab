// ============================================================
// notes.md 懒加载器（详情页「深入」tab 用）
// - 不进 registry 的同步字段：56 篇约 160KB，不应塞进列表页首屏包
// - import.meta.glob 只在真正打开 tab 时发起动态导入
// - 按案例缓存 Promise：切走再切回不会重复请求
// ============================================================

/** 每个案例目录的 notes.md 加载器（key 形如 ./performance/raf-loop/notes.md） */
const noteLoaders = import.meta.glob('./*/*/notes.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

/** 已加载/加载中的 Promise 缓存（失败时删除，允许重试） */
const cache = new Map<string, Promise<string>>()

/**
 * 读取某个案例的 notes.md 原文
 * @returns 文件内容；没有对应文件时返回空串（页面显示空状态）
 */
export function loadCaseNotes(
  categoryId: string,
  caseId: string,
): Promise<string> {
  const key = `./${categoryId}/${caseId}/notes.md`
  const loader = noteLoaders[key]

  // 未收录的目录（例如只有资料没有 Demo）直接当空处理
  if (!loader) return Promise.resolve('')

  const cached = cache.get(key)
  if (cached) return cached

  const task = loader().catch((error: unknown) => {
    // 失败不缓存，用户点「重试」时重新导入
    cache.delete(key)
    throw error
  })
  cache.set(key, task)
  return task
}

/**
 * 去掉 notes.md 的首个 H1 标题
 * 页面已经展示了案例标题，正文从「## 1. 现象与场景」开始即可
 */
export function stripNotesTitle(markdown: string): string {
  return markdown.replace(/^#\s+.*(?:\r?\n)+/, '')
}
