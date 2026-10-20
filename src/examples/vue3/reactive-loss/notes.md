# 响应式丢失的 5 个现场

## 1. 现象与场景

接口返回用户信息，解构出 `name` 放到页面；刷新接口后数据变了，页面还是旧名字。你以为是接口没更新，其实是页面没「跟着变」。

复现：在 5 个场景里点「源数据 +1」，对比「界面 / 真实」两个数字；错误写法界面不动，修法正常更新。

## 2. 原理

Vue 3 的响应式靠 Proxy：只有通过原对象取值，Vue 才知道「有人用了这个属性」。解构、浅拷贝、整体重新赋值都会把值从 Proxy 上「摘下来」，变成普通快照。

正确做法是保留引用：`toRef`/`toRefs` 建立连接、`Object.assign` 原地合并、`ref` 整体替换 `.value`、解构 props 用 `toRef` 或 Vue 3.5 的解构语法糖。Vue 3 已修复数组下标与新增属性的老坑。

## 3. 关键代码

```ts
const state = reactive({ count: 0 })

// 1. 错误：解构拿到的是当时的数字，与响应式断开
const { count } = state
// 正确：toRef 建立连接，countRef.value 跟着走
const countRef = toRef(state, 'count')

// 2. 错误：变量被换成裸对象，旧 Proxy 的依赖永远等不到更新
let form = reactive({ name: 'a' })
form = { name: 'b' }
// 正确：原地改，保持同一个 Proxy
Object.assign(form, { name: 'b' })

// 3. 解构 props 用 toRef；Vue 3.5+ 解构语法糖自动 toRef
// const msg = toRef(props, 'msg')
```

## 4. 数据对比

| 场景 | 错误写法 | 界面 | 修法 |
|---|---|---|---|
| 解构 reactive | `const { count } = state` | 停 0 | `toRef` |
| 整体重新赋值 | `form = { ... }` | 不更新 | `Object.assign` |
| 浅拷贝 | `{ ...state }` | 快照 | 直接读源 |
| 解构 props | `const { msg } = props` | 首帧值 | `toRef` |
| 数组下标 | Vue 2 需 `Vue.set` | — | Vue 3 已支持 |

测量方式：Chrome headless 1200×900 每个场景点一次「源数据 +1」，读取「界面 / 真实」数字；前 4 个场景错误写法界面保持不变，切换修法后同步。第 5 个是 Vue 3 已修复的对照项。

## 5. 追问与边界

**Q：为什么解构后会丢？**
解构读的是属性值（字符串/数字），不是 Proxy 引用；后续源对象变化与这个值无关。

**Q：`toRefs` 和 `toRef` 怎么选？**
解构整个对象用 `toRefs`，只取一个属性用 `toRef`；两者都保持连接。

**Q：深拷贝后还能响应吗？**
不能。`structuredClone`/JSON 拷贝得到普通对象；需要响应式就重新 `reactive`/`ref` 包裹。

坑：把 `reactive` 对象整体赋给另一个变量再改，原对象不会变。边界：跨组件共享状态别用普通对象传参，用 provide/inject 或 Pinia；排查时打印 `__v_isReactive`。
