<!-- ============================================================
     把 Naive 的 message api 注册到模块级，供案例 Demo 调用
     （Demo 在 provider 外层，自己 setup 里 inject 不到上下文；
     详见 composables/useDemoMessage.ts 的说明）
     纯逻辑组件：只输出一个空注释节点，避免「缺少 template / render」告警
     ============================================================ -->
<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { onUnmounted } from 'vue'
import { setDemoMessageApi } from '../../composables/useDemoMessage'

const message = useMessage()

// 挂载即注册（此时 provider 已就绪）
setDemoMessageApi(message)

// 演示卸载时清空，避免 demoMessage 还指向已销毁的 provider 实例
onUnmounted(() => {
  setDemoMessageApi(null)
})
</script>

<template>
  <!-- 纯逻辑组件：不渲染可见节点 -->
</template>
