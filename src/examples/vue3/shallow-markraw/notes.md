# shallowRef / markRaw 性能边界

## 1. 现象与场景

一万条数据的表格，用 `reactive` 包起来后初始化慢、内存高；听说 `shallowRef` 能优化，用了却发现改嵌套数据页面不更新。

复现：对比三档代理的触发计数：改嵌套 `.v`，reactive 触发、shallowRef 不触发、markRaw 永不触发；替换 `.value` 才触发。

## 2. 原理

`reactive` 递归代理每个嵌套属性，数据越大初始化与内存开销越大。`shallowRef` 只代理 `.value` 这一层，内部对象完全不动，所以改嵌套属性不会触发更新；替换 `.value` 或手动 `triggerRef` 才会。

`markRaw` 让对象永久豁免响应式，即使嵌进 `ref` 也不代理；适合 class 实例、图表实例、第三方对象。`triggerRef` 是逃生舱，不是常规手段。

## 3. 关键代码

```ts
// 1. 深代理：精确触发，但 1000 项全量代理开销最大
const deep = reactive(makeBig())
deep.list[0].nested.v++ // 触发

// 2. 浅代理：只盯 .value 替换，改嵌套不触发
const shallow = shallowRef(makeBig())
shallow.value.list[0].nested.v++ // 不触发
shallow.value = makeBig() // 触发

// 3. 永不代理：适合 class / ECharts 实例
const raw = ref(markRaw(makeBig()))
raw.value.list[0].nested.v++ // 永不触发

// 嵌套改了但必须通知视图：手动 triggerRef
triggerRef(shallow)
```

## 4. 数据对比

| 指标 | reactive（深） | shallowRef | markRaw |
|---|---|---|---|
| 代理层级 | 递归全部属性 | 仅 `.value` | 不代理 |
| 示例数据量 | 1000 项 | 1000 项 | 1000 项 |
| 改嵌套 `.v` | 触发 | 不触发 | 不触发 |
| 替换 `.value` | 触发 | 触发 | 触发（ref 层） |
| 适用 | 小数据、精确更新 | 大列表、整体替换 | 第三方实例 |

测量方式：Chrome headless 1200×900 分别点三组「改嵌套 / 替换 .value」，读取触发计数；1000 项数据来自 Demo。初始化耗时未做定量采样，结论看代理层级与触发行为。

## 5. 追问与边界

**Q：shallowRef 改嵌套为什么没反应？**
内部对象没有被代理，Vue 收集不到嵌套属性的依赖；必须替换 `.value` 或 `triggerRef`。

**Q：triggerRef 能随便用吗？**
不建议。它绕过依赖追踪，容易漏更新；能整体替换就替换。

**Q：markRaw 后还能改吗？**
能改，但永远不会触发视图更新；只适合「模板用得到、但不需要响应式」的对象。

坑：把 markRaw 对象放进 `reactive` 后再想恢复响应式，需要重新包裹。边界：大数据且只整体替换用 shallowRef；需要细粒度更新的列表仍用 reactive/ref。
