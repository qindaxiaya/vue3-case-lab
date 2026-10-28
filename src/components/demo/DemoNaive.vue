<!-- ============================================================
     演示区共享的 Naive UI 主题上下文（与 DemoToastStack 同类例外：
     仅服务于演示区 UI，站点壳不用它）
     - abstract 模式：不渲染 wrapper div，直接透传默认插槽
     - theme / themeOverrides 复用 useTheme 的 isDark 单例，
       顶栏主题按钮切换 .dark 时演示区控件自动跟随
     - 放在共享组件而不是 Demo 内部直接写 provider，是为了把
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
    <slot />
  </NConfigProvider>
</template>
