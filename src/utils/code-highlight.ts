// ============================================================
// highlight.js 共享配置
// - CodeWorkbench：逐行高亮核心代码 / demo 源码
// - NotesPanel：高亮 notes.md 里的代码块
// 两处共用同一个 hljs 实例，语言只注册一次，避免重复与告警
// ============================================================
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import yaml from 'highlight.js/lib/languages/yaml'
import 'highlight.js/styles/github.css'

// 按需注册语言（控制体积）
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('yaml', yaml)

// notes.md 里的小写围栏语言：vue / html 统一按 xml 上色（标签结构够看，
// 也避免 highlight.js 因找不到 vue 语言而在控制台告警）
hljs.registerAliases(['vue', 'html'], { languageName: 'xml' })

/**
 * 高亮容器内所有 `pre code` 代码块
 * 用于 v-html 渲染后的 markdown（元素由 marked 生成，无 Vue 绑定）
 * 单个代码块失败不影响其他块，也不阻塞页面
 */
export function highlightCodeBlocks(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('pre code').forEach((el) => {
    try {
      hljs.highlightElement(el)
    } catch {
      // 未知语言或异常内容：保留 marked 生成的纯文本即可
    }
  })
}

export { hljs }
