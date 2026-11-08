# StepForm：分步表单别一次问完

## 1. 现象 / 场景

后台的新建流程字段很多，一次全铺出来像考试卷。用户填到一半点下一步，才发现前面某个字段错了，又得滚回去找；如果只在最后统一校验，错误和字段离得太远，改起来很费劲。

复现步骤：

1. 打开案例，停在第 1 步「基本信息」。
2. 什么都不填直接点下一步，页面仍停在第 1 步，姓名和邮箱下方各出现一条错误。
3. 姓名填「张三」、邮箱填 `zhang`，点下一步，只剩邮箱一条错误。
4. 邮箱改成 `zhang@example.com`，点下一步进入第 2 步；选专业版、10 人后进入第 3 步。
5. 点提交，等待约 500ms 后显示「已提交」，提交次数变成 1。

## 2. 原理

分步表单的核心不是「把字段分页」，而是把校验也分步骤：当前步骤只校验当前字段，通过后才允许进入下一步。这样错误就在用户刚填过的字段旁边，不用最后统一找。

但分步校验不能替代提交校验。用户可以用浏览器后退、脚本调用、或者改 DOM 绕过按钮禁用，所以提交前还要再校验一次第一步；失败时把用户带回对应步骤，而不是直接提交。

上一步要保留已填内容，否则用户改一个字段要重新填整页。步骤状态和表单数据分开存：步骤只决定显示哪一块，数据始终在同一个 form 对象里。

## 3. 方案：关键代码

```ts
//! 只校验当前步骤，不提前暴露后面步骤的错误
function validateStep1(): boolean {
  const next: { name?: string; email?: string } = {}
  if (form.name.trim().length < 2) next.name = '姓名至少 2 个字'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = '邮箱格式不对'
  errors.value = next
  return Object.keys(next).length === 0
}

//! 下一步通过校验才前进；上一步保留已填内容
function next(): void {
  if (submitted.value) return
  if (step.value === 1 && !validateStep1()) return
  if (step.value < 3) step.value++
}

//! 提交前再校验一次，防止用户绕过按钮状态
function submit(): void {
  if (loading.value || submitted.value) return
  if (!validateStep1()) {
    step.value = 1
    return
  }
  loading.value = true
  submitTimer = window.setTimeout(() => {
    loading.value = false
    submitted.value = true
    submitCount.value++
  }, 500)
}
```

三处关键选择：

1. `validateStep1()` 只负责第 1 步，后面步骤以后可以各自加校验函数，不会互相牵连。
2. `step` 只控制显示哪一块，`form` 始终是同一份数据；上一步不需要复制状态。
3. `submit()` 先判断 loading 和 submitted，再重新校验，避免重复提交和绕过按钮。

## 4. 数据对比

| 操作 | 当前步骤 | 校验错误 | 提交次数 | 测量方式 |
| --- | --- | --- | --- | --- |
| 初始 | 1 / 3 | 0 | 0 | 页面 data-stat 读数 |
| 空表单点下一步 | 1 / 3 | 2 | 0 | 同上 |
| 姓名合法、邮箱非法 | 1 / 3 | 1 | 0 | 同上 |
| 修正后连续下一步 | 3 / 3 | 0 | 0 | 同上 |
| 点提交 | 3 / 3 | 0 | 1 | 提交延迟固定 500ms |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/step-form`。
- 取样：`npm run check:ui -- --only 分步表单` 的常驻场景，同一页面顺序执行。
- 500ms 是 Demo 固定延迟，用来展示提交 loading；不是接口性能结论。

## 5. 追问与边界（面试高频）

- Q: 为什么不一次校验全部字段？ → A: 错误离当前字段太远，用户要来回找；分步校验把错误放在刚操作的地方。
- Q: 上一步需要重新请求数据吗？ → A: 不需要，表单数据一直在同一个对象里；除非某一步依赖服务端最新值。
- Q: 提交前还要校验吗？ → A: 要。按钮禁用只是 UI 约束，浏览器后退、脚本、改 DOM 都能绕过。

踩坑（≤3 条）：

1. 只校验最后一步：用户在第 1 步填错也能进第 3 步，提交时才被拦下 → 每一步都要校验当前字段。
2. 上一步重置表单：用户改一个字段要重填整页 → 步骤状态和数据分开，切步骤不碰 form。
3. 提交只靠按钮 disabled：脚本调用 submit 仍能发请求 → 函数开头再判断 loading / submitted / 校验。

边界：本例不展开「草稿保存到服务端」「步骤回退时重新拉取依赖数据」；真实项目可以把每步草稿写进 sessionStorage 或后端，刷新后恢复步骤。
