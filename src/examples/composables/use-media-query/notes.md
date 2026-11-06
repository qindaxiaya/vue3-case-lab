# useMediaQuery：断点判断交给浏览器

> 旧写法在 resize 里自己读宽度、比断点；新写法订阅媒体查询，只在结果翻转时收到通知。

## 1. 现象 / 场景

页面里到处是 `window.innerWidth < 768`：用户拖动窗口时，断点判定跟着鼠标来回跳；同一段逻辑在三个组件里各写了一遍，其中一处忘了 `removeEventListener`，切走页面后回调还在改已经卸载的组件状态。

复现步骤：

1. 打开案例，把浏览器窗口从宽拖到窄，再拖回去；
2. 看左边「手写 resize + innerWidth」的计数——窗口动一下它就加一次，断点比较是回调的两倍；
3. 点「模拟拖窗 30 次」：宽度没变，手写版却把 30 次 resize 全算了一遍，右边一次都没响。

## 2. 原理

拖动窗口时浏览器会连续派发 `resize` 事件，一次拖动就是几十次。手写版每收到一次就重读 `innerWidth`、重新比较两档阈值，即使这一像素的移动根本没跨过断点。

`matchMedia(query)` 返回一个媒体查询列表对象，浏览器在样式计算阶段就把它求值好；只有当匹配结果从 true 变 false（或反过来）时才派发 `change`。所以页面侧收到的是「结论变了」而不是「窗口动了」。

媒体查询的判定宽度不含经典滚动条，而 `innerWidth` 含。窗口宽度正好卡在断点上时，两套写法会判出不同的档位——这不是谁算错了，是两边量的盒子不一样。

组合式函数负责三件事：同步初始值（否则首帧先按 false 渲染，桌面端会闪一下移动布局）、订阅 `change`、在作用域结束时解绑。用 `onScopeDispose` 而不是 `onUnmounted`，组件卸载和 `effectScope.stop()` 都能走到清理逻辑。

## 3. 方案：关键代码

```ts
import { onScopeDispose, ref } from 'vue'
import type { Ref } from 'vue'

export function useMediaQuery(query: string, onFlip?: (matches: boolean) => void): Ref<boolean> {
  const matches = ref(false)
  // 构建期 / 服务端渲染没有 window，直接返回恒 false
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return matches

  const mql = window.matchMedia(query)
  matches.value = mql.matches // 初始值同步给，避免首帧闪错布局

  const handleChange = (event: MediaQueryListEvent): void => {
    matches.value = event.matches
    onFlip?.(event.matches)
  }
  mql.addEventListener('change', handleChange)

  // 作用域结束自动解绑：调用方不用记「我注册过一条查询」
  onScopeDispose(() => mql.removeEventListener('change', handleChange))
  return matches
}
```

三处为什么：

1. **环境判断放在最前面**：`window.matchMedia` 在构建期是 undefined，先返回再订阅，模块才不会在导入阶段抛错。
2. **初始值同步赋值**：只监听 `change` 不给初始值，首帧渲染时 `matches` 还是 false，桌面宽度下会先闪一帧移动端布局。
3. **清理用 `onScopeDispose`**：它不只在组件卸载时触发，`effectScope.stop()` 也会走到；把「注册了就一定解绑」写进封装，比让每个调用方记得更可靠。

## 4. 数据对比

| 指标 | 手写 resize + innerWidth | useMediaQuery | 测量方式 |
|------|--------------------------|---------------|----------|
| 模拟一次拖窗后的回调次数 | 30 | 0 | 点「模拟拖窗 30 次」（连发 30 个真实 resize、宽度不变），读面板计数 |
| 同上的断点比较次数 | 60 | 0 | 同上；封装版把比较交给浏览器内部，页面侧为 0 |
| 跨两档断点（1400 → 700） | 1 次 resize 回调 | 2 次 change 回调 | CDP 改视口宽度一次跳变；两条查询各翻转一次 |
| 跨回原宽度（700 → 1400） | 1 次 resize 回调 | 2 次 change 回调 | 同上 |
| 活跃监听器 | 1 个 resize | 2 个 change | 面板「活跃监听器 3 个」，离开页面后归零 |

测量说明：

- 环境：headless Chrome（`npm run check:ui -- --only 媒体查询`），起始视口 1400 × 900，通过 CDP 修改宽度。
- 设备模拟的宽度跳变只发一次 `resize`，所以第三、四行手写版是 1 次；真实用鼠标拖动时浏览器会连发几十次，差异看第一行。
- 无头模式下滚动条是叠加式，`innerWidth` 与 `clientWidth` 都是 1400；真实桌面浏览器两者会差十几像素（见第 5 段踩坑 3）。
- 本案例的收益是「回调次数」，不是渲染耗时，因此没有比较毫秒数。

## 5. 追问与边界（面试高频）

**Q：布局都用 CSS 媒体查询了，还需要这个封装吗？**
需要的地方在 JS：断点决定换数据源、换组件、换图表配置时，样式帮不上忙，只能靠 JS 拿到这个布尔值。

**Q：为什么不 `watch` 一个存着 `innerWidth` 的 ref？**
那还是得先挂 `resize` 监听，等于绕回旧写法；差别只在「谁来比较断点」，绕一圈没省任何回调。

**Q：`matchMedia` 的回调会不会漏掉？**
浏览器保证匹配状态翻转时派发；页面切到后台时 `resize` 可能被节流，而媒体查询结果本身是跟着视口的，回到前台会按当前状态给出正确值。

**Q：服务端渲染怎么办？**
封装里返回恒 false，客户端挂载后立刻同步；要 SSR 首屏就正确，只能靠 CSS 媒体查询或读请求头，别指望 JS 在服务端知道视口宽度。

踩坑：

1. **只监听 change、不给初始值** → 首帧按 false 渲染，桌面端闪一下移动布局 → 挂载时先 `matches.value = mql.matches`。
2. **忘记解绑 matchMedia 监听** → 组件卸载后回调还在改旧状态，看着不报错但一直泄漏 → 用 `onScopeDispose` 统一收口。
3. **拿 `innerWidth` 和媒体查询比** → 窗口宽度正好在断点上时，一个含滚动条、一个不含，判出来差一档 → 面板在两者不一致时给出提示；要显示宽度就用 `documentElement.clientWidth`。

边界：媒体查询只跟视口走，元素被放进窄容器里它不会变——那种场景要用容器查询（见 `css/container-query`）。需要精确像素值做计算时仍然要读宽度，但读取应该放进 `ResizeObserver`，而不是 `resize` 回调。
