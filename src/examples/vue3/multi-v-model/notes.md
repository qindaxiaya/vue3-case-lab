# 多 v-model 参数与修饰符

## 1. 现象与场景

一个表单组件要同时编辑标题、姓名、是否显示；props 一堆、emit 一堆，父级还要配三个 update 处理函数，改个字段名要动两处。

复现：在标题/名称输入框打字，父级三个值实时更新；名称输入前后空格，父级收到的是 trim 后的值。

## 2. 原理

Vue 3 支持多个 v-model：父级写 `v-model:title`，子组件用 `defineModel('title')` 接，名字严格一致。不写参数时默认仍是 `modelValue`。

`defineModel` 的 `set` 选项可以在写入前转换，等价于把 `.trim` 收进子组件。父级加的修饰符（`.trim`、`.lazy`）通过第二个返回值读取，子组件主动处理才生效。

## 3. 关键代码

```ts
// 1. 三个模型各自对应一个 v-model:key
const title = defineModel<string>('title', { default: '' })
const visible = defineModel<boolean>('visible', { default: false })

// 2. set 在写入前转换，父级拿到 trim 后的值
const name = defineModel<string>('name', {
  default: '',
  set: (value) => value.trim(),
})

// 3. 读取修饰符：const [model, mods] = defineModel('title')
// set: (v) => mods.trim ? v.trim() : v
```

```vue
<!-- 父组件：一个组件挂三个 v-model -->
<MultiModelForm v-model:title="title" v-model:name="name" v-model:visible="visible" />
```

## 4. 数据对比

| 指标 | 旧 props/emit | 多 v-model |
|---|---|---|
| 模型数量 | 3 | 3 |
| 子组件声明 | 3 组 props + emits | 3 行 defineModel |
| 父级处理函数 | 3 个 @update | 0 |
| trim 实现 | 父级或子组件手动 | `set` 内一行 |
| 默认模型名 | modelValue | modelValue（不变） |

测量方式：Chrome headless 1200×900 在两个输入框输入，读取父级 `title` / `name` 值；名称带前后空格时观察是否被 trim。模型数与默认值来自 Demo。

## 5. 追问与边界

**Q：名字写错会怎样？**
父级 `v-model:title` 与子组件 `defineModel('title')` 必须完全一致（大小写敏感），否则收不到更新。

**Q：布尔模型能配 `.trim` 吗？**
不能，没有意义；`.lazy` 可减少输入时的同步次数。

**Q：多个模型会触发多次渲染吗？**
Vue 会批量更新，但对象型模型频繁变化仍可能多次；复杂表单可合并成一个对象模型。

坑：用 `v-model` 直接绑定 props 会报错，必须走 `defineModel` 或 emit。边界：`defineModel` 需要 Vue 3.4+；旧项目升级只需改子组件内部，父级用法不变。
