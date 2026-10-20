# defineModel 组件双向绑定

## 1. 现象与场景

写一个输入组件，`defineProps` + `defineEmits` + 手动 `:value` + `@input` 四段代码；多个 v-model 字段时，每加一个都要重复一遍。

复现：在旧写法/defineModel 两个输入框打字，父级值实时同步；点「父组件改写两个值」，子输入框同步回填。

## 2. 原理

`defineModel()` 是语法糖，展开后等价于：声明 `modelValue` prop、声明 `update:modelValue` 事件、创建一个可写 `computed`（get 读 prop，set 触发 emit）。所以父组件用法完全不变，旧项目只需把子组件内部收窄。

默认模型名是 `modelValue`；`defineModel('title')` 对应父级 `v-model:title`。本地写入是「先改本地 ref，再 emit」，父级不响应时会回弹（受控组件语义）。需要本地临时状态时用 `{ local: true }`。

## 3. 关键代码

```vue
<script setup lang="ts">
// 1. 一行完成 prop、emit、可写 ref
const model = defineModel<string>({ default: '' })

// 2. 自定义模型名：父级写 v-model:title
const title = defineModel<string>('title', { default: '' })

// 3. 写入前转换（等价于把 .trim 收进子组件）
const name = defineModel<string>('name', {
  default: '',
  set: (value) => value.trim(),
})
</script>

<template>
  <!-- 直接 v-model 绑定，无需手动 emit -->
  <input v-model="model">
</template>
```

## 4. 数据对比

| 指标 | 旧写法 | defineModel |
|---|---|---|
| 子组件代码 | props + emits + 取值 + emit | 1 行 |
| 父组件用法 | `v-model` | `v-model`（不变） |
| 多模型 | 每个字段重复 4 段 | 每个字段 1 行 |
| 本地写入 | 手动 emit | 自动 emit |
| Vue 版本 | 3.x | 3.4+ |

测量方式：Chrome headless 1200×900 在旧写法/defineModel 输入框分别输入，读取父级值；点「父组件改写两个值」观察子输入框回填。代码行数为两种实现的对照。

## 5. 追问与边界

**Q：旧项目升级要改父组件吗？**
不用。`defineModel()` 默认仍对应 `modelValue` / `update:modelValue`，只改子组件内部。

**Q：为什么输入后父级没变？**
父级没写 `v-model`，或写成了普通 prop；没有 update 监听时子组件写入会回弹。

**Q：需要「输入中不同步，失焦才同步」怎么办？**
用 `{ local: true }` 保持本地状态，在 blur 时再提交；或不用 defineModel，显式管理本地 ref。

坑：`v-model:title` 与 `defineModel('title')` 名字必须严格一致，大小写敏感。边界：布尔模型别配 `.trim`；多个模型更新会触发父级多次渲染，复杂表单可考虑合并成一个对象模型。
