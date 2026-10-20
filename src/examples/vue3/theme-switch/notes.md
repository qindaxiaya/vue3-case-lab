# 主题切换无闪烁

## 1. 现象与场景

暗色模式上线后，用户每次刷新都先白一下再变黑，夜里特别刺眼；切到「跟随系统」后，系统改主题页面不跟着变。

复现：切换亮色/暗色/跟随系统，刷新页面观察首帧；系统偏好变化时，auto 模式实时跟随。

## 2. 原理

闪白是因为 JS 在页面渲染之后才读 localStorage、加 `.dark` 类，那一瞬间浏览器已经按亮色画完。把判断写进 `<head>` 的内联脚本，在首次绘制前就加好类，才能不闪。

三态模型：`light` / `dark` / `auto`。`auto` 只是别名，最终生效值要收敛成 light 或 dark；持久化只存三态原始值，不要存解析后的值，否则系统偏好变化会失效。

## 3. 关键代码

```ts
type Mode = 'light' | 'dark' | 'auto'
const mode = ref<Mode>('auto')
const systemDark = ref(matchMedia('(prefers-color-scheme: dark)').matches)

// 1. auto 解析成最终生效值
const resolved = computed(() =>
  mode.value === 'auto' ? (systemDark.value ? 'dark' : 'light') : mode.value,
)

// 2. 系统主题变化时实时跟随
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  systemDark.value = e.matches
})

// 3. 所有颜色走 CSS 变量，只切 html.dark
watchEffect(() => {
  document.documentElement.classList.toggle('dark', resolved.value === 'dark')
})
```

```html
<!-- head 内、样式之前，阻塞执行 -->
<script>
  const saved = localStorage.getItem('moyu-theme')
  const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', dark)
</script>
```

## 4. 数据对比

| 指标 | 无内联脚本 | 内联脚本 |
|---|---|---|
| 首帧颜色 | 先亮后暗（闪白） | 直接正确 |
| 持久化键 | — | `moyu-theme` |
| 主题模式 | 亮/暗 | 亮/暗/跟随系统 |
| 系统变化 | 不跟随 | auto 实时跟随 |
| 切换次数 | — | 0 起步，每次 +1 |

测量方式：Chrome headless 1200×900 切换三种模式并刷新，观察首帧与 `html.class`；系统偏好用 CDP 模拟。切换次数来自 Demo 面板；闪白属视觉指标，未做帧级采样。

## 5. 追问与边界

**Q：为什么不在 Vue 挂载后加类？**
Vue 挂载发生在首帧之后，那时页面已经按亮色画完，必然闪一下。

**Q：localStorage 被禁用怎么办？**
隐私模式下可能抛异常，读写都要 try/catch，失败时退回 `matchMedia`。

**Q：暗色只要换变量就够吗？**
不够。图片、阴影、描边、图表颜色常需单独调；纯变量替换会出现「刺眼的白图」。

坑：持久化存了 `resolved`（light/dark），用户选「跟随系统」就丢了。边界：SSR 要服务端读 cookie 或用 `useHead` 注入脚本；记得同步 `<meta name="theme-color">`。
