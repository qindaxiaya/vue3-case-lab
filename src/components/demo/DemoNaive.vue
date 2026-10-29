<!-- ============================================================
     演示区主题上下文：在 CasePage 里包住「演示组件」这一块
     - abstract 模式：不渲染 wrapper div，直接透传默认插槽
     - theme / themeOverrides 复用 useTheme 的 isDark 单例，
       顶栏主题按钮切换 .dark 时演示区控件自动跟随
     - 内层 NMessageProvider 给演示区提供统一提示，
       案例里直接 `const message = useMessage()`（Demo 是 provider 的子组件，
       inject 能拿到上下文），不用再自建 toast
     - provider 放 CasePage 而不是 App.vue：App 是首屏入口，
       barrel import 会把整个 naive-ui 打进首屏包；CasePage 是按需路由
     - themeOverrides 的维护点收敛在 composables/useNaiveTheme.ts 一处
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
      <slot />
    </NMessageProvider>
  </NConfigProvider>
</template>
