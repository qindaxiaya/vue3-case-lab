// ============================================================
// notes ↔ Demo 同源校验白名单
//
// 只放「合理引用但案例实现里本来就不会出现」的名字，每条必须写原因：
// - 示意名：讲解原理时举的例子，不是案例实现
// - 库 / 浏览器 API：不是本案例自造的名字，Demo 可能不直接用
// - 通用词：正则的字母形态碰巧像标识符
//
// 不要为了消红灯把真实漂移塞进来：如果 notes 写的名字本该在 Demo / code 里，
// 先改 notes 或代码，让两边真正对齐后仍失败再加白名单。
// 新增条目必须来自真实扫描结果，不要预防性堆词（白名单会掩盖将来的改名漂移）。
// ============================================================

/** 允许在 notes 里出现、但不要求在案例实现里出现的标识符 → 原因 */
export const ALLOW_IDENTIFIERS: Record<string, string> = {
  // ---------- 浏览器 / DOM / Web API ----------
  getBoundingClientRect: '浏览器 API：读取元素矩形',
  scrollIntoView: '浏览器 API：把元素滚进视口',
  querySelectorAll: '浏览器 API：按选择器查询节点',
  addEventListener: '浏览器 API：注册事件监听',
  setInterval: '浏览器 API：定时器',
  setImmediate: '旧浏览器 / Node API：笔记里作为对比提到',
  scrollTop: 'DOM 属性：滚动偏移',
  scrollHeight: 'DOM 属性：滚动内容高度',
  clientHeight: 'DOM 属性：可视区高度',
  rootMargin: 'IntersectionObserver 选项名',
  performance: '浏览器全局对象（Performance API）',
  timing: 'performance.timing 的字段名',
  window: '浏览器全局对象',

  // ---------- 事件名 ----------
  mousemove: '浏览器事件名（mousemove）',
  touchmove: '浏览器事件名（touchmove）',
  rawKeyDown: 'Chrome DevTools Protocol 的按键事件名',

  // ---------- Vue / 框架 API ----------
  onMounted: 'Vue 生命周期 API（本案例可能用其他钩子）',
  onBeforeUnmount: 'Vue 生命周期 API（本案例用 onUnmounted）',
  deactivated: 'KeepAlive 生命周期钩子',
  useStore: 'Pinia 用法（本案例用 reactive 等效实现）',
  useContext: '示意 API（本案例演示 provide / inject）',

  // ---------- CSS / HTML / ARIA 术语 ----------
  'container-name': 'CSS 属性（container-name）',
  'justify-content': 'CSS 属性',
  'space-between': 'CSS justify-content 取值',
  'nth-child': 'CSS 伪类',
  invalid: 'CSS :invalid 状态（笔记写作不带冒号）',
  'max-height': 'CSS 属性',
  overflow: 'CSS 属性 / 取值',
  hidden: 'HTML 属性 / CSS 取值',
  'outline-style': 'CSS 属性',
  'outline-width': 'CSS 属性',
  'padding-inline': 'CSS 逻辑属性',
  'data-row': 'HTML data-* 属性（笔记用连字符写法）',
  'data-field': 'HTML data-* 属性（笔记用连字符写法）',
  'enter-to': 'Vue Transition 类名',
  'leave-from': 'Vue Transition 类名',
  'prefers-reduced-motion': '媒体查询名',
  reduce: '媒体查询取值（reduce）',
  proximity: 'scroll-snap-type 取值',
  tabindex: 'HTML 属性',
  textarea: 'HTML 标签名',
  select: 'HTML 标签名 / 通用词',
  contenteditable: 'HTML 属性',
  'n-input': 'Naive UI 组件标签名',

  // ---------- 其他案例 / 分类 / 第三方库名 ----------
  practice: '站点分类 id，不是案例变量',
  'container-query': '其他案例 id',
  'drag-sort': '其他案例 id',
  'slider-captcha': '其他案例 id',
  'sse-chat': '其他案例 id',
  'paths-ignore': 'GitHub Actions 配置键',
  keepalive: 'fetch 选项名',

  // ---------- 通用英文词 / JS 方法 / 配置字段 ----------
  prevIndex: '反面示例里的旧状态变量名（本案例用 nextIndex / index）',
  rowHeight: '定高列表公式里的通用变量名（实现里用 ROW_HEIGHT / rowH）',
  component: 'Vue 概念 / 通用词',
  bundle: '通用词：打包体积',
  includes: 'JavaScript 数组方法',
  splice: 'JavaScript 数组方法',
  typeof: 'JavaScript 运算符',
  prohibits: 'GitHub 分支保护响应字段',
  mergeStateStatus: 'GitHub GraphQL 字段',
  pinyin: '拼音搜索的示例数据',
  dingbu: '拼音搜索的示例数据（顶部）',
}
