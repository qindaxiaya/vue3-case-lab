// ============================================================
// 演示区提示：统一走 Naive UI 的 message（不再自建 toast）
//
// 为什么需要这一层桥接：
// - Naive 的 useMessage() 必须在 <n-message-provider> 内部调用；
// - 案例 Demo 是 provider 的「父级」（Demo 里包 DemoNaive），
//   在 Demo 自己的 setup 里 inject 找不到 provider；
// - 所以由 DemoMessageBridge（provider 的子组件）把真实 api 注册到模块级，
//   Demo 里通过 demoMessage.xxx() 调用——调用发生在用户交互时，
//   那时 bridge 早已挂载完成，不存在时序问题；
// - 同一时刻只会渲染一个案例演示，模块级单例不会串台。
// ============================================================
import type { MessageApi } from 'naive-ui'

/** bridge 注册进来的真实 api；provider 卸载时清空，避免指向已销毁实例 */
let api: MessageApi | null = null

/** 是否已经提示过「provider 没挂载」（开发期配置错误只提示一次） */
let warned = false

/** 由 DemoMessageBridge 在挂载时注册、卸载时清空 */
export function setDemoMessageApi(next: MessageApi | null): void {
  api = next
}

/**
 * 调用时再读 api：Demo 的 setup 早于 bridge 挂载，
 * 提前缓存 api 会拿到 null；所以这里每次调用都现取
 */
function current(): MessageApi | null {
  if (!api && import.meta.env.DEV && !warned) {
    warned = true
    console.warn('[demo] 演示区 message provider 还没挂载，本次提示被忽略')
  }
  return api
}

/** 演示区提示：方法名与 Naive 的 message 一致，方便直接照官方文档用 */
export const demoMessage = {
  success: (text: string): void => {
    current()?.success(text)
  },
  error: (text: string): void => {
    current()?.error(text)
  },
  warning: (text: string): void => {
    current()?.warning(text)
  },
  info: (text: string): void => {
    current()?.info(text)
  },
  /** 清空当前所有提示（切换模式 / 重置时用） */
  destroyAll: (): void => {
    current()?.destroyAll()
  },
}
