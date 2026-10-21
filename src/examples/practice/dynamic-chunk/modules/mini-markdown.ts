// ============================================================
// 迷你 Markdown 渲染器（只支持标题/列表/段落/行内代码/加粗）
// - 返回结构化块而不是 HTML 字符串：页面直接渲染，永远不用 v-html
// - 体积很小，用来对比「轻模块」与「重模块」的加载代价
// ============================================================

/** 一个渲染块：类型决定页面用什么标签 */
export type MdBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'paragraph'; text: string }

/** 行内片段：加粗与行内代码拆成独立片段，页面按类型加样式 */
export interface MdSpan {
  text: string
  bold: boolean
  code: boolean
}

/**
 * 解析 Markdown 文本
 * 逐行状态机：遇到列表就在收集完连续列表行后统一产出
 */
export function renderMarkdown(source: string): MdBlock[] {
  const blocks: MdBlock[] = []
  let listBuffer: string[] = []

  const flushList = (): void => {
    if (listBuffer.length > 0) {
      blocks.push({ type: 'list', items: listBuffer })
      listBuffer = []
    }
  }

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim()

    if (line === '') {
      flushList()
      continue
    }

    // 列表项：连续的 - 或 * 开头
    if (/^[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^[-*]\s+/, ''))
      continue
    }
    flushList()

    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3
      blocks.push({ type: 'heading', level, text: heading[2] })
      continue
    }

    blocks.push({ type: 'paragraph', text: line })
  }

  flushList()
  return blocks
}

/**
 * 拆分行内标记：**加粗** 与 `代码`
 * 用简单的两段扫描，够用且不引入正则回溯风险
 */
export function splitInline(text: string): MdSpan[] {
  const spans: MdSpan[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let cursor = 0
  let match: RegExpExecArray | null = pattern.exec(text)

  while (match) {
    if (match.index > cursor) {
      spans.push({ text: text.slice(cursor, match.index), bold: false, code: false })
    }
    const token = match[0]
    if (token.startsWith('**')) {
      spans.push({ text: token.slice(2, -2), bold: true, code: false })
    } else {
      spans.push({ text: token.slice(1, -1), bold: false, code: true })
    }
    cursor = match.index + token.length
    match = pattern.exec(text)
  }

  if (cursor < text.length) {
    spans.push({ text: text.slice(cursor), bold: false, code: false })
  }
  return spans
}

/** 案例内置的示例文档 */
export const SAMPLE_DOC = `# 按需加载笔记

把不常用的功能拆成独立文件，等用户真的点开再下载。

## 什么时候值得拆

- 首屏**一定用不到**的重功能，比如导出、图表、编辑器
- 用户可能一辈子只点一次的设置面板
- 依赖很重的第三方库，例如解析器、PDF 渲染

## 什么时候别拆

- 首屏就要显示的表格、导航、按钮
- 拆完只有 2 KB 的模块，多一次请求反而更慢

> 判断标准只有一个：\`首屏真的用不到吗\`
`
