<!-- ============================================================
     演示区共享的 Naive UI 主题上下文（站点壳不用它）
     - abstract 模式：不渲染 wrapper div，直接透传默认插槽
     - theme / themeOverrides 复用 useTheme 的 isDark 单例，
       顶栏主题按钮切换 .dark 时演示区控件自动跟随
     - 内层 NMessageProvider 给演示区提供统一的提示（message），
       案例里通过 composables/useDemoMessage.ts 的 demoMessage 调用
     - 放在共享组件而不是每个 Demo 内部直接写 provider，是为了把
       themeOverrides 的镜像维护点收敛到 composables/useNaiveTheme.ts 一处
     ============================================================ -->
<script setup lang="ts">
import { useNaiveTheme } from '../../composables/useNaiveTheme'

const { theme, themeOverrides } = useNaiveTheme()
</script>

<template>
  <NConfigProvider
    :theme="theme"
    :theme-overrides="themeOverrides"
    abstract
  >
    <!-- 提示统一用 Naive 的 message（顶部居中、最多 3 条、2.4s 自动消失）。
         容器由 provider Teleport 到 body，不进演示区文档流，不会推挤布局 -->
    <NMessageProvider
      placement="top"
      :max="3"
      :duration="2400"
    >
      <!-- 把 message api 注册到模块级，案例 Demo 才能调用 -->
      <DemoMessageBridge />
      <slot />
    </NMessageProvider>
  </NConfigProvider>
</template>
