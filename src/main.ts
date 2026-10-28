// 应用入口：站点样式 → 挂载路由 → 创建并挂载根组件
// 本地速查站，无第三方 UI 全局 CSS：Naive UI 的样式随 JS 打包，
// 由 unplugin-vue-components + NaiveUiResolver 按需注入到对应 Demo chunk
import './style.scss'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'

// 创建应用实例，注册路由后挂载到 #app 容器
createApp(App).use(router).mount('#app')
