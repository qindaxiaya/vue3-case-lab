# 响应式依赖注入

## 1. 现象与场景

主题色要从顶层传到第五层，props 一层层传太丑；换成 provide/inject 后，子组件改了值，顶层没反应。

复现：底层点「切换主题」，顶层实时主题立即变；写 readonly / computed 只读值，开发模式出现警告且不生效。

## 2. 原理

`inject` 默认传的是「值」而不是引用。想共享响应式，必须把 ref 本体传下去：底层 `theme.value = 'dark'`，顶层读同一个 ref，自然同步。

key 用 `Symbol` 避免与组件库/业务的字符串 key 撞车；`InjectionKey<T>` 提供类型。只读边界有两种：`computed` 只有 getter，赋值静默无效；`readonly` 包装后在开发模式写入会警告，更友好。

## 3. 关键代码

```ts
// 1. Symbol key 防撞车，InjectionKey 提供类型
const THEME_KEY: InjectionKey<Ref<string>> = Symbol('theme')
const USER_KEY: InjectionKey<Readonly<{ name: string }>> = Symbol('user')

// 2. provide ref 本体，底层修改顶层同步
const theme = ref('light')
provide(THEME_KEY, theme)

// 3. 只读边界：computed 无 setter，readonly 写入警告
provide('maxCount', computed(() => 10))
provide(USER_KEY, readonly({ name: 'admin' }))

// 任意深层 inject，默认值兜底
const theme = inject(THEME_KEY, ref('auto'))
```

## 4. 数据对比

| 指标 | 字符串 key + 普通值 | Symbol + ref 本体 |
|---|---|---|
| 跨层同步 | 不响应 | 实时 |
| key 冲突 | 可能 | 不会 |
| 类型提示 | 无 | `InjectionKey` |
| 只读边界 | 无 | computed / readonly |
| 层级 | 3 层（Parent/Child/GrandChild） | 3 层 |

测量方式：Chrome headless 1200×900 在 GrandChild 点「切换主题」，读取 Parent「实时主题」；点两个只读写入按钮，观察值是否变化与警告。日志来自 Demo。

## 5. 追问与边界

**Q：为什么子组件改值顶层没反应？**
provide 传的是普通值（如 `theme.value`）或解构后的字符串，响应式连接已断；传 ref 本体。

**Q：provide 能放在异步回调里吗？**
不能。必须在 setup 同步阶段执行，否则子组件 inject 时已经错过。

**Q：provide/inject 能替代 Pinia 吗？**
它是「组件树内跨层传参」，不是全局状态库；需要跨路由、跨树共享时用 Pinia。

坑：`const { theme } = inject(...)` 解构后丢响应式。边界：组件库底层（表单校验、弹窗队列）适合 provide/inject；深层传参也可考虑 `useContext` 封装。
