// ============================================================
// 正文字索引：把 notes.md 变成可搜索的纯文本
// - 只做纯函数，不碰浏览器 / Vue / import.meta.glob，便于单测
// - 数据流：notes.md → toPlainText（去标记）→ NotesDoc
//   → searchNotes（命中计数 + 片段）→ mergeSearchHits（与元数据结果合并）
// - 为什么要去 Markdown 标记：否则搜「###」或「**」会命中所有标题与粗体，
//   且片段里带一堆符号，读者看不出命中在哪
// ============================================================

/** 一篇案例正文的索引文档 */
export interface NotesDoc {
  /** 分类 id（路由与结果跳转用） */
  categoryId: string
  /** 案例 id（同一分类下唯一） */
  caseId: string
  /** 去标记后的正文（保留换行与原始大小写，用于截取片段展示） */
  plain: string
  /** 匹配用小写文本（与 plain 等长，索引位置可直接复用） */
  haystack: string
}

/** 正文命中结果 */
export interface NotesHit {
  categoryId: string
  caseId: string
  /** 命中前后的上下文片段（已压成单行、带省略号） */
  snippet: string
  /** 关键词出现次数，用于排序（命中越多越相关） */
  count: number
}

/** 合并后的搜索结果（元数据命中 + 正文命中） */
export interface SearchResult {
  categoryId: string
  caseId: string
  /** 是否命中了正文（结果里显示「正文」标记） */
  viaNotes: boolean
  /** 正文片段；没命中正文时为空串（模板回退展示 summary） */
  snippet: string
}

/** 高亮切分的一段文本 */
export interface TextPart {
  text: string
  /** true = 命中关键词，模板用 <mark> 包起来 */
  hit: boolean
}

/**
 * Markdown → 纯文本
 * 保留文字内容与换行（换行便于截片段），去掉所有排版标记
 */
export function toPlainText(markdown: string): string {
  let text = markdown

  // 1. 代码围栏行整行去掉，围栏内的代码保留：
  //    很多 API 名只出现在代码块里，丢掉就搜不到了
  text = text.replace(/^[ \t]*(?:```|~~~).*$/gm, '')

  // 2. 表格分隔行（| --- | :--: |）整行去掉，避免片段里出现一长串横线
  text = text.replace(/^[ \t]*\|?[ \t:|-]*-{3,}[ \t:|-]*\|?[ \t]*$/gm, '')

  // 3. 图片保留 alt 文字、链接保留链接文字（URL 本身没有检索价值）
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')

  // 4. 行首标记：标题井号 / 引用箭头 / 列表短横与序号
  text = text.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
  text = text.replace(/^[ \t]{0,3}>[ \t]?/gm, '')
  text = text.replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, '')

  // 5. 行内标记：行内代码反引号、粗体/斜体星号与下划线、删除线
  text = text.replace(/`{1,3}([^`]*)`{1,3}/g, '$1')
  text = text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
  text = text.replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
  text = text.replace(/~~([^~]+)~~/g, '$1')

  // 6. 表格竖线换成空格（不换行，保证同一行的内容仍连在一起）
  text = text.replace(/[ \t]*\|[ \t]*/g, ' ')

  // 7. HTML 标签与分隔线
  text = text.replace(/<[^>]+>/g, '')
  text = text.replace(/^[ \t]*-{3,}[ \t]*$/gm, '')

  // 8. 连续空行压成一行空行，trim 掉首尾空白
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

/** 由 Markdown 原文构建索引文档 */
export function buildNotesDoc(
  categoryId: string,
  caseId: string,
  markdown: string,
): NotesDoc {
  const plain = toPlainText(markdown)
  return {
    categoryId,
    caseId,
    plain,
    // toLowerCase 对常见文字不改变长度，索引可直接复用到 plain 上
    haystack: plain.toLowerCase(),
  }
}

/** 统计关键词出现次数（大小写不敏感的子串计数） */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0
  let from = 0
  for (;;) {
    const index = haystack.indexOf(needle, from)
    if (index < 0) return count
    count += 1
    // 从下一个字符继续找，允许重叠命中（例如「aa」里找「a」）
    from = index + 1
  }
}

/**
 * 截取命中处的上下文片段
 * @param radius 命中词前后各保留多少个字符
 * @returns 片段；未命中返回 null
 */
export function findSnippet(
  doc: NotesDoc,
  query: string,
  radius = 24,
): string | null {
  const q = query.trim().toLowerCase()
  if (!q) return null

  const index = doc.haystack.indexOf(q)
  if (index < 0) return null

  const start = Math.max(0, index - radius)
  const end = Math.min(doc.plain.length, index + q.length + radius)

  // 压成单行：搜索结果列表里一行显示不完，换行会让卡片高度乱跳
  const body = doc.plain.slice(start, end).replace(/\s+/g, ' ').trim()
  return `${start > 0 ? '…' : ''}${body}${end < doc.plain.length ? '…' : ''}`
}

/**
 * 正文检索
 * @param limit 最多返回多少条（默认 8，与搜索结果条数上限一致）
 * @returns 按命中次数降序排列的命中列表
 */
export function searchNotes(
  docs: NotesDoc[],
  query: string,
  limit = 8,
): NotesHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const hits: NotesHit[] = []
  for (const doc of docs) {
    const count = countOccurrences(doc.haystack, q)
    if (count === 0) continue
    const snippet = findSnippet(doc, q)
    // 理论上 count > 0 时一定有片段；防御性跳过，保证 snippet 类型非空
    if (!snippet) continue
    hits.push({
      categoryId: doc.categoryId,
      caseId: doc.caseId,
      snippet,
      count,
    })
  }

  // 命中次数多的更相关；次数相同按案例 id 排，保证结果稳定可预期
  hits.sort((a, b) => b.count - a.count || a.caseId.localeCompare(b.caseId))
  return limit > 0 ? hits.slice(0, limit) : hits
}

/**
 * 把文本按关键词切成片段，供模板用 <mark> 高亮
 * 不用 v-html：避免把笔记里的内容当 HTML 注入
 */
export function highlightParts(text: string, query: string): TextPart[] {
  const q = query.trim()
  if (!q) return [{ text, hit: false }]

  const haystack = text.toLowerCase()
  const needle = q.toLowerCase()
  const parts: TextPart[] = []
  let from = 0

  for (;;) {
    const index = haystack.indexOf(needle, from)
    if (index < 0) break
    if (index > from) parts.push({ text: text.slice(from, index), hit: false })
    parts.push({ text: text.slice(index, index + needle.length), hit: true })
    from = index + needle.length
  }

  if (from < text.length) parts.push({ text: text.slice(from), hit: false })
  return parts.length > 0 ? parts : [{ text, hit: false }]
}

/**
 * 合并两类结果：元数据命中（标题/摘要/标签）优先，正文独有命中追加在后
 * @param metaCases 已按标题/摘要/标签命中的案例（保持原顺序）
 * @param noteHits 正文命中（已按相关度排序）
 * @param limit 结果上限
 */
export function mergeSearchHits(
  metaCases: ReadonlyArray<{ categoryId: string; meta: { id: string } }>,
  noteHits: ReadonlyArray<NotesHit>,
  limit = 8,
): SearchResult[] {
  const hitByKey = new Map(
    noteHits.map((hit) => [`${hit.categoryId}/${hit.caseId}`, hit]),
  )
  const seen = new Set<string>()
  const results: SearchResult[] = []

  // 1. 元数据命中：顺序沿用 registry 的分类/字典序，用户熟悉的排前面
  for (const item of metaCases) {
    const key = `${item.categoryId}/${item.meta.id}`
    if (seen.has(key)) continue
    seen.add(key)

    const hit = hitByKey.get(key)
    results.push({
      categoryId: item.categoryId,
      caseId: item.meta.id,
      viaNotes: Boolean(hit),
      snippet: hit?.snippet ?? '',
    })
  }

  // 2. 只有正文命中的案例：补在后面，避免被标题命中的案例挤掉
  for (const hit of noteHits) {
    const key = `${hit.categoryId}/${hit.caseId}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push({
      categoryId: hit.categoryId,
      caseId: hit.caseId,
      viaNotes: true,
      snippet: hit.snippet,
    })
  }

  return limit > 0 ? results.slice(0, limit) : results
}
