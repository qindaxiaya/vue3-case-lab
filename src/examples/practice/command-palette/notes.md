# 命令面板 Command Palette

## 1. 现象与场景

想做一个 Ctrl+K 命令面板，结果快捷键被 Chrome 抢去聚焦地址栏；列表能搜但不会模糊匹配，输入错一个字母就空。

复现：按 Ctrl+K（Mac 为 Cmd+K）打开面板，输入 `copy` 或 `顶部`，观察命中项与高亮；用 ↑/↓ 选择、Enter 执行、Esc 关闭。

## 2. 原理

命令面板 = 命令数据 + 模糊搜索 + 键盘导航。搜索用 fuse.js 建索引，`keys` 给字段权重，`threshold` 控制容错程度，`includeMatches` 返回命中区间用于高亮。

快捷键必须在**捕获阶段**监听并 `preventDefault`，否则浏览器先处理 Ctrl+K。面板打开后要接管 ↑/↓/Enter/Esc，并阻止方向键滚动页面；打开后等 `nextTick` 再聚焦输入框。

## 3. 关键代码

```ts
const fuse = new Fuse(commands, {
  // 1. 主字段权重最高，分组/提示只做弱召回
  keys: [
    { name: 'label', weight: 0.7 },
    { name: 'group', weight: 0.2 },
    { name: 'hint', weight: 0.1 },
  ],
  threshold: 0.4,
  includeMatches: true,
  ignoreLocation: true,
})

function onKeydown(e: KeyboardEvent): void {
  // 2. 捕获阶段 + preventDefault，才拦得住浏览器快捷键
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    open.value = !open.value
    return
  }
  if (!open.value) return
  if (e.key === 'ArrowDown') {
    // 3. 阻止默认滚动，并把选中项循环到下一项
    e.preventDefault()
    selected.value = (selected.value + 1) % results.value.length
  }
}
window.addEventListener('keydown', onKeydown, true)
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 索引字段 | 3 个（label / group / hint） |
| 模糊阈值 | 0.4（有容错、不噪声） |
| 打开快捷键 | Ctrl/Cmd + K |
| 导航键 | ↑ / ↓ / Enter / Esc |
| 输入后重建 | 0 个新 Fuse 实例（索引复用） |

测量方式：Chrome headless 1200×900 打开案例，按快捷键与输入关键词观察面板与命中项；配置值来自代码区。搜索延迟在几十条命令规模下低于一帧，无需防抖。

## 5. 追问与边界

**Q：为什么搜索不用 `includes`？**
`includes` 只能连续子串匹配，输错一个字母就失败；fuse.js 支持字符跳匹配与权重排序，更像「命令面板」的手感。

**Q：命令很多时性能怎么办？**
索引只建一次，搜索是纯计算；上千条仍可接受。若上万条，考虑分组懒加载或 Web Worker。

**Q：要支持中文拼音吗？**
fuse.js 不内置拼音；需要给命令补拼音字段（如 `pinyin: 'dingbu'`）并降低权重，或换支持拼音的搜索库。

坑：监听没加 `true`，Ctrl+K 永远打不开；`nextTick` 前 focus 拿到 null。边界：面板内不要放需要复杂焦点的表单，焦点陷阱会打架；无障碍要配 `role="listbox"` 与 `aria-activedescendant`。
