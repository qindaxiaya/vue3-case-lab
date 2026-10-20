# computed 缓存 vs 方法 vs watch

## 1. 现象与场景

模板里写 `{{ total() }}`，输入框一敲字、主题一变，方法就重算；数据量大时明显卡顿，你以为 Vue 会帮你缓存。

复现：点「改无关状态 noise++」，渲染次数 +1、方法调用 +1，而 computed 与 watch 计数不动。

## 2. 原理

`computed` 是惰性求值 + 依赖缓存：第一次读取才计算，之后依赖不变直接返回缓存值。Vue 会精确收集它用到的响应式属性，只有这些属性变化才失效。

模板里调用方法没有缓存，组件每次重新渲染都会执行一次——即使方法依赖的数据没变。`watch` 不产生值，只在依赖变化时执行副作用，适合请求、日志、写 localStorage。

## 3. 关键代码

```ts
const price = ref(120)
const qty = ref(2)
const noise = ref(0) // 无关状态

// 1. 依赖不变就吃缓存；noise 变化不会让它重算
const total = computed(() => price.value * qty.value)

// 2. 模板里调方法：每次渲染都执行
function methodTotal(): number {
  return price.value * qty.value
}

// 3. 副作用放 watch，不要塞进 computed
watch([price, qty], () => {
  console.log('价格或数量变了')
})
```

## 4. 数据对比

| 操作 | 渲染次数 | computed 求值 | 方法调用 | watch |
|---|---|---|---|---|
| 初始 | 1 | 1 | 1 | 0 |
| 改无关 noise++ | +1 | 0 | +1 | 0 |
| 改相关 price += 10 | +1 | +1 | +1 | +1 |

测量方式：Chrome headless 1200×900 打开案例，读取「computed 240 / 求值 1 次」「方法 240 / 调用 1 次」；分别点两个按钮后观察计数。计数值由 Demo 在求值/调用时累加。

## 5. 追问与边界

**Q：computed 里有异步请求行吗？**
不行。computed 应该是纯计算，不能改状态或发请求；异步副作用放 watch 或事件处理。

**Q：为什么方法调用数约等于渲染次数？**
模板每次渲染都会重新执行方法；Vue 不会按方法内部依赖做缓存。

**Q：什么时候可以用方法？**
轻量计算、小列表，或需要每次拿最新值（时间、随机数）。大列表/昂贵计算优先 computed。

坑：computed 依赖里读了普通变量（非响应式），变量变了不会重算。边界：computed 的缓存是「按依赖」而非「按时间」，依赖频繁变化时缓存收益会下降。
