// ============================================================
// 案例演示区共享控件的类型
// 单独放 .ts，避免在 <script setup> 里写 ES 模块导出
// ============================================================

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
