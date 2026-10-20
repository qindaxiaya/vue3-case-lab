# watch/watchEffect 三大陷阱

## 1. 现象与场景

watch 一个 reactive 对象，改里面属性回调不触发；快速翻页时慢请求回来覆盖新数据；在 watch 里读 DOM，拿到的还是旧值。

复现：依次点三个陷阱的按钮，观察无 deep 0 次、deep 触发；快速点两次异步请求，完成的是最后一次；输入字符看 sync/pre/post 的 DOM 差异。

## 2. 原理

`watch(reactive)` 默认浅监听，只盯对象引用；改嵌套属性引用没变，不会触发。加 `deep: true` 会递归收集全部嵌套属性，但大对象有遍历开销；只盯某个字段用 getter 更便宜。

`watchEffect` 只收集「本次执行路径上」碰到的依赖，切到未走的分支后新依赖不会被补收。异步竞态用 `onCleanup` 标记过期，旧请求回来直接丢弃。`flush` 决定回调时机：sync 立即（DOM 旧）、pre 渲染前（DOM 旧）、post 渲染后（DOM 新）。

## 3. 关键代码

```ts
// 1. deep 深层监听；精确字段用 getter 更省
watch(state, () => {}, { deep: true })
watch(() => state.nested.count, (v) => console.log(v))

// 2. 异步竞态：新触发先 cleanup，旧结果丢弃
watch(page, async (p, _old, onCleanup) => {
  let stale = false
  onCleanup(() => { stale = true })
  const data = await fetchData(p)
  if (stale) return
  list.value = data
})

// 3. 读 DOM 用 flush: 'post'
watch(text, () => console.log(el.value?.textContent), { flush: 'post' })
```

## 4. 数据对比

| 陷阱 | 错误表现 | 正确做法 |
|---|---|---|
| deep | 改嵌套 0 次触发 | `deep: true` 或 getter |
| 竞态 | 慢请求覆盖新数据 | `onCleanup` + `stale` |
| flush | sync/pre 读到旧 DOM | `flush: 'post'` |
| watchEffect 分支 | 新分支依赖不收集 | 用 watch + getter 显式声明 |

测量方式：Chrome headless 1200×900 点「nested.count++」，读取「无 deep 0 次 / deep 1 次」；点两次异步请求观察完成编号；输入字符对比三个 DOM 值。计数来自 Demo 面板。

## 5. 追问与边界

**Q：`watch(reactive)` 为什么默认不深？**
深层递归收集开销大；Vue 选择默认浅监听，需要时显式 `deep`。`watch(ref)` 监听 `.value`，替换才触发。

**Q：`deep: true` 有什么代价？**
大对象每次都要遍历收集依赖，频繁变化时开销明显；优先用 getter 精确监听。

**Q：`flush: 'sync'` 什么时候用？**
极少用。需要同步拿到变更结果时（如测量、第三方同步 API），但要小心性能与重入。

坑：`watchEffect` 里条件分支切换，旧依赖可能残留/新依赖漏收；复杂依赖用 `watch` 显式声明。边界：组件卸载时 watch 自动停止；手动创建的 watch 在 scope 外要自己 stop。
