// ============================================================
// 全量入口：把三个功能模块静态汇总在一起
// - 演示「错误做法」：只要引入它，三个模块 + 数据集会被一起下载
// - 用 re-export 而不是复制代码，保证两种模式跑的是同一份实现
// ============================================================

// 静态 import/export：打包器会把这三条依赖合并进同一个文件
export { buildReport, type ReportResult } from './city-report'
export { buildSampleCsv, parseCsv, type CsvResult } from './csv-kit'
export {
  renderMarkdown,
  splitInline,
  SAMPLE_DOC,
  type MdBlock,
  type MdSpan,
} from './mini-markdown'
