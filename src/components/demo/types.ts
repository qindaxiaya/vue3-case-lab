// ============================================================
// 案例演示区共享控件的类型
// 单独放 .ts，避免在 <script setup> 里写 ES 模块导出
// ============================================================

/** 分段控件的一个选项 */
export interface SegmentedOption {
  /** 选项值：字符串或数字，直接交给父组件 */
  value: string | number
  /** 显示文案 */
  label: string
  /** 单个选项禁用 */
  disabled?: boolean
}

/** 提示语义色 */
export type DemoToastTone = 'info' | 'ok' | 'bad' | 'warning'

/** 一条提示消息 */
export interface DemoToastMessage {
  /** 唯一 id，交给 TransitionGroup 做进出场 */
  id: number | string
  /** 提示文案 */
  text: string
  /** 语义色，默认 info */
  tone?: DemoToastTone
}
