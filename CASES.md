# 案例清单

> 本文件由 `npm run gen:cases` 根据 `src/examples/registry.ts` 自动生成，请勿手动修改。
> 共 85 个案例 / 9 个分类。

## CSS 技巧（css）

| 案例 | 标题 | 难度 | 标签 | 摘要 |
| --- | --- | --- | --- | --- |
| [aspect-ratio-cls](/cases/css/aspect-ratio-cls) | aspect-ratio 图片占位防抖动 | 入门 | `aspect-ratio` `布局偏移` `图片布局` | 图片加载前用 16 比 9 占位，下方内容不被顶来顶去 |
| [container-query](/cases/css/container-query) | 容器查询 @container | 进阶 | `@container` `container-type` `响应式布局` | 同一张卡片放进宽窄不同的容器，布局会跟着容器宽度自动切换 |
| [fluid-clamp](/cases/css/fluid-clamp) | clamp 流体字号 | 入门 | `clamp` `cqi` `响应式排版` | 标题字号在 16 与 40px 间随容器宽度连续渐变，不设断点 |
| [grid-auto-fit](/cases/css/grid-auto-fit) | auto-fit 自适应卡片网格 | 入门 | `grid` `auto-fit` `minmax` `响应式布局` | 卡片列表随容器宽度自动增减列，一行声明替代手写断点表 |
| [has-parent](/cases/css/has-parent) | has 父级选择器 | 进阶 | `:has()` `伪类` `零 JS 交互` | 卡片有缩略图才双列、必填为空容器变红边，纯样式解决 |

## 浏览器基础（basics）

| 案例 | 标题 | 难度 | 标签 | 摘要 |
| --- | --- | --- | --- | --- |
| [clipboard-api](/cases/basics/clipboard-api) | Clipboard 写入与降级复制 | 入门 | `ClipboardItem` `execCommand` `writeText` | 富文本复制三层降级链路，连测十次统计成功率与当前层级 |
| [event-loop](/cases/basics/event-loop) | 宏任务与微任务执行顺序 | 入门 | `setTimeout` `Promise.then` `queueMicrotask` | 定时器、微任务、逐帧回调混跑谁先谁后？打印真实顺序与时间戳 |
| [intl-format](/cases/basics/intl-format) | Intl 按语言格式化日期与数字 | 入门 | `Intl` `DateTimeFormat` `RelativeTimeFormat` | 同一份数据切换中英日三种语言，手写拼接和 Intl 输出直接对照 |
| [structured-clone](/cases/basics/structured-clone) | structuredClone 深拷贝与类型保真 | 入门 | `structuredClone` `JSON.parse` `深拷贝` | 十万条含日期与嵌套映射的对象三种拷法实测耗时与保真打勾 |
| [url-search-params](/cases/basics/url-search-params) | URLSearchParams 筛选状态进地址栏 | 入门 | `URLSearchParams` `replaceState` `popstate` | 分类、关键词、页码写进地址栏，刷新后退分享都能还原筛选状态 |

## 动画与交互（animation）

| 案例 | 标题 | 难度 | 标签 | 摘要 |
| --- | --- | --- | --- | --- |
| [accordion-slide](/cases/animation/accordion-slide) | 折叠面板平滑展开 | 入门 | `grid-template-rows` `折叠面板` `过渡动画` `无障碍` | 用 grid 的 0fr 到 1fr 过渡，任意内容高度都平滑展开 |
| [drawer-slide](/cases/animation/drawer-slide) | 抽屉侧滑与退出动画 | 进阶 | `transform` `transitionend` `抽屉` `焦点管理` | 关闭时等过渡结束再卸载节点，抽屉滑出、遮罩淡出都看得见 |
| [focus-visible-ring](/cases/animation/focus-visible-ring) | 键盘焦点环 | 入门 | `focus-visible` `outline` `键盘无障碍` `焦点管理` | 用 :focus-visible 只在键盘操作时画焦点环，鼠标点击不打扰 |
| [magnetic-button](/cases/animation/magnetic-button) | 磁性按钮：指针跟随微交互 | 入门 | `pointermove` `transform` `微交互` `getBoundingClientRect` | 指针靠近时按钮轻微跟随，离开缓动回弹，触摸与减少动态效果自动关闭 |
| [progress-ring](/cases/animation/progress-ring) | SVG 进度环 | 入门 | `svg` `stroke-dashoffset` `过渡动画` `进度` | 只改一次目标值，让样式过渡补齐中间帧，进度环平滑走完 |
| [skeleton-shimmer](/cases/animation/skeleton-shimmer) | 骨架屏微光加载 | 入门 | `骨架屏` `加载态` `keyframes` `布局稳定` | 加载时先铺同尺寸灰块，内容到位再淡入，页面不跳动 |
| [snap-carousel](/cases/animation/snap-carousel) | 滚动吸附轮播 | 入门 | `scroll-snap` `scrollIntoView` `轮播` `键盘导航` | 用滚动吸附与 scrollIntoView 对齐卡片，索引从滚动位置反推 |
| [tooltip-pop](/cases/animation/tooltip-pop) | 提示气泡：延迟出现与定位 | 入门 | `tooltip` `aria-describedby` `定时器` `指针事件` | 自建气泡控制延迟与位置，鼠标移入延迟出现，键盘聚焦立即可见 |

## 性能监控（performance）

| 案例 | 标题 | 难度 | 标签 | 摘要 |
| --- | --- | --- | --- | --- |
| [chat-scroll](/cases/performance/chat-scroll) | 聊天流吸底 | 高级 | `滚动` `吸底` `未读提示` `历史加载` | 聊天窗口贴底跟随、上翻看历史不打扰、自己发言必回底，顶部加载还要保住视线 |
| [content-visibility](/cases/performance/content-visibility) | content-visibility 长列表 | 高级 | `content-visibility` `渲染优化` `长列表` | 3000 条卡片对比默认与跳过屏外渲染的耗时，自动测三次取中位数 |
| [idle-schedule](/cases/performance/idle-schedule) | requestIdleCallback 空闲调度 | 进阶 | `requestIdleCallback` `空闲调度` `分片` | 把重活拆进浏览器空闲时段，剩余时间预算内执行，超时兜底避免任务饿死 |
| [perf-observer](/cases/performance/perf-observer) | PerformanceObserver 性能监控面板 | 高级 | `PerformanceObserver` `LCP` `CLS` `INP` | 用性能观察器采集帧率、内存与加载体验指标，实时面板加可交互实验台 |
| [pull-refresh](/cases/performance/pull-refresh) | 下拉刷新 + 触底加载 | 进阶 | `移动端` `Pointer 事件` `下拉刷新` `无限加载` | 指针拖动配合阻尼与阈值触发刷新，滚到底自动加载下一页，两个加载互斥 |
| [raf-loop](/cases/performance/raf-loop) | 逐帧动画 | 进阶 | `requestAnimationFrame` `动画` `渲染循环` | 每帧按时间戳推进动画，掉帧也不变慢，帧率与帧间隔实时可见 |
| [raf-throttle](/cases/performance/raf-throttle) | 逐帧合并高频渲染 | 进阶 | `requestAnimationFrame` `节流` `高频事件` | 鼠标每秒触发数百次，合并到每帧只渲染一次，两个计数直接对比优化前后 |
| [sse-chat](/cases/performance/sse-chat) | SSE 流式聊天 + 断线重连 | 高级 | `SSE` `流式` `断线重连` `AbortController` | 本地模拟流式对话：断线后从上次编号续传，支持手动中止，回答不重复不遗漏 |
| [time-slicing](/cases/performance/time-slicing) | 长列表时间切片 | 高级 | `时间切片` `rAF` `长任务` `首屏` | 三万条数据按每批 300 条分帧渲染，对比全量的首帧、最大阻塞与点击响应 |
| [typewriter-stream](/cases/performance/typewriter-stream) | 流式打字机 | 进阶 | `流式输出` `rAF` `缓冲区` `SSE` | 把接收与消费分开，逐帧匀速取出字符，避免数据成批到达时文字突然跳一大段 |
| [web-worker](/cases/performance/web-worker) | Web Worker 主线程解冻 | 进阶 | `Worker` `Blob URL` `多线程` | 同一份重计算分别放主线程与后台线程，用心跳对比界面冻结与照常响应 |

## 观察者（observer）

| 案例 | 标题 | 难度 | 标签 | 摘要 |
| --- | --- | --- | --- | --- |
| [infinite-scroll](/cases/observer/infinite-scroll) | 无限滚动加载 | 进阶 | `IntersectionObserver` `分页` `哨兵元素` | 在列表底部放哨兵元素，提前 200 像素预取下一页，并用加载开关挡住重复请求 |
| [intersection-observer](/cases/observer/intersection-observer) | 交叉观察器曝光统计 | 进阶 | `IntersectionObserver` `曝光` `可见性` | 对比滚动读取位置与交叉观察器，实时显示每张卡片可见比例和曝光次数 |
| [lazy-image](/cases/observer/lazy-image) | IntersectionObserver 图片懒加载 | 进阶 | `IntersectionObserver` `懒加载` `曝光` | 用观察器判断图片是否进入视口，进入才下载，加载完立即停止观察，三种参数对比 |
| [mutation-observer](/cases/observer/mutation-observer) | MutationObserver DOM 变更监听 | 进阶 | `MutationObserver` `childList` `takeRecords` | 监听页面子节点、属性与文字的变化，批量回调避免刷屏，适合第三方内容注入场景 |
| [resize-observer](/cases/observer/resize-observer) | ResizeObserver 容器尺寸监听 | 入门 | `ResizeObserver` `响应式布局` `content-box` | 监听容器尺寸变化替代轮询，对比内容区与含边框两种测量模式，按需选精确值 |

## 虚拟渲染（virtual）

| 案例 | 标题 | 难度 | 标签 | 摘要 |
| --- | --- | --- | --- | --- |
| [virtual-grid](/cases/virtual/virtual-grid) | 虚拟网格 | 高级 | `虚拟滚动` `网格` `大数据` | 5000 张卡片只渲染可视区，滚动时切换行窗口，对比全量渲染的节点数 |
| [virtual-list](/cases/virtual/virtual-list) | 定高虚拟列表 | 进阶 | `虚拟列表` `长列表` `rAF 节流` | 十万行只渲染可视区域内约三十个元素，用位移模拟滚动，逐帧节流更新 |
| [virtual-variable](/cases/virtual/virtual-variable) | 虚拟列表（不定行高） | 高级 | `虚拟列表` `二分查找` `前缀和` `长列表` | 两千条不定高消息用前缀和与二分查找定位，只渲染可视区约十行，附全量对照 |

## Vue 3 API（vue3）

| 案例 | 标题 | 难度 | 标签 | 摘要 |
| --- | --- | --- | --- | --- |
| [async-suspense](/cases/vue3/async-suspense) | 异步组件加载与重试 | 进阶 | `defineAsyncComponent` `代码分割` `Suspense` | 异步组件的加载、延迟、超时、加载中与错误五项配置，演示换 key 重试 |
| [computed-cache](/cases/vue3/computed-cache) | computed 缓存 vs 方法 vs watch | 进阶 | `computed` `watch` `缓存` `渲染` | 改无关状态时计算属性不重算、方法每次执行、侦听器不触发，用计数看清边界 |
| [custom-directives](/cases/vue3/custom-directives) | 自定义指令三件套 | 进阶 | `directive` `权限` `懒加载` `click-outside` `IntersectionObserver` | 用三个自定义指令实现权限控制、观察器懒加载与点击外部关闭，含完整清理 |
| [define-model](/cases/vue3/define-model) | defineModel 组件双向绑定 | 进阶 | `defineModel` `v-model` `props` `emit` | 同一个输入框用旧写法与新写法并排实现双向绑定，父级改写与子级输入都验证 |
| [editable-table](/cases/vue3/editable-table) | 可编辑表格 + 行内校验 | 进阶 | `表格` `表单校验` `双击编辑` `状态机` | 双击进入编辑，失焦或回车保存、Esc 取消，三类校验拦截并统计失败次数 |
| [effect-scope](/cases/vue3/effect-scope) | effectScope 批量停止副作用 | 高级 | `effectScope` `onScopeDispose` `内存泄漏` `watch` | 反复挂载卸载时用副作用作用域统一停止侦听器与定时器，把隐式泄漏变成数字 |
| [multi-v-model](/cases/vue3/multi-v-model) | 多 v-model 参数与修饰符 | 进阶 | `defineModel` `v-model` `修饰符` `trim` | 一个组件同时绑定标题、姓名与显示状态三个模型，写入自动去空格，父子同步 |
| [reactive-inject](/cases/vue3/reactive-inject) | 响应式依赖注入 | 进阶 | `provide` `inject` `readonly` `Symbol` | 跨三层传递响应式数据并保持同步，用唯一值避免键冲突，演示两种只读边界 |
| [reactive-loss](/cases/vue3/reactive-loss) | 响应式丢失的 5 个现场 | 高级 | `reactive` `toRef` `toRefs` `解构` `props` | 复现解构、整体赋值、浅拷贝等五处响应式丢失，并逐条给出正确写法 |
| [recursive-tree](/cases/vue3/recursive-tree) | 递归组件 + 作用域插槽 | 高级 | `递归组件` `作用域插槽` `slot` `树形` | 节点组件引用自身渲染任意层级，父级用作用域插槽定制样式，换 key 重置展开 |
| [shallow-markraw](/cases/vue3/shallow-markraw) | shallowRef / markRaw 性能边界 | 高级 | `shallowRef` `markRaw` `triggerRef` | 对比深代理、浅代理与永不代理三档开销，大数据只改引用时手动触发更新 |
| [teleport-layer](/cases/vue3/teleport-layer) | Teleport 弹层管理 | 进阶 | `Teleport` `z-index` `弹层` | 把弹层挂到页面根部脱离父级裁剪，用集中式层级计数避免多个弹层互相压住 |
| [teleport-modal](/cases/vue3/teleport-modal) | Teleport 弹层工程化 | 进阶 | `Teleport` `焦点陷阱` `滚动锁` `无障碍` | 弹窗挂到根部之后，还要锁滚动、Esc 关闭、Tab 焦点循环与关闭后归还焦点 |
| [theme-switch](/cases/vue3/theme-switch) | 主题切换无闪烁 | 入门 | `CSS 变量` `暗色模式` `matchMedia` `localStorage` | 亮色、暗色、跟随系统三态切换，配合首屏内联脚本，讲清刷新闪白的根因 |
| [transition-group](/cases/vue3/transition-group) | 过渡组列表动画 | 进阶 | `过渡组` `列表动画` `位移` | 打乱或增删列表时，对比普通替换与过渡组的位移动画和完成耗时 |
| [v-memo](/cases/vue3/v-memo) | v-memo 渲染缓存 | 高级 | `v-memo` `渲染优化` `patch flag` | 依赖数组没变化就跳过整棵子树的更新，无关状态变化零渲染，逐行计数验证 |
| [watch-traps](/cases/vue3/watch-traps) | watch/watchEffect 三大陷阱 | 高级 | `watch` `watchEffect` `deep` `flush` | 拆解浅监听看不到嵌套、异步清理时机、三种执行时机读不到元素三类陷阱 |

## 组合式函数（composables）

| 案例 | 标题 | 难度 | 标签 | 摘要 |
| --- | --- | --- | --- | --- |
| [use-async-task](/cases/composables/use-async-task) | useAsyncTask：异步请求的状态机 | 进阶 | `组合式函数` `异步请求` `AbortController` `状态机` | loading、error、取消、重试，一个组合式函数全收好 |
| [use-event-listener](/cases/composables/use-event-listener) | useEventListener / useRafFn 封装范式 | 进阶 | `组合式函数` `自动清理` `useRafFn` | 把事件监听与逐帧回调封装成函数，挂载时注册、卸载时自动清理，不用每处手写收尾 |
| [use-keyboard-shortcut](/cases/composables/use-keyboard-shortcut) | useKeyboardShortcuts：把快捷键表交给一个监听器 | 进阶 | `组合式函数` `键盘事件` `快捷键` `事件清理` | 按键一张表注册，输入框里自动让路，修饰键必须完全一致 |
| [use-media-query](/cases/composables/use-media-query) | useMediaQuery：断点判断交给浏览器 | 进阶 | `组合式函数` `matchMedia` `断点` `自动清理` | 窗口一拖就重算断点；改用媒体查询的 change 事件，只在跨断点时更新 |
| [use-storage](/cases/composables/use-storage) | useStorage：让 localStorage 变成响应式状态 | 进阶 | `组合式函数` `localStorage` `持久化` `数据校验` | 改状态就自动存；读时校验字段，脏数据回退默认值并修好存储 |

## 工程实践（practice）

| 案例 | 标题 | 难度 | 标签 | 摘要 |
| --- | --- | --- | --- | --- |
| [branch-protection](/cases/practice/branch-protection) | 合并门禁（分支保护 / Ruleset） | 进阶 | `GitHub` `Ruleset` `分支保护` `合并门禁` `持续集成` | 用规则集要求合并请求和自动检查，红灯或直推都进不了 main |
| [chunk-upload](/cases/practice/chunk-upload) | 大文件分片上传 | 高级 | `分片上传` `断点续传` `秒传` `SHA-256` | 先算文件指纹判断秒传，再按 1MB 分片并发上传，暂停后只补没传完的分片 |
| [color-picker](/cases/practice/color-picker) | 取色器 Color Picker | 进阶 | `HSV` `EyeDropper` `Clipboard` | 用两层样式渐变叠出色板，取色后以三种格式复制，并支持屏幕吸管取色 |
| [command-palette](/cases/practice/command-palette) | 命令面板 Command Palette | 进阶 | `fuse.js` `快捷键` `模糊搜索` | Ctrl+K 唤起命令面板，输入即时模糊匹配并高亮命中，全程可用键盘操作 |
| [debounce-throttle](/cases/practice/debounce-throttle) | 防抖节流波形对比 | 入门 | `VueUse` `debounce` `throttle` | 并排对比防抖与节流：脉冲波形显示原始事件与真实执行次数，一行接入现成库 |
| [drag-sort](/cases/practice/drag-sort) | 指针拖拽排序 | 高级 | `Pointer 事件` `FLIP` `WAAPI` `排序` | 指针按下拖动列表项，经过目标位置时让位高亮，松手落位并保留平滑动画 |
| [dynamic-chunk](/cases/practice/dynamic-chunk) | 运行时按需加载 | 进阶 | `动态 import` `代码分割` `按需加载` `模块缓存` | 点开才下载：三个模块按需加载，实测新增字节与耗时 |
| [file-preview](/cases/practice/file-preview) | 多格式文件预览 | 进阶 | `File` `Blob URL` `MIME` `拖拽` | 按文件类型分流到图片、文本、PDF、音视频预览，示例文件全部本地生成 |
| [file-upload](/cases/practice/file-upload) | 文件上传（校验 + 队列） | 进阶 | `上传` `并发队列` `进度` `取消重试` | 上传前校验类型与大小，并发 2 的队列逐个发送，支持单项取消、失败重试与总进度 |
| [history-guard](/cases/practice/history-guard) | History 拦截返回 | 高级 | `history` `popstate` `路由守卫` `beforeunload` | 有未保存内容时拦下返回，弹确认框并记录状态变化，附路由守卫真实方案 |
| [i18n-lazy](/cases/practice/i18n-lazy) | i18n 语言包按需加载 | 进阶 | `i18n` `动态 import` `代码分割` `首屏体积` | 首屏只加载当前语言包，切换语言时按需拉取独立文件，加载过的走内存缓存 |
| [image-compress](/cases/practice/image-compress) | 图片压缩前后对比 | 进阶 | `canvas` `toBlob` `图片处理` | 用画布等比缩放后按质量重新编码，拖动分割线对比压缩前后的体积与画质 |
| [json-viewer](/cases/practice/json-viewer) | JSON 树查看器 | 进阶 | `JSON` `扁平化` `路径复制` | 把 JSON 拍扁成行并靠缩进实现折叠树，不写递归组件，点行可复制数据路径 |
| [keep-alive-lru](/cases/practice/keep-alive-lru) | KeepAlive + LRU 页面缓存 | 高级 | `KeepAlive` `LRU` `onActivated` `页面缓存` | 真实组件缓存：切走再回来输入还在，最多留两个，最久没访问的自动淘汰 |
| [optimistic-update](/cases/practice/optimistic-update) | 乐观更新与回滚 | 进阶 | `乐观更新` `回滚` `点赞` | 点赞先改界面再发请求，失败自动退回并提示，对比等待响应再改 |
| [pdf-preview](/cases/practice/pdf-preview) | PDF 预览 | 进阶 | `PDF.js` `Canvas` `Web Worker` `渲染` | pdf.js 把 PDF 渲染到 canvas，自建翻页缩放工具栏，跨端表现一致 |
| [pinia-store](/cases/practice/pinia-store) | 状态管理：Pinia 范式 + 持久化 | 进阶 | `Pinia` `store` `持久化` `localStorage` | 二十行实现跨组件共享仓库，配合深度侦听做持久化，并附真实 Pinia 写法对照 |
| [request-race](/cases/practice/request-race) | 请求竞态与取消 | 进阶 | `AbortController` `竞态` `搜索` | 快速输入搜索词，对比不取消与取消旧请求：旧响应会不会覆盖新结果 |
| [ripple-button](/cases/practice/ripple-button) | 水波纹按钮 | 入门 | `Web Animations API` `波纹` `交互细节` | 点击位置为圆心扩散水波纹，用浏览器动画接口驱动，结束后自动移除节点 |
| [route-rbac](/cases/practice/route-rbac) | 路由级 RBAC 权限 | 高级 | `路由守卫` `RBAC` `权限` `菜单` | 角色切换后菜单重新计算，越权导航被守卫拦下并重定向，日志还原完整权限流程 |
| [route-transition](/cases/practice/route-transition) | 路由转场动画（方向） | 高级 | `Transition` `路由动画` `前进后退` `历史栈` | 模拟路由栈：前进左滑、后退右滑，动画方向由路由动作决定，栈状态同步可见 |
| [slider-captcha](/cases/practice/slider-captcha) | 滑块验证 | 高级 | `Canvas` `人机验证` `指针拖拽` `轨迹` | 画布随机生成背景与缺口，拖动滑块对齐并判断误差，同时记录耗时与轨迹 |
| [toast-queue](/cases/practice/toast-queue) | Toast 通知队列 | 进阶 | `队列` `animationend` `通知组件` | 屏幕上最多同时三条，超出排队补位，动画结束精确回收，悬停暂停倒计时 |
| [tracking-sdk](/cases/practice/tracking-sdk) | 埋点 SDK（点击 + 曝光） | 高级 | `埋点` `事件委托` `IntersectionObserver` `sendBeacon` | 用事件委托收点击、观察器收曝光并去重，满五条或两秒批量上报，减少请求 |
| [vite-split](/cases/practice/vite-split) | Vite 代码分割 | 进阶 | `Vite` `代码分割` `懒加载` `构建优化` | 勾选懒加载、第三方拆分、按需引入等策略，实时估算首屏体积，附配置要点 |
| [vitest-gate](/cases/practice/vitest-gate) | 测试门禁（CI） | 进阶 | `Vitest` `CI` `类型检查` `体积门禁` | 模拟持续集成依次执行类型检查、代码检查、单测、构建与体积门禁，失败即中断 |
