// ============================================================
// 逐帧缓动滚动（回到顶部按钮、详情页 tab 对齐共用）
// - 不依赖 behavior: 'smooth'：系统「减少动态效果」等设置可能把它降级成瞬间跳转，
//   自己插值才能保证「要么真的平滑，要么按设置直接跳」
// - 模块级只保留一段动画：新动画开始或用户手动滚动时，旧动画立即让位
// ============================================================

/** 当前动画令牌：新动画或用户手动滚动时让旧动画停下 */
let scrollAnimId = 0
/** 正在进行的滚动动画的清理函数 */
let stopScrollAnim: (() => void) | null = null

/**
 * 逐帧缓动滚动到目标位置
 * @param targetY 目标滚动高度（px）
 * @param duration 动画时长（毫秒）
 */
export function smoothScrollTo(targetY: number, duration = 460): void {
  // 连续点击 / 切换 tab 时先停掉上一段，避免两段动画互相抢
  stopScrollAnim?.()

  const startY = window.scrollY
  const distance = targetY - startY
  if (Math.abs(distance) < 1) return

  const root = document.documentElement

  // 系统开启“减少动态效果”时直接跳转：CSS 的 reduced-motion 管不到这段 JS 动画
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // 让上一段动画的 rAF 失效，避免它下一帧把位置又拉回旧目标
    scrollAnimId++
    const prevBehavior = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    window.scrollTo(0, targetY)
    root.style.scrollBehavior = prevBehavior
    return
  }

  const id = ++scrollAnimId
  const prevBehavior = root.style.scrollBehavior

  // 临时关闭 CSS 平滑：否则每帧的 scrollTo 会被再平滑一次，动画收尾拖尾
  root.style.scrollBehavior = 'auto'

  const startTime = performance.now()
  // 缓入缓出：起步和收尾都柔和（比线性更像真实滚动）
  const ease = (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

  /** 结束动画：恢复页面原有的滚动行为并移除监听 */
  function finish(): void {
    root.style.scrollBehavior = prevBehavior
    window.removeEventListener('wheel', onUserScroll)
    window.removeEventListener('touchstart', onUserScroll)
    if (stopScrollAnim === finish) stopScrollAnim = null
  }

  /** 用户自己滚动时立即让出控制权，不跟用户抢 */
  function onUserScroll(): void {
    scrollAnimId++
    finish()
  }

  stopScrollAnim = finish
  window.addEventListener('wheel', onUserScroll, { passive: true })
  window.addEventListener('touchstart', onUserScroll, { passive: true })

  function step(now: number): void {
    // 令牌变了说明动画已被取消（用户滚动或开始了新动画）
    if (id !== scrollAnimId) return

    const progress = Math.min(1, (now - startTime) / duration)
    window.scrollTo(0, startY + distance * ease(progress))

    if (progress < 1) {
      requestAnimationFrame(step)
    } else {
      finish()
    }
  }

  requestAnimationFrame(step)
}

/**
 * 停掉正在进行的滚动动画
 * 组件卸载时调用：避免动画闭包继续持有已销毁组件里的 DOM 引用
 */
export function stopSmoothScroll(): void {
  stopScrollAnim?.()
}
